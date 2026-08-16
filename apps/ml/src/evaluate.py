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
    MODEL_FEATURE_COLUMNS,
    build_dataframe,
    fetch_records,
    validate_requests,
)


REPORT_PATH = Path(
    "apps/ml/data/evaluation-report.json"
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


def prepare_training_fold(
    frame: pd.DataFrame,
):
    frame = frame.sort_values(
        ["requestId", "routeId"]
    ).reset_index(drop=True)

    qid = (
        frame["requestId"]
        .astype("category")
        .cat.codes
        .to_numpy(dtype=np.int32)
    )

    X = frame[
        MODEL_FEATURE_COLUMNS
    ].astype(float)

    y = frame[
        "selected"
    ].to_numpy(dtype=np.float32)

    return X, y, qid


def evaluate_request(
    train_frame: pd.DataFrame,
    test_frame: pd.DataFrame,
) -> dict:
    model = make_model()

    X_train, y_train, qid = (
        prepare_training_fold(
            train_frame
        )
    )

    model.fit(
        X_train,
        y_train,
        qid=qid,
        verbose=False,
    )

    test_frame = (
        test_frame
        .sort_values("routeId")
        .copy()
    )

    X_test = test_frame[
        MODEL_FEATURE_COLUMNS
    ].astype(float)

    test_frame["mlScore"] = (
        model.predict(X_test)
    )

    selected = test_frame[
        test_frame["selected"] == 1
    ]

    if len(selected) != 1:
        raise RuntimeError(
            "Held-out request must contain "
            "exactly one selected route."
        )

    actual = selected.iloc[0]

    max_score = float(
        test_frame["mlScore"].max()
    )

    top_routes = test_frame[
        np.isclose(
            test_frame["mlScore"],
            max_score,
            atol=TIE_EPSILON,
            rtol=0,
        )
    ]

    tied_at_top = (
        len(top_routes) > 1
    )

    predicted = test_frame.loc[
        test_frame["mlScore"].idxmax()
    ]

    strict_match = (
        not tied_at_top
        and predicted["routeId"]
        == actual["routeId"]
    )

    selected_in_top_tie = bool(
        (
            top_routes["routeId"]
            == actual["routeId"]
        ).any()
    )

    y_true = (
        test_frame["selected"]
        .to_numpy(dtype=float)
        .reshape(1, -1)
    )

    y_score = (
        test_frame["mlScore"]
        .to_numpy(dtype=float)
        .reshape(1, -1)
    )

    ndcg = float(
        ndcg_score(
            y_true,
            y_score,
            ignore_ties=False,
        )
    )

    ordered = test_frame.sort_values(
        ["mlScore", "routeId"],
        ascending=[False, True],
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
            tied_at_top,

        "selectedInTopTie":
            selected_in_top_tie,

        "strictMatch":
            strict_match,

        "ndcg":
            ndcg,

        "routes": [
            {
                "routeId":
                    str(row["routeId"]),

                "baselineRank":
                    int(row["rank"]),

                "selected":
                    bool(row["selected"]),

                "mlScore":
                    float(row["mlScore"]),
            }
            for _, row
            in ordered.iterrows()
        ],
    }


def main() -> None:
    records = fetch_records()

    frame = build_dataframe(
        records
    )

    validate_requests(
        frame
    )

    request_ids = list(
        frame["requestId"].unique()
    )

    print()
    print(
        "MindRoute leave-one-request-out evaluation"
    )
    print()

    print(
        "Schema:",
        CURRENT_SCHEMA,
    )
    print(
        "Requests:",
        len(request_ids),
    )
    print(
        "Candidate rows:",
        len(frame),
    )

    if len(request_ids) < 3:
        raise RuntimeError(
            "Need at least 3 trainable requests "
            "for leave-one-request-out evaluation."
        )

    results = []

    for request_id in request_ids:
        train_frame = frame[
            frame["requestId"]
            != request_id
        ].copy()

        test_frame = frame[
            frame["requestId"]
            == request_id
        ].copy()

        result = evaluate_request(
            train_frame,
            test_frame,
        )

        results.append(
            result
        )

    strict_matches = sum(
        result["strictMatch"]
        for result in results
    )

    tied_requests = sum(
        result["tiedAtTop"]
        for result in results
    )

    selected_in_top_tie = sum(
        result["selectedInTopTie"]
        for result in results
    )

    baseline_matches = sum(
        result["selectedBaselineRank"] == 1
        for result in results
    )

    mean_ndcg = float(
        np.mean(
            [
                result["ndcg"]
                for result in results
            ]
        )
    )

    request_count = len(results)

    rank_counts = Counter(
        result["selectedBaselineRank"]
        for result in results
    )

    report = {
        "schemaVersion":
            CURRENT_SCHEMA,

        "evaluationMethod":
            "leave-one-request-out",

        "requests":
            request_count,

        "candidateRows":
            len(frame),

        "strictTopChoiceAccuracy":
            strict_matches
            / request_count,

        "baselineTopChoiceAccuracy":
            baseline_matches
            / request_count,

        "topScoreTieRate":
            tied_requests
            / request_count,

        "selectedInTopTieRate":
            selected_in_top_tie
            / request_count,

        "meanNdcg":
            mean_ndcg,

        "selectedBaselineRanks": {
            str(rank): count
            for rank, count
            in sorted(
                rank_counts.items()
            )
        },

        "learnedSignalDetected":
            (
                request_count >= 5
                and (
                    tied_requests
                    / request_count
                ) < 0.5
                and strict_matches > 0
            ),

        "requestResults":
            results,
    }

    print()
    print(
        "Strict ML accuracy:",
        f"{report['strictTopChoiceAccuracy'] * 100:.1f}%"
    )

    print(
        "Baseline accuracy:",
        f"{report['baselineTopChoiceAccuracy'] * 100:.1f}%"
    )

    print(
        "Top-score tie rate:",
        f"{report['topScoreTieRate'] * 100:.1f}%"
    )

    print(
        "Selected route in top tie:",
        f"{report['selectedInTopTieRate'] * 100:.1f}%"
    )

    print(
        "Mean NDCG:",
        f"{report['meanNdcg']:.4f}"
    )

    print(
        "Learned signal detected:",
        (
            "YES"
            if report[
                "learnedSignalDetected"
            ]
            else "NO"
        )
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
        "Held-out request results:"
    )

    for result in results:
        print()
        print(
            result["requestId"]
        )

        print(
            "  Selected:",
            result[
                "selectedRouteId"
            ]
        )

        print(
            "  Baseline rank:",
            result[
                "selectedBaselineRank"
            ]
        )

        print(
            "  ML top:",
            result[
                "predictedRouteId"
            ]
        )

        print(
            "  Top tie:",
            (
                "YES"
                if result[
                    "tiedAtTop"
                ]
                else "NO"
            )
        )

        print(
            "  Strict match:",
            (
                "YES"
                if result[
                    "strictMatch"
                ]
                else "NO"
            )
        )

        print(
            "  NDCG:",
            f"{result['ndcg']:.4f}"
        )

        for route in result[
            "routes"
        ]:
            print(
                "   ",
                route[
                    "routeId"
                ],
                "score=",
                round(
                    route[
                        "mlScore"
                    ],
                    6,
                ),
                "selected=",
                route[
                    "selected"
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
