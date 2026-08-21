# MindRoute Technical Details

This document contains implementation-level information that is intentionally kept out of the project README. It describes repository organization, runtime boundaries, request flows, route generation, feature extraction, environmental processing, data collection, model training, evaluation, inference, diagnostics, and important design decisions.

## 1. System Architecture

MindRoute is a pnpm monorepo with three main runtime applications:

```text
Browser
  │
  ▼
apps/web ───────────────► Mapbox GL JS
  │
  │ HTTP /api
  ▼
apps/api ───────────────► Mapbox Directions API
  │                      OpenStreetMap / Overpass
  │
  └─────────────────────► apps/ml FastAPI /rank
```

Responsibilities are deliberately separated:

- `apps/web` owns user interaction and route visualization.
- `apps/api` owns route orchestration, feature extraction, environmental enrichment, baseline scoring, recommendation assembly, diagnostics, and training-record collection.
- `apps/ml` owns feature engineering for the learned model, XGBoost training, evaluation, readiness metadata, and ranking inference.

The ML service is optional at runtime. Core route generation does not depend on it.

## 2. Repository Directory Decisions

```text
mindroute/
├── apps/
│   ├── api/                     # NestJS application and navigation domain
│   │   ├── data/                # Runtime JSONL/diagnostic storage when generated
│   │   └── src/
│   │       ├── config/          # Environment/configuration mapping
│   │       └── modules/
│   │           ├── health/      # API health endpoint
│   │           ├── locations/   # Location search/geocoding behavior
│   │           └── navigation/  # Core MindRoute pipeline
│   ├── ml/                      # Python ranking system
│   │   ├── data/                # Evaluation reports and training previews
│   │   ├── models/              # Serialized XGBoost model + metadata
│   │   └── src/                 # Training, evaluation, inference, features
│   └── web/                     # Next.js application
│       └── src/
│           ├── app/             # Next.js app entrypoints/global CSS
│           ├── components/      # Main MindRoute interactive UI
│           ├── config/          # Frontend environment parsing
│           └── lib/             # Shared client helpers
├── packages/
│   └── contracts/               # Workspace location for cross-app contracts
├── scripts/                     # Dataset collection/audit/cache utilities
├── package.json                 # Monorepo commands
├── pnpm-lock.yaml
└── pnpm-workspace.yaml
```

### Why navigation code is service-oriented

The navigation module is split by responsibility rather than placing all route logic in the controller or one large service. This makes individual calculations testable and lets deterministic scoring, environmental retrieval, ML ranking, and storage evolve independently.

Important services include:

| Service | Responsibility |
|---|---|
| `NavigationService` | Orchestrates a complete route request. |
| `RouteCandidateGeneratorService` | Creates candidate query plans such as direct and offset alternatives. |
| `RouteFeatureExtractorService` | Extracts structural/navigation complexity features from a normalized route. |
| `RouteSamplingService` | Samples coordinates along route geometry for environmental lookup. |
| `OpenStreetMapEnvironmentalProvider` | Retrieves environmental observations from OSM/Overpass and manages retrieval behavior/cache. |
| `MockEnvironmentalProvider` | Provides explicitly marked fallback observations. |
| `EnvironmentalAggregationService` | Converts sample-level environmental observations to route-level values. |
| `RouteComparisonRowService` | Flattens a route into comparable/training-friendly fields. |
| `RouteBaselineScorerService` | Calculates deterministic cognitive-load, comfort, and final scores. |
| `RouteRecommendationService` | Assigns human-readable recommendation labels/explanations. |
| `MlRankingService` | Calls the Python model service and validates whether learned ranking can be used. |
| `AITrainingRecordService` | Creates schema-versioned candidate training records. |
| `AITrainingStorageService` | Persists route-generation/training information. |
| `RouteSelectionService` | Stores a user's confirmed candidate choice. |
| `SupervisedTrainingDatasetService` | Joins candidate records with selections to construct supervised rows. |
| `TrainingDatasetStatsService` | Audits dataset diversity/readiness. |
| `RouteGenerationDiagnosticsService` | Records route-generation/environmental reliability statistics. |

## 3. End-to-End Route Request Flow

Primary endpoint:

```http
GET /api/navigation/routes
```

Inputs are origin and destination latitude/longitude values.

High-level function flow:

```text
NavigationController.getRoutes()
        │
        ▼
NavigationService.getWalkingRoutes()
        │
        ├─ create requestId + capturedAt
        ├─ RouteCandidateGeneratorService.generate()
        │
        ├─ fetch each Mapbox candidate plan
        │     ├─ direct
        │     ├─ left-offset
        │     └─ right-offset
        │
        ├─ normalize Mapbox routes
        ├─ deduplicate similar candidates
        ├─ assign local route IDs
        │
        ├─ sample each route geometry
        │
        ├─ request OSM environmental context
        │     └─ fallback to mock provider on unrecoverable failure
        │
        ├─ analyze each candidate
        │     ├─ navigation features
        │     ├─ environmental aggregation
        │     ├─ comparison row
        │     ├─ baseline score
        │     └─ training record
        │
        ├─ rank with deterministic baseline
        ├─ request optional ML ranking
        ├─ apply ML order only when eligible
        ├─ assign recommendation labels
        ├─ persist diagnostic/training artifacts
        │
        ▼
NavigationRoutesResponse
```

Each route returned to the frontend contains geometry, instructions, route features, environmental summaries/status, comparison values, baseline scores, recommendation information, samples, and training metadata used by the research pipeline.

## 4. Candidate Route Generation

MindRoute does not ask AI to generate routes. Candidate generation starts with walking-route plans created by `RouteCandidateGeneratorService` and resolved through Mapbox Directions.

The purpose of offset plans is to obtain genuinely different route corridors when a provider's normal alternatives are insufficient. Candidate source is preserved as metadata:

```text
direct
left-offset
right-offset
```

After retrieval, candidates are normalized into one internal representation and deduplicated before downstream scoring. This prevents multiple nearly identical Mapbox responses from being treated as meaningful user choices or separate training alternatives.

## 5. Route Normalization and Navigation Features

Normalized candidates preserve:

- distance and duration;
- GeoJSON-compatible line geometry;
- route steps and instructions;
- maneuver information;
- intersections/crossings;
- candidate source.

The navigation feature layer derives quantities designed to approximate route complexity, including values represented in the comparison-row contract such as:

```text
turnCount
sharpTurnCount
decisionPointCount
instructionDensityPerKm
averageSegmentLengthMeters
shortSegmentCount
routeStraightness
crossingCount
signalizedCrossingCount
unsignalizedCrossingCount
complexIntersectionCount
crossingComplexity
```

These values are deterministic transformations of route structure rather than AI predictions.

## 6. Route Sampling

The current navigation service samples each candidate at approximately 200-meter spacing before environmental enrichment.

Sampling exists because conditions along a route cannot be represented by a single endpoint lookup. Every sample retains a route association so observations can later be grouped back into the correct candidate.

```text
route geometry
   ↓
RouteSamplingService
   ↓
route-1 sample 1
route-1 sample 2
...
route-2 sample 1
...
```

## 7. Environmental Data Flow

Primary environmental source:

```text
OpenStreetMap / Overpass API
```

The provider converts sampled route locations into environmental observations. The aggregation layer then produces route-level fields including:

```text
estimatedShadeExposure
greeneryExposure
parkExposure
pedestrianDensity
trafficExposure
noiseExposure
commercialActivityExposure
constructionExposure
eventExposure
pointOfInterestDensity
```

Crossing complexity comes from route/navigation structure and is carried with the model feature set.

### Provenance

Environmental data quality is intentionally explicit. The backend distinguishes sources/status such as live, cache, mixed, real, partial, fallback, or unavailable depending on the stage and contract involved.

Fallback data is useful for keeping the route pipeline demonstrable, but it should not silently be treated as equivalent to high-confidence live observations. Dataset services and diagnostics exist partly to prevent this mistake.

## 8. Baseline Scoring Flow

`RouteBaselineScorerService` transforms route features into three main values:

```text
cognitiveLoadScore
comfortScore
finalScore
```

The response also exposes breakdown fields such as:

```text
navigationComplexity
crossingComplexity
environmentalStrain
routeEfficiency
environmentalComfort
```

The baseline is important even after adding ML because it provides:

1. a deterministic fallback;
2. an interpretable benchmark;
3. a way to collect initial user preference data before a model exists;
4. a baseline accuracy value against which learned ranking can be evaluated.

## 9. Recommendation Labels

After routes have an order, `RouteRecommendationService` assigns labels and explanations. Current UI-supported labels include:

```text
Best overall
Lowest cognitive load
Most comfortable
Fastest
Alternative
```

These labels are presentation semantics. They help the user understand why a route may be useful instead of displaying only a numeric score.

## 10. User Selection and Label Collection

Endpoint:

```http
POST /api/navigation/route-selections
```

A route-generation request has a `requestId`. Each candidate has a `routeId`. When a user confirms one candidate, `RouteSelectionService` stores the selection as a user-choice label.

Conceptually:

```text
request A
  route-1  candidate features  selected = false
  route-2  candidate features  selected = true
  route-3  candidate features  selected = false
```

The whole request group is required for learning-to-rank. The selected route alone is not sufficient because the model must know what alternatives the user rejected.

## 11. Training Record Pipeline

The project maintains schema-versioned AI records so feature changes can be distinguished from older datasets. The current audit script targets schema `2.0`.

Useful backend endpoints include:

```http
GET /api/navigation/training-dataset-stats
GET /api/navigation/supervised-training-records
GET /api/navigation/trainable-records
GET /api/navigation/supervised-training-records.csv
GET /api/navigation/trainable-records.csv
GET /api/navigation/training-records
GET /api/navigation/training-records.csv
GET /api/navigation/route-generation-stats
```

The important distinction is:

- **generated training record**: captures what the system observed for a candidate;
- **selection record**: captures what the user chose;
- **supervised record**: joins candidate + selection information;
- **trainable record**: supervised record that passes current training eligibility/data-quality rules.

## 12. Training Data Audit

Run:

```bash
pnpm audit:training
```

`scripts/audit-training-data.mjs` retrieves current-schema trainable rows and reports per-feature:

- minimum;
- maximum;
- average;
- number of unique values;
- zero saturation;
- one saturation;
- warnings for no variation or excessive saturation.

This is important because a structured model can only learn from features that vary meaningfully across choices.

## 13. Interactive Route-Choice Collection

Run:

```bash
pnpm collect:choices
```

`scripts/collect-route-choice.mjs` provides preset San Francisco trip pairs or accepts manual coordinates. It requests candidates, prints their comparison/scoring information, and supports collecting route choices through the running API.

This tool exists to create grouped preference examples without requiring every experiment to be performed through the browser UI.

## 14. OSM Cache Prewarming

Run:

```bash
pnpm prewarm:osm
```

The prewarm script requests a set of known trip families with delays between requests. The purpose is to reduce repeated pressure on public Overpass instances and increase the chance that a demo or collection run can reuse environmental information already seen by the backend.

Prewarming is an optimization, not a substitute for provenance tracking. Cache-derived values are still distinguishable from freshly retrieved values.

## 15. ML Feature Engineering

The model uses these absolute feature columns:

```text
distanceMeters
durationSeconds
estimatedShadeExposure
greeneryExposure
parkExposure
pedestrianDensity
trafficExposure
noiseExposure
commercialActivityExposure
constructionExposure
pointOfInterestDensity
crossingComplexity
```

`eventExposure` is intentionally excluded from the current trained model because the repository metadata indicates that it had no useful variation in the dataset.

`apps/ml/src/feature_engineering.py` also generates request-relative versions of the model features. A relative value represents a candidate in the context of the alternatives for the same `requestId`.

The resulting model currently uses 24 inputs:

```text
12 absolute features
+
12 request-relative features
```

## 16. Why Learning-to-Rank

MindRoute's supervised question is not simply:

```text
Is this route good? yes/no
```

It is:

```text
Given these candidates for the same trip, which one should rank highest?
```

That is a grouped ranking problem. `XGBRanker` fits this structure better than training an isolated binary classifier on every route, because candidates within the same request are directly related.

## 17. Model Training

Training implementation:

```text
apps/ml/src/train.py
```

The training process consumes grouped trainable route records, applies feature engineering, trains an XGBoost ranker, and writes:

```text
apps/ml/models/mindroute-ranker.json
apps/ml/models/mindroute-ranker-metadata.json
```

The metadata is as important as the serialized model because the API uses readiness/schema information to decide whether the model should influence route ordering.

Current checked-in metadata reports:

```text
schemaVersion: 2.0
trainableRequests: 76
trainingRows: 197
selectedRows: 76
productionReady: true
```

## 18. Model Evaluation

MindRoute stores two complementary evaluation views.

### Request holdout

This measures how well the model predicts selected candidates on held-out request groups drawn from the dataset.

Current metadata reports request-holdout top-choice accuracy of approximately:

```text
0.9342 (93.4%)
```

### Leave-one-trip-family-out evaluation

Implementation:

```text
apps/ml/src/evaluate_trip_holdout.py
```

This is the more important generalization check in the current repository because entire origin/destination trip families are held out rather than allowing similar examples from the same trip family into training.

Current checked-in report:

```text
trip families:                 8
requests evaluated:            76
strict top-choice accuracy:     0.7632
baseline top-choice accuracy:   0.5789
top-score tie rate:             0.0
mean NDCG:                      0.9040
```

These metrics describe the current prototype dataset only. They should not be interpreted as clinical validation or performance guarantees for new cities/users.

## 19. Production-Readiness Metadata

The checked-in model metadata evaluates readiness against explicit thresholds. Current checks include:

```text
schema matches
minimum trainable requests
minimum request-holdout accuracy
minimum trip-holdout accuracy
model beats baseline
top-score tie rate threshold
minimum trip-holdout NDCG
```

Current thresholds in metadata include:

```text
minimum trainable requests:        50
minimum request-holdout accuracy:  0.75
minimum trip-holdout accuracy:     0.65
maximum trip-holdout tie rate:     0.10
minimum trip-holdout NDCG:         0.80
```

All current metadata checks are marked true. The word “production-ready” here means **ready according to the project's current prototype gating rules**, not that the system has undergone external safety, accessibility, or clinical validation.

## 20. ML Inference Service

FastAPI entrypoint:

```text
apps/ml/src/main.py
```

Health endpoint:

```http
GET /health
```

Ranking endpoint:

```http
POST /rank
```

Expected ranking request shape:

```json
{
  "requestId": "request-id",
  "routes": [
    {
      "routeId": "route-1",
      "features": {
        "distanceMeters": 2100,
        "durationSeconds": 1600,
        "estimatedShadeExposure": 0.35,
        "greeneryExposure": 0.42,
        "parkExposure": 0.10,
        "pedestrianDensity": 0.30,
        "trafficExposure": 0.55,
        "noiseExposure": 0.50,
        "commercialActivityExposure": 0.40,
        "constructionExposure": 0.05,
        "pointOfInterestDensity": 0.38,
        "crossingComplexity": 0.47
      }
    },
    {
      "routeId": "route-2",
      "features": {
        "distanceMeters": 2250,
        "durationSeconds": 1700,
        "estimatedShadeExposure": 0.55,
        "greeneryExposure": 0.60,
        "parkExposure": 0.20,
        "pedestrianDensity": 0.22,
        "trafficExposure": 0.30,
        "noiseExposure": 0.28,
        "commercialActivityExposure": 0.25,
        "constructionExposure": 0.02,
        "pointOfInterestDensity": 0.30,
        "crossingComplexity": 0.32
      }
    }
  ]
}
```

The service adds request-relative features internally before prediction. It returns ordered items containing:

```text
routeId
mlScore
mlRank
```

along with model availability, readiness, and schema version.

## 21. NestJS → FastAPI ML Flow

`MlRankingService` is the TypeScript boundary around the ML runtime.

```text
NavigationService
   │
   ├─ candidate route features
   ▼
MlRankingService
   │ HTTP POST
   ▼
FastAPI /rank
   │
   ├─ add relative features
   ├─ XGBRanker.predict()
   ├─ sort descending by mlScore
   ▼
MlRankResponse
```

The API does not blindly trust a response simply because it came from the ML service. Model availability/readiness/schema information is returned so the backend can preserve the baseline if learned ranking should not be applied.

## 22. Graceful Degradation

MindRoute has two major fallback boundaries.

### Environmental fallback

If live environmental retrieval fails, the mock provider can keep the analysis pipeline operational while marking the route data as fallback/low-quality.

### ML fallback

If the FastAPI service is offline, the model is absent, prediction fails, or readiness requirements are not satisfied, deterministic ranking remains available.

This architecture ensures that neither an external environmental API nor the learned model is allowed to make the navigation endpoint fundamentally unusable.

## 23. Frontend Data Flow

The principal UI is implemented in:

```text
apps/web/src/components/mindroute-app.tsx
```

Conceptual flow:

```text
user enters/searches destination
        ↓
frontend resolves coordinates
        ↓
GET /api/navigation/routes
        ↓
render candidate geometry on Mapbox
        ↓
show recommended route/details
        ↓
user optionally displays alternatives
        ↓
user confirms preferred route
        ↓
POST /api/navigation/route-selections
```

The client maintains both a highlighted/selected route state and a confirmed route state so exploration does not automatically become a training label.

## 24. Frontend Accessibility-Oriented Controls

The current main component includes:

- day and night map styles;
- normal and color-blind route palettes;
- single-route and multiple-route display modes;
- labeled route alternatives instead of relying on color alone;
- status messages for API/routing interaction.

These are product-level controls, not ML features. They reduce presentation burden independently of the route-ranking algorithm.

## 25. Diagnostics

Route generation can fail or degrade for reasons unrelated to ranking quality. `RouteGenerationDiagnosticsService` tracks operational information separately from ML metrics.

Examples include:

```text
plans attempted
provider successes
provider failures
routes before deduplication
routes after deduplication
duplicates removed
environmental retrieval source/fallback behavior
```

Endpoint:

```http
GET /api/navigation/route-generation-stats
```

Separating operational diagnostics from model evaluation prevents a slow Overpass response, for example, from being confused with a poor ranking model.

## 26. Data Contracts and Versioning

The navigation module uses explicit TypeScript interfaces for candidate routes, route features, comparison rows, environmental observations, scores, recommendations, diagnostics, selections, supervised records, and training statistics.

Training records include a schema version. Any change to feature semantics should be treated as a dataset-versioning decision rather than silently mixing incompatible examples.

The current audit/model schema is:

```text
2.0
```

## 27. Local Development Commands

Install dependencies:

```bash
pnpm install
```

Run web + API:

```bash
pnpm dev
```

Run API only:

```bash
pnpm dev:api
```

Run web only:

```bash
pnpm dev:web
```

Build workspaces:

```bash
pnpm build
```

Run tests:

```bash
pnpm test
```

Audit current trainable data:

```bash
pnpm audit:training
```

Collect route choices:

```bash
pnpm collect:choices
```

Prewarm OSM cache:

```bash
pnpm prewarm:osm
```

## 28. Environment Boundaries

The Node backend requires Mapbox configuration to fetch routes. The frontend requires a public Mapbox token for rendering the map. The API and web app use separate environment files because Next.js public variables and NestJS server secrets have different exposure rules.

The ML service should be configured as an internal backend dependency. The browser should not call the ranker directly; route features and model behavior remain coordinated by NestJS.

## 29. Technical Design Principles

### Explainability before optimization

Every learned ranking is built on features that already exist in the deterministic comparison pipeline. The model therefore optimizes over interpretable quantities rather than hidden route embeddings.

### Group-aware training

A route selection is preserved with its alternatives. Breaking that relationship would destroy the meaning of the label.

### Data quality before dataset size

Fallback-heavy, duplicate, stale-schema, or non-varying examples can increase row count while decreasing learning value. Readiness statistics and audits therefore matter as much as raw record count.

### Geographic generalization must be tested separately

Random request holdouts can overstate performance when nearly identical trip families are present in both train and test data. Leave-one-trip-family-out evaluation is used to provide a stricter signal.

### Model readiness is a gate, not a promise

The repository's readiness flag means that current internal thresholds pass. It is designed to protect runtime behavior, not to certify the application for medical, safety-critical, or universal deployment.

## 30. Current Technical Limitations and Next Engineering Steps

The checked-in system is a prototype. Important next steps include:

- collect route choices from more users rather than relying primarily on developer-generated selections;
- expand beyond a small set of San Francisco trip families;
- improve direct sources for pedestrian density, traffic, noise, construction, and real-time events;
- replace JSONL/CSV prototype persistence with durable PostgreSQL/PostGIS storage;
- add user/profile-aware personalization only after enough consented preference data exists;
- calibrate environmental confidence so low-quality sources have measurable influence on ranking eligibility;
- add broader end-to-end tests covering NestJS ↔ FastAPI ranking behavior;
- monitor model drift and dataset schema changes;
- evaluate accessibility and usability with actual target users;
- preserve the deterministic baseline as an interpretable reference during future model iterations.
