from __future__ import annotations

import json
from pathlib import Path


METADATA_PATH = Path(
    "apps/ml/models/mindroute-ranker-metadata.json"
)

REQUEST_EVALUATION_PATH = Path(
    "apps/ml/data/evaluation-report.json"
)

TRIP_EVALUATION_PATH = Path(
    "apps/ml/data/trip-holdout-evaluation-report.json"
)


MIN_TRAINABLE_REQUESTS = 50

MIN_REQUEST_HOLDOUT_ACCURACY = 0.75

MIN_TRIP_HOLDOUT_ACCURACY = 0.65

MAX_TRIP_HOLDOUT_TIE_RATE = 0.10

MIN_TRIP_HOLDOUT_NDCG = 0.80


def load_json(path: Path) -> dict:
    if not path.exists():
        raise RuntimeError(
            f"Required file does not exist: {path}"
        )

    return json.loads(
        path.read_text()
    )


def main() -> None:
    metadata = load_json(
        METADATA_PATH
    )

    request_evaluation = load_json(
        REQUEST_EVALUATION_PATH
    )

    trip_evaluation = load_json(
        TRIP_EVALUATION_PATH
    )

    metadata_schema = metadata.get(
        "schemaVersion"
    )

    request_schema = request_evaluation.get(
        "schemaVersion"
    )

    trip_schema = trip_evaluation.get(
        "schemaVersion"
    )

    trainable_requests = int(
        metadata.get(
            "trainableRequests",
            0,
        )
    )

    request_accuracy = float(
        request_evaluation.get(
            "strictTopChoiceAccuracy",
            0,
        )
    )

    trip_accuracy = float(
        trip_evaluation.get(
            "strictTopChoiceAccuracy",
            0,
        )
    )

    baseline_accuracy = float(
        trip_evaluation.get(
            "baselineTopChoiceAccuracy",
            0,
        )
    )

    trip_tie_rate = float(
        trip_evaluation.get(
            "topScoreTieRate",
            1,
        )
    )

    trip_ndcg = float(
        trip_evaluation.get(
            "meanNdcg",
            0,
        )
    )

    checks = {
        "schemaMatches": (
            metadata_schema
            == request_schema
            == trip_schema
        ),

        "minimumTrainableRequests": (
            trainable_requests
            >= MIN_TRAINABLE_REQUESTS
        ),

        "requestHoldoutAccuracy": (
            request_accuracy
            >= MIN_REQUEST_HOLDOUT_ACCURACY
        ),

        "tripHoldoutAccuracy": (
            trip_accuracy
            >= MIN_TRIP_HOLDOUT_ACCURACY
        ),

        "beatsBaseline": (
            trip_accuracy
            > baseline_accuracy
        ),

        "tripTieRate": (
            trip_tie_rate
            <= MAX_TRIP_HOLDOUT_TIE_RATE
        ),

        "tripNdcg": (
            trip_ndcg
            >= MIN_TRIP_HOLDOUT_NDCG
        ),
    }

    production_ready = all(
        checks.values()
    )

    failed_checks = [
        name
        for name, passed
        in checks.items()
        if not passed
    ]

    metadata[
        "productionReady"
    ] = production_ready

    metadata[
        "productionReadiness"
    ] = {
        "checks": checks,

        "failedChecks":
            failed_checks,

        "thresholds": {
            "minimumTrainableRequests":
                MIN_TRAINABLE_REQUESTS,

            "minimumRequestHoldoutAccuracy":
                MIN_REQUEST_HOLDOUT_ACCURACY,

            "minimumTripHoldoutAccuracy":
                MIN_TRIP_HOLDOUT_ACCURACY,

            "maximumTripHoldoutTieRate":
                MAX_TRIP_HOLDOUT_TIE_RATE,

            "minimumTripHoldoutNdcg":
                MIN_TRIP_HOLDOUT_NDCG,
        },

        "metrics": {
            "trainableRequests":
                trainable_requests,

            "requestHoldoutAccuracy":
                request_accuracy,

            "tripHoldoutAccuracy":
                trip_accuracy,

            "baselineAccuracy":
                baseline_accuracy,

            "tripHoldoutTieRate":
                trip_tie_rate,

            "tripHoldoutNdcg":
                trip_ndcg,
        },
    }

    METADATA_PATH.write_text(
        json.dumps(
            metadata,
            indent=2,
        )
        + "\n"
    )

    print()
    print(
        "MindRoute production readiness"
    )
    print()

    print(
        "Schema:",
        metadata_schema,
    )

    print(
        "Trainable requests:",
        trainable_requests,
    )

    print(
        "Request-holdout accuracy:",
        f"{request_accuracy * 100:.1f}%",
    )

    print(
        "Trip-holdout accuracy:",
        f"{trip_accuracy * 100:.1f}%",
    )

    print(
        "Baseline accuracy:",
        f"{baseline_accuracy * 100:.1f}%",
    )

    print(
        "Trip tie rate:",
        f"{trip_tie_rate * 100:.1f}%",
    )

    print(
        "Trip NDCG:",
        f"{trip_ndcg:.4f}",
    )

    print()
    print("Checks:")

    for name, passed in checks.items():
        print(
            f"  {'PASS' if passed else 'FAIL'} "
            f"{name}"
        )

    print()

    if production_ready:
        print(
            "Production ready: YES"
        )
    else:
        print(
            "Production ready: NO"
        )

        print(
            "Failed checks:",
            ", ".join(
                failed_checks
            ),
        )

    print()
    print(
        "Updated:",
        METADATA_PATH,
    )


if __name__ == "__main__":
    main()
