from __future__ import annotations

import json
from pathlib import Path

import pandas as pd
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from xgboost import XGBRanker

try:
    from .feature_engineering import (
        FEATURE_COLUMNS,
        MODEL_FEATURE_COLUMNS,
        add_request_relative_features,
    )
except ImportError:
    from feature_engineering import (
        FEATURE_COLUMNS,
        MODEL_FEATURE_COLUMNS,
        add_request_relative_features,
    )


MODEL_PATH = Path(
    "apps/ml/models/mindroute-ranker.json"
)

METADATA_PATH = Path(
    "apps/ml/models/mindroute-ranker-metadata.json"
)



class RouteFeatures(BaseModel):
    distanceMeters: float
    durationSeconds: float

    estimatedShadeExposure: float
    greeneryExposure: float
    parkExposure: float
    pedestrianDensity: float
    trafficExposure: float
    noiseExposure: float
    commercialActivityExposure: float
    constructionExposure: float
    pointOfInterestDensity: float
    crossingComplexity: float


class RouteCandidate(BaseModel):
    routeId: str
    features: RouteFeatures


class RankRequest(BaseModel):
    requestId: str
    routes: list[RouteCandidate] = Field(
        min_length=2,
    )


class RankedRoute(BaseModel):
    routeId: str
    mlScore: float
    mlRank: int


class RankResponse(BaseModel):
    requestId: str

    modelAvailable: bool
    productionReady: bool

    schemaVersion: str | None

    rankedRoutes: list[RankedRoute]


app = FastAPI(
    title="MindRoute ML Service",
    version="0.1.0",
)


model: XGBRanker | None = None
metadata: dict = {}


def load_model() -> None:
    global model
    global metadata

    if not MODEL_PATH.exists():
        model = None
        metadata = {}
        return

    if not METADATA_PATH.exists():
        model = None
        metadata = {}
        return

    loaded_model = XGBRanker()
    loaded_model.load_model(MODEL_PATH)

    loaded_metadata = json.loads(
        METADATA_PATH.read_text()
    )

    model = loaded_model
    metadata = loaded_metadata


load_model()


@app.get("/health")
def health():
    return {
        "status": "ok",
        "modelAvailable": model is not None,
        "productionReady": bool(
            metadata.get(
                "productionReady",
                False,
            )
        ),
        "schemaVersion": metadata.get(
            "schemaVersion"
        ),
        "trainingRequests": metadata.get(
            "trainableRequests",
            0,
        ),
    }


@app.post(
    "/rank",
    response_model=RankResponse,
)
def rank_routes(
    request: RankRequest,
):
    if model is None:
        raise HTTPException(
            status_code=503,
            detail="MindRoute ranking model is not available.",
        )

    rows = []

    for route in request.routes:
        route_data = route.features.model_dump()

        rows.append(
            {
                "requestId": request.requestId,
                **{
                    feature: route_data[feature]
                    for feature in FEATURE_COLUMNS
                },
            }
        )

    frame = pd.DataFrame(
        rows
    )

    frame = add_request_relative_features(
        frame
    )

    model_frame = frame[
        MODEL_FEATURE_COLUMNS
    ].astype(float)

    try:
        scores = model.predict(
            model_frame
        )
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Model prediction failed: {error}",
        ) from error

    scored_routes = []

    for route, score in zip(
        request.routes,
        scores,
        strict=True,
    ):
        scored_routes.append(
            {
                "routeId": route.routeId,
                "mlScore": float(score),
            }
        )

    scored_routes.sort(
        key=lambda route: route["mlScore"],
        reverse=True,
    )

    ranked_routes = [
        RankedRoute(
            routeId=route["routeId"],
            mlScore=route["mlScore"],
            mlRank=index + 1,
        )
        for index, route in enumerate(
            scored_routes
        )
    ]

    return RankResponse(
        requestId=request.requestId,
        modelAvailable=True,
        productionReady=bool(
            metadata.get(
                "productionReady",
                False,
            )
        ),
        schemaVersion=metadata.get(
            "schemaVersion"
        ),
        rankedRoutes=ranked_routes,
    )
