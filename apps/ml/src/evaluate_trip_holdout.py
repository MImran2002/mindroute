from __future__ import annotations

import json
from collections import Counter
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.metrics import ndcg_score
from xgboost import XGBRanker

from train import (
    CURRENT_SCHEMA,
    FEATURE_COLUMNS,
    MODEL_FEATURE_COLUMNS,
    fetch_records,
)

try:
    from .feature_engineering import (
        add_request_relative_features,
    )
except ImportError:
    from feature_engineering import (
        add_request_relative_features,
    )


REPORT_PATH = Path(
    "apps/ml/data/trip-holdout-evaluation-report.json"
)

TIE_EPSILON = 1e-8


def make_model() -> XGBRanker:
    return XGBRanker(
        objective="rank:ndcg",
        n_estimators=50,
        learning_rate=0.05,
        max_depth=3,
        subsample=0.9,
        colsample_bytree=0.9,
        random_state=42,
    )


def trip_family(record: dict) -> str:
    required = [
        "originLat",
        "originLng",
        "destinationLat",
        "destinationLng",
    ]

    missing = [
        field
        for field in required
        if record.get(field) is None
    ]

    if missing:
        raise KeyError(
            "Training record is missing trip-location fields: "
            + ", ".join(missing)
        )

    # ~100 m-ish geographic grouping.
    return (
        f"{float(record['originLat']):.3f}:"
        f"{float(record['originLng']):.3f}"
        "->"
        f"{float(record['destinationLat']):.3f}:"
        f"{float(record['destinationLng']):.3f}"
    )


def build_dataframe(
    records: list[dict],
) -> pd.DataFrame:
    rows = []

    for record in records:
        features = record.get(
            "features",
            {},
        )

        row = {
            "requestId":
                record["requestId"],
            "routeId":
                record["routeId"],
            "selected":
                int(record["selected"]),
            "rank":
                int(record["rank"]),
            "tripFamily":
                trip_family(record),
        }

        for feature in FEATURE_COLUMNS:
            if feature in record:
                row[feature] = (
                    record[feature]
                )
            elif feature in features:
                row[feature] = (
                    features[feature]
                )
            else:
                raise KeyError(
                    f"Missing {feature} "
                    f"for {record['routeId']}"
                )

        rows.append(row)

    frame = pd.DataFrame(rows)

    if frame.empty:
        raise RuntimeError(
            "No trainable records available."
        )

    return add_request_relative_features(
        frame
    )


def validate_requests(
    frame: pd.DataFrame,
) -> None:
    for request_id, group in frame.groupby(
        "requestId",
        sort=False,
    ):
        if len(group) < 2:
            raise RuntimeError(
                f"{request_id} has fewer "
                "than 2 candidate routes."
            )

        if int(group["selected"].sum()) != 1:
            raise RuntimeError(
                f"{request_id} must have "
                "exactly one selected route."
            )


def prepare_training_data(
    frame: pd.DataFrame,
):
    ordered = frame.sort_values(
        ["requestId", "routeId"]
    ).reset_index(drop=True)

    qid = (
        ordered["requestId"]
        .astype("category")
        .cat.codes
        .to_numpy(dtype=np.int32)
    )

    X = ordered[
        MODEL_FEATURE_COLUMNS
    ].astype(float)

    y = ordered[
        "selected"
    ].to_numpy(dtype=np.float32)

    return X, y, qid


def evaluate_request(
    model: XGBRanker,
    group: pd.DataFrame,
) -> dict:
    group = (
        group
        .sort_values("routeId")
        .copy()
    )

    X = group[
        MODEL_FEATURE_COLUMNS
    ].astype(float)

    group["mlScore"] = (
        model.predict(X)
    )

    actual = group[
        group["selected"] == 1
    ].iloc[0]

    max_score = float(
        group["mlScore"].max()
    )

    top = group[
        np.isclose(
            group["mlScore"],
            max_score,
            atol=TIE_EPSILON,
            rtol=0,
        )
    ]

    tied = len(top) > 1

    predicted = group.loc[
        group["mlScore"].idxmax()
    ]

    strict_match = (
        not tied
        and predicted["routeId"]
        == actual["routeId"]
    )

    y_true = (
        group["selected"]
        .to_numpy(dtype=float)
        .reshape(1, -1)
    )

    y_score = (
        group["mlScore"]
        .to_numpy(dtype=float)
        .reshape(1, -1)
    )

    score = float(
        ndcg_score(
            y_true,
            y_score,
            ignore_ties=False,
        )
    )

    return {
        "requestId":
            str(actual["requestId"]),
        "selectedRouteId":
            str(actual["routeId"]),
        "selectedBaselineRank":
            int(actual["rank"]),
        "predictedRouteId":
            str(predicted["routeId"]),
        "tiedAtTop":
            tied,
        "strictMatch":
            strict_match,
        "ndcg":
            score,
    }


def main() -> None:
    records = [
        record
        for record in fetch_records()
        if record.get("schemaVersion")
        == CURRENT_SCHEMA
    ]

    frame = build_dataframe(
        records
    )

    validate_requests(
        frame
    )

    trip_families = list(
        frame["tripFamily"].unique()
    )

    print()
    print(
        "MindRoute trip-family holdout evaluation"
    )
    print()

    print(
        "Schema:",
        CURRENT_SCHEMA,
    )
    print(
        "Trip families:",
        len(trip_families),
    )
    print(
        "Requests:",
        frame["requestId"].nunique(),
    )
    print(
        "Candidate rows:",
        len(frame),
    )

    if len(trip_families) < 3:
        raise RuntimeError(
            "Need at least 3 distinct trip "
            "families for this evaluation."
        )

    results = []

    for family in trip_families:
        train_frame = frame[
            frame["tripFamily"] != family
        ].copy()

        test_frame = frame[
            frame["tripFamily"] == family
        ].copy()

        if (
            train_frame[
                "requestId"
            ].nunique()
            < 2
        ):
            continue

        model = make_model()

        X_train, y_train, qid = (
            prepare_training_data(
                train_frame
            )
        )

        model.fit(
            X_train,
            y_train,
            qid=qid,
            verbose=False,
        )

        family_results = []

        for _, request_group in (
            test_frame.groupby(
                "requestId",
                sort=False,
            )
        ):
            family_results.append(
                evaluate_request(
                    model,
                    request_group,
                )
            )

        results.append(
            {
                "tripFamily":
                    family,
                "trainingRequests":
                    int(
                        train_frame[
                            "requestId"
                        ].nunique()
                    ),
                "heldOutRequests":
                    int(
                        test_frame[
                            "requestId"
                        ].nunique()
                    ),
                "requestResults":
                    family_results,
            }
        )

    flat_results = [
        request
        for family in results
        for request
        in family["requestResults"]
    ]

    total = len(flat_results)

    strict_correct = sum(
        result["strictMatch"]
        for result in flat_results
    )

    baseline_correct = sum(
        result[
            "selectedBaselineRank"
        ] == 1
        for result in flat_results
    )

    ties = sum(
        result["tiedAtTop"]
        for result in flat_results
    )

    mean_ndcg = float(
        np.mean(
            [
                result["ndcg"]
                for result
                in flat_results
            ]
        )
    )

    selected_ranks = Counter(
        result[
            "selectedBaselineRank"
        ]
        for result in flat_results
    )

    report = {
        "schemaVersion":
            CURRENT_SCHEMA,

        "evaluationMethod":
            "leave-one-trip-family-out",

        "tripFamilies":
            len(results),

        "requestsEvaluated":
            total,

        "strictTopChoiceAccuracy":
            (
                strict_correct / total
                if total
                else 0
            ),

        "baselineTopChoiceAccuracy":
            (
                baseline_correct / total
                if total
                else 0
            ),

        "topScoreTieRate":
            (
                ties / total
                if total
                else 0
            ),

        "meanNdcg":
            mean_ndcg,

        "selectedBaselineRanks": {
            str(rank): count
            for rank, count
            in sorted(
                selected_ranks.items()
            )
        },

        "tripResults":
            results,
    }

    print()
    print(
        "Trip-holdout ML accuracy:",
        f"{report['strictTopChoiceAccuracy'] * 100:.1f}%"
    )

    print(
        "Baseline accuracy:",
        f"{report['baselineTopChoiceAccuracy'] * 100:.1f}%"
    )

    print(
        "Tie rate:",
        f"{report['topScoreTieRate'] * 100:.1f}%"
    )

    print(
        "Mean NDCG:",
        f"{report['meanNdcg']:.4f}"
    )

    print()
    print(
        "Selected baseline ranks:"
    )

    for rank, count in (
        report[
            "selectedBaselineRanks"
        ].items()
    ):
        print(
            f"  Rank {rank}: {count}"
        )

    print()
    print(
        "Per-trip-family results:"
    )

    for family in results:
        family_requests = (
            family[
                "requestResults"
            ]
        )

        correct = sum(
            request["strictMatch"]
            for request
            in family_requests
        )

        print()
        print(
            family["tripFamily"]
        )

        print(
            "  Held-out requests:",
            family[
                "heldOutRequests"
            ],
        )

        print(
            "  Correct:",
            f"{correct}/"
            f"{len(family_requests)}",
        )

        for request in (
            family_requests
        ):
            print(
                "   ",
                request[
                    "requestId"
                ],
                "selected=",
                request[
                    "selectedRouteId"
                ],
                "predicted=",
                request[
                    "predictedRouteId"
                ],
                "match=",
                request[
                    "strictMatch"
                ],
            )

    REPORT_PATH.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    REPORT_PATH.write_text(
        json.dumps(
            report,
            indent=2,
        )
        + "\n"
    )

    print()
    print(
        "Saved:",
        REPORT_PATH,
    )


if __name__ == "__main__":
    main()
