# MindRoute

MindRoute is an AI-assisted adaptive walking-navigation prototype designed to reduce cognitive load during navigation, especially for users with ADHD and other users who may become overwhelmed by complicated directions, crowded streets, noisy environments, frequent decisions, or difficult crossings.

Unlike a traditional navigation system that primarily optimizes travel time and distance, MindRoute analyzes both route complexity and environmental strain. The current system uses a deterministic rule-based baseline. An AI model will be added only after the route-generation, feature-extraction, scoring, and evaluation pipeline is stable.

## Current Status

The current backend can:

- retrieve walking routes from Mapbox;
- request route alternatives when Mapbox makes them available;
- normalize route geometry, instructions, maneuvers, and intersections;
- sample route geometry approximately every 100 meters;
- extract navigation-complexity features;
- request environmental data from OpenStreetMap Overpass;
- fall back to clearly marked mock environmental data when Overpass is unavailable;
- aggregate environmental observations into route-level features;
- create flat route-comparison rows for future AI input;
- calculate deterministic cognitive-load and comfort scores;
- rank routes from lowest estimated cognitive burden to highest;
- assign recommendation labels and explanations;
- return geometry, instructions, features, scores, rankings, and data-status information to the frontend.

The AI training-record step has **not yet been implemented**.

## Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | Next.js 16, React 19, TypeScript | Adaptive navigation interface |
| Styling | Tailwind CSS 4 | Frontend styling |
| Mapping | Mapbox GL JS | Map rendering |
| Routing | Mapbox Directions API | Walking routes, geometry, instructions, and alternatives |
| Backend | NestJS 11, TypeScript | Routing orchestration and feature processing |
| Validation | class-validator, class-transformer, Joi | Request and environment validation |
| Environmental data | OpenStreetMap Overpass API | POIs, roads, parks, greenery, and related context |
| Package manager | pnpm 11.13.1 | Monorepo dependency management |
| Testing | Jest | Backend service tests |
| Future AI | Python, FastAPI, XGBoost | Route preference and cognitive-load prediction |
| Future database | PostgreSQL and PostGIS | Route, feedback, and geographic data storage |

## Repository Structure

```text
mindroute/
├── apps/
│   ├── api/
│   │   └── src/
│   │       ├── config/
│   │       ├── modules/
│   │       │   ├── health/
│   │       │   ├── locations/
│   │       │   └── navigation/
│   │       │       ├── dto/
│   │       │       ├── interfaces/
│   │       │       ├── providers/
│   │       │       ├── environmental-aggregation.service.ts
│   │       │       ├── navigation.controller.ts
│   │       │       ├── navigation.module.ts
│   │       │       ├── navigation.service.ts
│   │       │       ├── route-baseline-scorer.service.ts
│   │       │       ├── route-comparison-row.service.ts
│   │       │       ├── route-feature-extractor.service.ts
│   │       │       ├── route-recommendation.service.ts
│   │       │       └── route-sampling.service.ts
│   │       ├── app.module.ts
│   │       └── main.ts
│   └── web/
│       └── src/
│           ├── app/
│           ├── components/
│           ├── config/
│           └── lib/
├── packages/
│   └── contracts/
├── package.json
├── pnpm-lock.yaml
└── pnpm-workspace.yaml
```

## Prerequisites

Install:

- Node.js 20 or newer;
- pnpm 11.13.1;
- a Mapbox access token;
- Git;
- Visual Studio Code.

Verify your versions:

```bash
node --version
pnpm --version
git --version
```

If pnpm is unavailable:

```bash
corepack enable
corepack prepare pnpm@11.13.1 --activate
```

## Installation

From the project directory:

```bash
cd /Users/imran/Desktop/ICF/mindroute
pnpm install
```

## Environment Configuration

### Backend

Create the backend environment file:

```bash
cp apps/api/.env.example apps/api/.env
```

Configure `apps/api/.env`:

```env
NODE_ENV=development
PORT=3001
FRONTEND_URL=http://localhost:3000
MAPBOX_ACCESS_TOKEN=pk.your_mapbox_access_token
```

### Frontend

Create `apps/web/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_APP_ENV=development
NEXT_PUBLIC_MAPBOX_TOKEN=pk.your_mapbox_access_token
```

Do not commit real access tokens.

## Running the Project

Run both applications:

```bash
pnpm dev
```

Run only the API:

```bash
pnpm --filter api dev
```

Run only the frontend:

```bash
pnpm --filter web dev
```

Local URLs:

- Frontend: `http://localhost:3000`
- API: `http://localhost:3001/api`
- Health endpoint: `http://localhost:3001/api/health`

## Common Commands

| Command | Purpose |
|---|---|
| `pnpm install` | Install all dependencies |
| `pnpm dev` | Run frontend and API |
| `pnpm dev:web` | Run the frontend |
| `pnpm dev:api` | Run the API |
| `pnpm build` | Build all workspaces |
| `pnpm lint` | Lint all workspaces |
| `pnpm test` | Run tests |
| `pnpm --filter api build` | Build only the API |
| `pnpm --filter api lint` | Lint only the API |
| `pnpm --filter api test` | Run API tests |
| `pnpm --filter api exec prettier --write src/modules/navigation/<file>` | Format a navigation file |

Before committing:

```bash
pnpm lint
pnpm build
pnpm test
```

## Navigation Endpoint

```http
GET /api/navigation/routes
```

Required query parameters:

| Parameter | Description |
|---|---|
| `originLat` | Origin latitude |
| `originLng` | Origin longitude |
| `destinationLat` | Destination latitude |
| `destinationLng` | Destination longitude |

Example:

```bash
BASE="$(printf '%s' 'http' '://localhost:3001')"

curl -s "${BASE}/api/navigation/routes?originLat=37.7749&originLng=-122.4194&destinationLat=37.7849&destinationLng=-122.4094" \
  | python3 -m json.tool
```

## Navigation Processing Flow

```text
Origin and destination coordinates
        ↓
Mapbox walking-directions request
        ↓
Up to three candidate routes
        ↓
Normalize geometry, steps, maneuvers, and intersections
        ↓
Extract navigation-complexity features
        ↓
Sample route approximately every 100 meters
        ↓
Request environmental context from OpenStreetMap
        ↓
Use marked mock fallback if OpenStreetMap fails
        ↓
Aggregate observations into route-level features
        ↓
Create a flat RouteComparisonRow
        ↓
Calculate rule-based cognitive-load and comfort scores
        ↓
Rank routes by final score
        ↓
Assign recommendation labels and explanations
        ↓
Return analyzed routes to the frontend
```

## Candidate Route Generation

Mapbox generates the routes. The AI does not generate street geometry.

The backend requests:

```text
alternatives=true
geometries=geojson
overview=full
steps=true
language=en
annotations=distance,duration
```

Mapbox does not guarantee that multiple walking alternatives will always be returned. Some requests may return only one route.

## Navigation Feature Extraction

The `RouteFeatureExtractorService` calculates:

- distance;
- duration;
- detour percentage;
- turn count;
- sharp-turn count;
- decision-point count;
- instruction density per kilometer;
- average segment length;
- short-segment count;
- route straightness;
- crossing count;
- signalized crossing count;
- unsignalized crossing count;
- complex-intersection count;
- crossing complexity.

Crossings are currently detected from route instructions and street names containing terms such as `crosswalk`.

## Route Sampling

The `RouteSamplingService` samples points along each route approximately every 100 meters.

Each sample includes:

```ts
{
  id: string;
  routeId: string;
  coordinate: [number, number];
  distanceFromStartMeters: number;
  segmentIndex: number;
}
```

Sampling allows environmental information to be collected at multiple locations rather than using only the route origin or destination.

## Environmental Data

Environmental feature types currently include:

- shade;
- greenery;
- parks;
- pedestrian density;
- traffic;
- noise;
- commercial activity;
- construction;
- events;
- points of interest.

### OpenStreetMap provider

The `OpenStreetMapEnvironmentalProvider` sends bounding-box queries to public Overpass servers and converts nearby OpenStreetMap elements into environmental observations.

The current prototype uses OpenStreetMap to estimate features such as:

- greenery;
- parks;
- points of interest;
- commercial activity;
- road-based traffic exposure.

Public Overpass instances can return rate-limit or availability errors such as:

```text
429 Too Many Requests
406 Not Acceptable
network request failures
```

### Mock fallback

If all OpenStreetMap requests fail, the API uses `MockEnvironmentalProvider`.

Fallback observations are explicitly marked:

```json
{
  "source": "mock"
}
```

The route is also marked:

```json
{
  "environmentalDataStatus": "fallback"
}
```

This prevents later systems from treating mock values as verified real-world observations.

Possible environmental statuses are:

```ts
'real'
'partial'
'fallback'
'unavailable'
```

## Environmental Aggregation

The `EnvironmentalAggregationService` combines sample-level observations using confidence-weighted averages.

The route-level environmental summary includes:

- estimated shade exposure;
- greenery exposure;
- park exposure;
- pedestrian density;
- traffic exposure;
- noise exposure;
- commercial activity exposure;
- construction exposure;
- event exposure;
- point-of-interest density;
- data confidence;
- sample count;
- observation count.

## Route Comparison Row

`RouteComparisonRowService` converts a fully analyzed route into one flat model-ready row.

The comparison row contains:

- navigation features;
- crossing features;
- environmental features;
- data confidence;
- environmental data status.

It intentionally excludes:

- GeoJSON geometry;
- individual sample coordinates;
- raw environmental observations;
- navigation instructions;
- frontend-only presentation data.

This flat structure will later be sent to the Python AI service.

## Rule-Based Baseline Scoring

The current ranking system is deterministic and is implemented in `RouteBaselineScorerService`.

It calculates five components:

1. navigation complexity;
2. crossing complexity;
3. environmental strain;
4. route efficiency;
5. environmental comfort.

The returned score contains:

```ts
{
  cognitiveLoadScore: number;
  comfortScore: number;
  finalScore: number;

  breakdown: {
    navigationComplexity: number;
    crossingComplexity: number;
    environmentalStrain: number;
    routeEfficiency: number;
    environmentalComfort: number;
  };

  scoringMethod: 'rule-based-v1';
}
```

Scores are limited to the range `0–100`.

A lower `finalScore` represents a route that is estimated to impose less cognitive burden.

Fallback environmental data receives reduced influence through a confidence multiplier.

## Ranking

After every route is analyzed and scored, routes are sorted by:

```ts
route.score.finalScore
```

Ascending order is used:

```text
lowest final score → highest final score
```

Rank values begin at `1`.

```json
{
  "rank": 1
}
```

## Route Recommendations

`RouteRecommendationService` assigns one or more labels:

- `Best overall`
- `Lowest cognitive load`
- `Most comfortable`
- `Fastest`
- `Alternative`

A route may receive multiple labels. For example, when Mapbox returns only one route, that route may be:

```json
{
  "labels": [
    "Best overall",
    "Lowest cognitive load",
    "Most comfortable",
    "Fastest"
  ],
  "primaryLabel": "Best overall"
}
```

The recommendation also includes a brief explanation.

## Example Route Response Structure

```json
{
  "id": "route-1",
  "rank": 1,
  "distanceMeters": 1493,
  "durationSeconds": 1082,
  "geometry": {
    "type": "LineString",
    "coordinates": []
  },
  "features": {},
  "environmentalSummary": {},
  "environmentalDataStatus": "fallback",
  "comparisonRow": {},
  "score": {
    "cognitiveLoadScore": 0,
    "comfortScore": 0,
    "finalScore": 0,
    "breakdown": {},
    "scoringMethod": "rule-based-v1"
  },
  "recommendation": {
    "primaryLabel": "Best overall",
    "labels": [
      "Best overall"
    ],
    "explanation": "Ranked first with a final score of 0."
  },
  "samples": [],
  "sampleEnvironments": [],
  "instructions": []
}
```

## Inspecting Route Scores

```bash
BASE="$(printf '%s' 'http' '://localhost:3001')"

curl -s "${BASE}/api/navigation/routes?originLat=37.7749&originLng=-122.4194&destinationLat=37.7849&destinationLng=-122.4094" \
  | python3 -c '
import json
import sys

routes = json.load(sys.stdin)

for route in routes:
    print({
        "rank": route["rank"],
        "id": route["id"],
        "finalScore": route["score"]["finalScore"],
        "cognitiveLoadScore": route["score"]["cognitiveLoadScore"],
        "comfortScore": route["score"]["comfortScore"],
        "labels": route["recommendation"]["labels"],
        "dataStatus": route["environmentalDataStatus"],
    })
'
```

## Testing

Baseline-scorer tests should verify:

- all scores remain between 0 and 100;
- complex routes score higher than simple routes;
- routes with more shade and greenery receive higher comfort scores;
- fallback environmental data receives less influence than verified data.

Recommendation tests should verify:

- an empty route list returns an empty array;
- the rank-one route receives `Best overall`;
- the lowest cognitive-load route is identified;
- the route with the highest comfort score is identified;
- the shortest-duration route receives `Fastest`;
- unmatched routes receive `Alternative`.

Run navigation tests:

```bash
pnpm --filter api test
```

Run a specific test:

```bash
pnpm --filter api test -- route-baseline-scorer.service.spec.ts
```

```bash
pnpm --filter api test -- route-recommendation.service.spec.ts
```

## Current Limitations

- Mapbox may return only one walking route.
- OpenStreetMap Overpass servers can be rate limited or unavailable.
- Mock fallback values are synthetic and must not be treated as real measurements.
- Pedestrian density, noise, events, and construction still need stronger real-world data sources.
- Environmental estimates are route-level approximations.
- The scoring weights have not yet been validated through a user study.
- No AI model is currently making route decisions.
- No persistent user-feedback or route-training database exists yet.
- The frontend still needs to present the new score breakdowns and recommendation labels clearly.
- The scoring system is not medical or diagnostic.

## AI Boundary

The current project is intentionally **pre-AI**.

The AI will not:

- generate roads;
- invent route geometry;
- replace Mapbox directions;
- directly consume raw GeoJSON;
- treat mock environmental data as verified data.

The future AI model will receive one `RouteComparisonRow` per candidate route and predict preference or cognitive burden using validated training data.

## Next Step: AI Training Records

This step has not been implemented yet.

The next planned work is to create a training-record format that combines:

- the route comparison row;
- baseline scores;
- route rank;
- whether the user selected the route;
- optional user feedback such as preferred, acceptable, or avoided;
- environmental data status;
- scoring method;
- generation timestamp.

The planned records will exclude raw geometry and instructions.

After the training-record format is implemented, the following steps are expected:

1. add a feedback endpoint;
2. persist route comparisons and selections;
3. export training rows;
4. build a Python FastAPI service;
5. train an XGBoost baseline;
6. compare AI results against the deterministic scorer;
7. add personalized preference weights;
8. evaluate the system with users.

## Troubleshooting

### API port 3001 is already in use

```bash
lsof -i :3001
```

Stop the process:

```bash
lsof -ti :3001 | xargs kill -9
```

Restart:

```bash
pnpm --filter api dev
```

### Frontend port 3000 is already in use

```bash
lsof -i :3000
```

Stop the process or run Next.js on another port.

### Mapbox is not configured

Confirm `apps/api/.env` contains:

```env
MAPBOX_ACCESS_TOKEN=pk.your_real_token
```

### OpenStreetMap requests fail

The API should continue by using the mock fallback.

Confirm the route response contains:

```json
{
  "environmentalDataStatus": "fallback"
}
```

and observations contain:

```json
{
  "source": "mock"
}
```

### Build passes but lint fails

Format the reported file:

```bash
pnpm --filter api exec prettier \
  --write src/modules/navigation/<file-name>.ts
```

Then run:

```bash
pnpm --filter api lint
```

### Stop and restart the API

```bash
lsof -ti :3001 | xargs kill -9 2>/dev/null
pnpm --filter api dev
```

## Git Workflow

Before committing:

```bash
git status
pnpm --filter api build
pnpm --filter api lint
pnpm --filter api test
```

Stage the intended files:

```bash
git add README.md apps/api/src/modules/navigation
```

Commit:

```bash
git commit -m "build pre-AI route analysis and ranking pipeline"
```

Push:

```bash
git push
```

## Project Goal

MindRoute is not intended to be simply another map application. Its purpose is to investigate how navigation systems can account for cognitive effort, environmental strain, route clarity, and user comfort—not only travel time.

The long-term goal is a transparent, privacy-conscious, and human-centered system that recommends routes while explaining why one route may be easier to follow than another.
