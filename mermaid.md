# MindRoute Architecture and Function Flow

This file contains Mermaid diagrams for the current MindRoute architecture and the intended adaptive-navigation pipeline.

## System Architecture

```mermaid
flowchart LR
    U[User] --> W[Next.js Web App]

    subgraph Frontend[apps/web]
        W --> UI[MindRoute Interface]
        UI --> FS[Feature Services]
        FS --> AC[Reusable API Client]
        ENVW[.env.local] --> W
    end

    AC -->|HTTP JSON| API[NestJS API]

    subgraph Backend[apps/api]
        API --> SEC[Helmet and CORS]
        SEC --> VP[Validation Pipe]
        VP --> CTRL[Controllers]
        CTRL --> SVC[Services]
        ENVA[.env] --> CFG[ConfigModule and Joi Validation]
        CFG --> API
        SVC --> MB[Mapbox APIs]
    end

    subgraph Shared[packages/contracts]
        LC[Location Contracts]
        RC[Route Contracts]
        PC[Preference Contracts]
        CC[Cognitive Burden Contracts]
    end

    Frontend -. shared TypeScript types .-> Shared
    Backend -. shared TypeScript types .-> Shared
```

## Development Startup Flow

```mermaid
sequenceDiagram
    actor Developer
    participant PNPM as pnpm workspace
    participant Web as Next.js Web
    participant API as NestJS API
    participant Config as Environment Validation

    Developer->>PNPM: pnpm dev
    par Start frontend
        PNPM->>Web: pnpm --filter web dev
        Web-->>Developer: Listening on localhost:3000
    and Start backend
        PNPM->>API: pnpm --filter api start:dev
        API->>Config: Load and validate .env
        alt Environment valid
            Config-->>API: Valid configuration
            API-->>Developer: Listening on localhost:3001
        else Environment invalid
            Config-->>Developer: Startup validation error
        end
    end
```

## Health Check Flow

```mermaid
sequenceDiagram
    actor Client
    participant Web as Frontend Service
    participant ApiClient as apiRequest
    participant Controller as HealthController
    participant Service as HealthService

    Client->>Web: Check API status
    Web->>ApiClient: getApiHealth()
    ApiClient->>Controller: GET /api/health
    Controller->>Service: getHealth()
    Service-->>Controller: status, version, timestamp, uptime
    Controller-->>ApiClient: JSON response
    ApiClient-->>Web: Typed HealthResponse
    Web-->>Client: API status
```

## Intended Adaptive Navigation Flow

```mermaid
flowchart TD
    A[User enters destination] --> B[Frontend validates query]
    B --> C[GET locations search]
    C --> D[Backend location controller]
    D --> E[Mapbox geocoding request]
    E --> F[Normalized LocationResult list]
    F --> G[User selects destination]
    G --> H[Frontend requests route alternatives]
    H --> I[Navigation controller]
    I --> J[Directions service]
    J --> K[Mapbox Directions API]
    K --> L[Route geometry and instructions]
    L --> M[Route feature extraction]

    M --> M1[Turn count]
    M --> M2[Decision points]
    M --> M3[Crossings]
    M --> M4[Instruction density]
    M --> M5[Route straightness]

    M1 --> N[Cognitive burden scoring]
    M2 --> N
    M3 --> N
    M4 --> N
    M5 --> N

    P[User preference profile] --> N
    N --> O[Low, moderate, or high burden]
    O --> Q[Rank route alternatives]
    Q --> R[Generate recommendation explanation]
    R --> S[Display recommended route on map]
```

## Backend Request Pipeline

```mermaid
flowchart LR
    REQ[Incoming Request] --> HELMET[Helmet Security Headers]
    HELMET --> CORS[CORS Origin Check]
    CORS --> PREFIX[/api Global Prefix]
    PREFIX --> VALIDATE[ValidationPipe]
    VALIDATE --> CONTROLLER[Controller]
    CONTROLLER --> SERVICE[Service]
    SERVICE --> RESPONSE[Typed JSON Response]

    CORS -->|Origin rejected| E1[CORS Error]
    VALIDATE -->|Invalid payload| E2[400 Validation Error]
    SERVICE -->|External API fails| E3[Service Error]
```

## Shared Contract Relationships

```mermaid
classDiagram
    class Coordinates {
        +number latitude
        +number longitude
    }

    class LocationResult {
        +string id
        +string name
        +string fullAddress
        +Coordinates coordinates
    }

    class RouteSummary {
        +string routeId
        +number distanceMeters
        +number durationSeconds
        +Coordinates[] geometry
    }

    class RouteFeatures {
        +number turnCount
        +number decisionPointCount
        +number crossingCount
        +number instructionDensity
        +number routeStraightness
    }

    class CognitiveBurdenPrediction {
        +string routeId
        +number score
        +low|moderate|high level
        +number confidence
        +string explanation
    }

    class UserPreferenceProfile {
        +1 profileVersion
        +number timeSensitivity
        +number turnSensitivity
        +number decisionPointSensitivity
        +number crowdSensitivity
        +number crossingSensitivity
        +number noiseSensitivity
        +number maximumDetourPercent
    }

    LocationResult --> Coordinates
    RouteSummary --> Coordinates
    RouteSummary --> RouteFeatures : analyzed into
    RouteFeatures --> CognitiveBurdenPrediction : contributes to
    UserPreferenceProfile --> CognitiveBurdenPrediction : personalizes
```

## Current Uploaded-ZIP Dependency Gap

```mermaid
flowchart TD
    APP[AppModule] --> H[HealthModule present]
    APP --> L[LocationsModule referenced but missing]
    APP --> N[NavigationModule referenced but missing]

    PAGE[page.tsx] --> M[MindRouteApp referenced but missing]

    L --> FAIL[TypeScript build failure]
    N --> FAIL
    M --> FAIL

    RESTORE[Restore files from fuller local copy] --> READY[Application can compile]
    READY --> RUN[pnpm dev]
```
