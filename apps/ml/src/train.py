from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd
import requests
from xgboost import XGBRanker


API_URL = (
    "http://localhost:3001/api/navigation/trainable-records"
)

CURRENT_SCHEMA = "2.0"

FEATURE_COLUMNS = [
    "distanceMeters",
    "durationSeconds",
    "estimatedShadeExposure",
    "greeneryExposure",
    "parkExposure",
    "pedestrianDensity",
    "trafficExposure",
    "noiseExposure",
    "commercialActivityExposure",
    "constructionExposure",
    "pointOfInterestDensity",
    "crossingComplexity",
]

MODEL_PATH = Path(
    "apps/ml/models/mindroute-ranker.json"
)

METADATA_PATH = Path(
    "apps/ml/models/mindroute-ranker-metadata.json"
)


def fetch_records() -> list[dict]:
    response = requests.get(
        API_URL,
        timeout=30,
    )
    response.raise_for_status()

    records = response.json()

    return [
        record
        for record in records
        if record.get("schemaVersion") == CURRENT_SCHEMA
    ]


def build_dataframe(
    records: list[dict],
) -> pd.DataFrame:
    rows = []

    for record in records:
        features = record.get("features", {})

        row = {
            "requestId": record["requestId"],
            "routeId": record["routeId"],
            "selected": int(record["selected"]),
            "rank": int(record["rank"]),
        }

        for feature in FEATURE_COLUMNS:
            if feature in record:
                row[feature] = record[feature]
            elif feature in features:
                row[feature] = features[feature]
            else:
                raise KeyError(
                    f"Missing feature {feature} "
                    f"for route {record['routeId']}"
                )

        rows.append(row)

    frame = pd.DataFrame(rows)

    if frame.empty:
        raise RuntimeError(
            "No schema 2.0 trainable records were found."
        )

    return frame


def validate_requests(
    frame: pd.DataFrame,
) -> None:
    for request_id, group in frame.groupby(
        "requestId",
        sort=False,
    ):
        if len(group) < 2:
            raise RuntimeError(
                f"{request_id} has fewer than 2 candidates."
            )

        selected_count = int(
            group["selected"].sum()
        )

        if selected_count != 1:
            raise RuntimeError(
                f"{request_id} has "
                f"{selected_count} selected routes; "
                "expected exactly 1."
            )


def prepare_training_data(
    frame: pd.DataFrame,
):
    frame = frame.sort_values(
        ["requestId", "routeId"]
    ).reset_index(drop=True)

    request_ids = frame[
        "requestId"
    ].astype("category")

    qid = request_ids.cat.codes.to_numpy(
        dtype=np.int32
    )

    X = frame[
        FEATURE_COLUMNS
    ].astype(float)

    y = frame["selected"].to_numpy(
        dtype=np.float32
    )

    return frame, X, y, qid


def train_model(
    X: pd.DataFrame,
    y: np.ndarray,
    qid: np.ndarray,
) -> XGBRanker:
    model = XGBRanker(
        objective="rank:ndcg",
        n_estimators=50,
        learning_rate=0.05,
        max_depth=3,
        subsample=0.9,
        colsample_bytree=0.9,
        random_state=42,
    )

    model.fit(
        X,
        y,
        qid=qid,
        verbose=False,
    )

    return model


def evaluate_training_fit(
    model: XGBRanker,
    frame: pd.DataFrame,
    X: pd.DataFrame,
) -> None:
    scores = model.predict(X)

    evaluation = frame[
        [
            "requestId",
            "routeId",
            "selected",
            "rank",
        ]
    ].copy()

    evaluation["mlScore"] = scores

    request_count = 0
    correct_count = 0

    print()
    print("Training-set ranking check")
    print()

    for request_id, group in evaluation.groupby(
        "requestId",
        sort=False,
    ):
        request_count += 1

        predicted = group.loc[
            group["mlScore"].idxmax()
        ]

        actual = group[
            group["selected"] == 1
        ].iloc[0]

        correct = (
            predicted["routeId"]
            == actual["routeId"]
        )

        if correct:
            correct_count += 1

        print(
            f"{request_id}"
        )
        print(
            f"  Actual:    {actual['routeId']}"
        )
        print(
            f"  Predicted: {predicted['routeId']}"
        )
        print(
            f"  Match:     {'YES' if correct else 'NO'}"
        )

        ordered = group.sort_values(
            "mlScore",
            ascending=False,
        )

        for _, row in ordered.iterrows():
            print(
                "   ",
                row["routeId"],
                "score=",
                round(float(row["mlScore"]), 4),
                "selected=",
                int(row["selected"]),
            )

    accuracy = (
        correct_count / request_count
        if request_count
        else 0
    )

    print()
    print(
        "Training top-choice accuracy:",
        f"{correct_count}/{request_count}",
        f"({accuracy * 100:.1f}%)",
    )

    print()
    print(
        "NOTE: This is training-set fit only, "
        "not real model accuracy."
    )


def save_model(
    model: XGBRanker,
    frame: pd.DataFrame,
) -> None:
    MODEL_PATH.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    model.save_model(MODEL_PATH)

    metadata = {
        "schemaVersion": CURRENT_SCHEMA,
        "featureColumns": FEATURE_COLUMNS,
        "trainableRequests": int(
            frame["requestId"].nunique()
        ),
        "trainingRows": int(len(frame)),
        "selectedRows": int(
            frame["selected"].sum()
        ),
        "productionReady": False,
        "minimumRecommendedRequests": 50,
        "notes": [
            "Initial MindRoute learning-to-rank model.",
            "Not production-ready with current dataset size.",
            "eventExposure intentionally excluded because it has no variation.",
        ],
    }

    METADATA_PATH.write_text(
        json.dumps(
            metadata,
            indent=2,
        )
        + "\n"
    )


def main() -> None:
    records = fetch_records()

    frame = build_dataframe(records)

    validate_requests(frame)

    frame, X, y, qid = (
        prepare_training_data(frame)
    )

    print()
    print("MindRoute XGBoost trainer")
    print()
    print(
        "Schema:",
        CURRENT_SCHEMA,
    )
    print(
        "Requests:",
        frame["requestId"].nunique(),
    )
    print(
        "Candidate rows:",
        len(frame),
    )
    print(
        "Features:",
        len(FEATURE_COLUMNS),
    )

    model = train_model(
        X,
        y,
        qid,
    )

    evaluate_training_fit(
        model,
        frame,
        X,
    )

    save_model(
        model,
        frame,
    )

    print()
    print(
        "Saved model:",
        MODEL_PATH,
    )
    print(
        "Saved metadata:",
        METADATA_PATH,
    )

    print()
    print(
        "Training pipeline completed successfully."
    )
    print(
        "Model is NOT production-ready yet."
    )


if __name__ == "__main__":
    main()
