# MindRoute

MindRoute is an AI-powered adaptive navigation prototype designed to reduce cognitive load during navigation, especially for users with ADHD. The project is structured as a TypeScript monorepo with a Next.js frontend, a NestJS backend, and a shared contracts package.

## Project Status

The current project establishes the foundation for:

- location search and geocoding;
- route retrieval and display;
- route-feature extraction;
- cognitive-burden scoring;
- user-sensitive route recommendations;
- a simplified adaptive map interface.

The uploaded project includes the monorepo configuration, environment validation, API security/configuration, health endpoint, frontend API client, and shared domain contracts.

> **Important:** The uploaded ZIP references `LocationsModule`, `NavigationModule`, and `MindRouteApp`, but their source files are not included in the ZIP. The fuller local project discussed during development may already contain them. The uploaded copy will not build until those missing files are restored or their imports are temporarily removed.

## Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | Next.js 16, React 19, TypeScript | Web application and adaptive navigation interface |
| Styling | Tailwind CSS 4 | Interface styling |
| Mapping | Mapbox GL JS | Map rendering and route visualization |
| Backend | NestJS 11, TypeScript | API, validation, navigation orchestration, and external service access |
| Validation | Joi, class-validator, class-transformer | Environment and request validation |
| Security | Helmet and CORS | HTTP security headers and frontend origin control |
| Shared types | `@mindroute/contracts` | Domain contracts shared across applications |
| Package manager | pnpm 11.13.1 | Monorepo dependency and script management |

## Repository Structure

```text
mindroute/
├── apps/
│   ├── api/                         # NestJS backend
│   │   ├── src/
│   │   │   ├── config/              # Runtime configuration and env validation
│   │   │   ├── modules/
│   │   │   │   └── health/          # API health endpoint
│   │   │   ├── app.module.ts
│   │   │   └── main.ts
│   │   ├── .env.example
│   │   └── package.json
│   └── web/                         # Next.js frontend
│       ├── src/
│       │   ├── app/                 # App Router pages and global styles
│       │   ├── config/              # Browser environment configuration
│       │   ├── features/health/     # Health API feature
│       │   └── lib/                 # Reusable API client
│       └── package.json
├── packages/
│   └── contracts/                   # Shared TypeScript domain interfaces
│       └── src/
│           ├── location/
│           ├── prediction/
│           ├── profile/
│           └── route/
├── package.json                     # Root scripts
├── pnpm-lock.yaml
└── pnpm-workspace.yaml
```

## Prerequisites

Install the following before starting:

- Node.js 20 or newer;
- pnpm 11.13.1;
- a Mapbox access token;
- Visual Studio Code.

Check your versions:

```bash
node --version
pnpm --version
```

When pnpm is unavailable, enable Corepack and activate the project version:

```bash
corepack enable
corepack prepare pnpm@11.13.1 --activate
```

## Setup

### 1. Open the project in VS Code

```bash
cd /Users/imran/Desktop/ICF/mindroute
code .
```

If the folder is elsewhere, replace the path with the location of your MindRoute folder.

### 2. Install dependencies

Run this from the repository root—the folder containing the root `package.json` and `pnpm-workspace.yaml`:

```bash
pnpm install
```

### 3. Configure the backend environment

```bash
cp apps/api/.env.example apps/api/.env
```

Open `apps/api/.env` and configure:

```env
NODE_ENV=development
PORT=3001
FRONTEND_URL=http://localhost:3000
MAPBOX_ACCESS_TOKEN=pk.your_mapbox_access_token
```

`MAPBOX_ACCESS_TOKEN` is required by the backend environment-validation schema. The API will stop during startup when the token is absent or too short.

### 4. Configure the frontend environment

Create `apps/web/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_APP_ENV=development
NEXT_PUBLIC_MAPBOX_TOKEN=pk.your_mapbox_access_token
```

Only variables beginning with `NEXT_PUBLIC_` are available in browser-side Next.js code.

## Run MindRoute

### Run the entire application

From the repository root:

```bash
pnpm dev
```

This command runs the web and API workspaces in parallel.

Expected local URLs:

- Frontend: `http://localhost:3000`
- Backend base URL: `http://localhost:3001/api`
- API health check: `http://localhost:3001/api/health`

### Run each application separately

Backend terminal:

```bash
pnpm dev:api
```

Frontend terminal:

```bash
pnpm dev:web
```

Running them separately is useful when reading logs or debugging one side of the application.

## Common Commands

| Command | Purpose |
|---|---|
| `pnpm install` | Install all workspace dependencies |
| `pnpm dev` | Run frontend and backend together |
| `pnpm dev:web` | Run only the Next.js frontend |
| `pnpm dev:api` | Run only the NestJS backend |
| `pnpm build` | Build all workspaces |
| `pnpm lint` | Lint all workspaces |
| `pnpm test` | Run available workspace tests |
| `pnpm --filter api test:e2e` | Run backend end-to-end tests |
| `pnpm --filter api format` | Format backend TypeScript files |
| `pnpm --filter web build` | Build only the frontend |
| `pnpm --filter api build` | Build only the backend |

## Application Flow

### Current foundation flow

1. The developer runs `pnpm dev` from the monorepo root.
2. pnpm starts the `web` and `api` workspace development servers in parallel.
3. NestJS loads and validates the backend environment variables.
4. NestJS registers the global `/api` prefix, Helmet, CORS, validation pipes, and shutdown hooks.
5. Next.js loads browser configuration from `apps/web/src/config/env.ts`.
6. Frontend service functions call the reusable API client.
7. The API client sends requests to `NEXT_PUBLIC_API_URL`.
8. NestJS controllers receive requests and call their services.
9. Services return typed JSON responses to the frontend.

### Health-check flow

```text
Browser or frontend
    → GET /api/health
    → HealthController.getHealth()
    → HealthService.getHealth()
    → JSON health status
```

The health response includes:

- service status;
- service name;
- application version;
- server timestamp;
- process uptime.

### Intended navigation flow

```text
User enters a destination
    → frontend requests location search
    → backend geocodes the query through Mapbox
    → user selects a location
    → frontend requests route alternatives
    → backend retrieves route geometry and instructions
    → route features are extracted
    → cognitive-burden score is calculated
    → routes are ranked using user preferences
    → frontend displays the recommended route and explanation
```

## Shared Domain Contracts

The `packages/contracts` workspace defines the data model expected across the frontend, backend, and future AI service.

### Location

- `Coordinates`
- `LocationResult`

### Route

- `RouteSummary`
- `RouteFeatures`

Current route features include:

- turn count;
- decision-point count;
- crossing count;
- instruction density;
- route straightness.

### Cognitive burden

- `CognitiveBurdenLevel`: `low`, `moderate`, or `high`;
- numeric score;
- confidence;
- optional explanation.

### User preference profile

The profile supports sensitivity values for:

- time;
- turns;
- decision points;
- crowds;
- crossings;
- noise;
- maximum acceptable detour percentage.

## What Has Been Implemented

### Monorepo foundation

- pnpm workspace configuration;
- root scripts for development, build, lint, and test;
- separate frontend, backend, and contracts workspaces.

### Backend foundation

- NestJS application bootstrap;
- global `/api` prefix;
- runtime environment validation with Joi;
- Helmet security headers;
- configurable CORS allowlist;
- global request validation and transformation;
- graceful shutdown hooks;
- health controller and service;
- Mapbox token configuration placeholder.

### Frontend foundation

- Next.js App Router project;
- TypeScript and Tailwind configuration;
- Mapbox GL JS dependency;
- typed environment configuration;
- reusable JSON API client;
- custom `ApiError` handling;
- typed API health service.

### Shared architecture

- location types;
- route summary and feature types;
- cognitive-burden prediction types;
- user preference profile types.

### Discussed/partially developed beyond this ZIP

During later development, the project also included or discussed:

- location-search endpoints;
- navigation modules;
- a `MindRouteApp` map component;
- Mapbox search and routing integration;
- route visualization;
- cognitive-load-oriented route features;
- adaptive navigation recommendations.

These files are referenced by the uploaded code but are missing from this particular archive.

## API Endpoints

### Available in the uploaded source

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/health` | Verify that the API is running |

### Referenced in later development

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/locations/search?query=...` | Search for a destination |
| Navigation endpoint | Project-dependent | Retrieve and compare routes |

The exact navigation endpoint should be confirmed from the restored `navigation` controller.

## Troubleshooting

### `Cannot find module './modules/locations/locations.module'`

The uploaded ZIP is missing the `apps/api/src/modules/locations` directory. Restore it from your fuller local branch or remove the import and `LocationsModule` entry temporarily.

### `Cannot find module './modules/navigation/navigation.module'`

The uploaded ZIP is missing the `apps/api/src/modules/navigation` directory. Restore it from your fuller local branch or remove the import and `NavigationModule` entry temporarily.

### `Cannot find module '@/components/mindroute-app'`

The uploaded ZIP is missing `apps/web/src/components/mindroute-app.tsx`. Restore the component from your fuller local project.

### Mapbox token validation error

Make sure `apps/api/.env` exists and contains a real token:

```env
MAPBOX_ACCESS_TOKEN=pk.your_real_token
```

Also place the public token in `apps/web/.env.local`:

```env
NEXT_PUBLIC_MAPBOX_TOKEN=pk.your_real_token
```

### Frontend port 3000 is already in use

Find the process:

```bash
lsof -i :3000
```

Stop it using its PID:

```bash
kill <PID>
```

Or run the web app on another port:

```bash
pnpm --filter web dev -- -p 3002
```

Then update the backend CORS value:

```env
FRONTEND_URL=http://localhost:3002
```

### API port 3001 is already in use

```bash
lsof -i :3001
kill <PID>
```

Alternatively change `PORT` in `apps/api/.env` and update `NEXT_PUBLIC_API_URL` in `apps/web/.env.local`.

### `502 Bad Gateway` during location search

Check:

1. the API terminal for the underlying error;
2. that the Mapbox token is valid;
3. that the API is running on the same port configured in `NEXT_PUBLIC_API_URL`;
4. that location module files are present;
5. that the external Mapbox request is correctly constructed.

### Favicon 404

A missing favicon does not stop the application. Add a favicon file under the Next.js `app` directory when needed.

## Build Verification

Run these before committing:

```bash
pnpm lint
pnpm build
pnpm test
```

To isolate failures:

```bash
pnpm --filter api lint
pnpm --filter api build
pnpm --filter web lint
pnpm --filter web build
```

## Development Direction

The next technical milestones are:

1. restore and verify the location and navigation modules;
2. restore the main map component;
3. connect Mapbox geocoding and directions reliably;
4. calculate route features from returned routes;
5. implement a baseline cognitive-burden scoring function;
6. rank routes using user preferences;
7. explain why a route is cognitively easier;
8. add tests for controllers, services, API errors, and route scoring;
9. add PostgreSQL/PostGIS when route and evaluation data require persistence;
10. integrate an AI service after the deterministic baseline is validated.

## Project Goal

MindRoute is not intended to be only another map application. Its goal is to investigate how navigation systems can account for cognitive effort—not just travel time—and present route information in a calmer, more accessible, and more personalized way.
