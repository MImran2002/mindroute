from __future__ import annotations

import numpy as np
import pandas as pd


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

RELATIVE_FEATURE_COLUMNS = [
    f"{feature}RelativeToRequest"
    for feature in FEATURE_COLUMNS
]

MODEL_FEATURE_COLUMNS = (
    FEATURE_COLUMNS
    + RELATIVE_FEATURE_COLUMNS
)


def add_request_relative_features(
    frame: pd.DataFrame,
) -> pd.DataFrame:
    """
    Add route-vs-alternative features.

    For every feature inside each request:

        relative =
            (route_value - request_mean)
            / (request_max - request_min)

    A feature with no variation inside a request gets 0.

    These values use only the candidate routes available
    at prediction time, so they do not leak user selection.
    """

    frame = frame.copy()

    if "requestId" not in frame.columns:
        raise KeyError(
            "requestId is required for "
            "request-relative feature engineering."
        )

    for feature in FEATURE_COLUMNS:
        if feature not in frame.columns:
            raise KeyError(
                f"Missing feature column: {feature}"
            )

        grouped = frame.groupby(
            "requestId"
        )[feature]

        mean = grouped.transform("mean")
        minimum = grouped.transform("min")
        maximum = grouped.transform("max")

        feature_range = (
            maximum - minimum
        )

        relative = np.where(
            feature_range > 0,
            (
                frame[feature] - mean
            ) / feature_range,
            0.0,
        )

        frame[
            f"{feature}RelativeToRequest"
        ] = relative.astype(float)

    return frame
