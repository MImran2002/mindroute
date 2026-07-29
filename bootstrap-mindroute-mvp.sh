#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="${1:-/Users/imran/Desktop/ICF/mindroute}"
cd "$PROJECT_ROOT"

echo "Updating MindRoute MVP in $PROJECT_ROOT"

mkdir -p \
  apps/api/src/config \
  apps/api/src/modules/health \
  apps/api/src/modules/locations/dto \
  apps/api/src/modules/navigation/dto \
  apps/web/src/components \
  apps/web/src/config \
  apps/web/src/features/health/services \
  apps/web/src/lib

cat > package.json <<'EOF'
{
  "name": "mindroute",
  "version": "0.1.0",
  "private": true,
  "packageManager": "pnpm@11.13.1",
  "scripts": {
    "dev": "pnpm --parallel --filter api --filter web dev",
    "dev:web": "pnpm --filter web dev",
    "dev:api": "pnpm --filter api start:dev",
    "build": "pnpm --recursive run build",
    "lint": "pnpm --recursive run lint",
    "test": "pnpm --recursive run test --if-present"
  }
}
EOF

cat > apps/api/package.json <<'EOF'
{
  "name": "api",
  "version": "0.1.0",
  "private": true,
  "license": "MIT",
  "scripts": {
    "dev": "nest start --watch",
    "build": "nest build",
    "format": "prettier --write \"src/**/*.ts\" \"test/**/*.ts\"",
    "start": "nest start",
    "start:dev": "nest start --watch",
    "start:prod": "node dist/main.js",
    "lint": "eslint \"{src,test}/**/*.ts\"",
    "test": "jest --passWithNoTests",
    "test:e2e": "jest --config ./test/jest-e2e.json"
  },
  "dependencies": {
    "@nestjs/common": "^11.0.1",
    "@nestjs/config": "^4.0.4",
    "@nestjs/core": "^11.0.1",
    "@nestjs/platform-express": "^11.0.1",
    "class-transformer": "^0.5.1",
    "class-validator": "^0.15.1",
    "helmet": "^8.1.0",
    "joi": "^18.2.3",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.1"
  },
  "devDependencies": {
    "@eslint/eslintrc": "^3.2.0",
    "@eslint/js": "^9.18.0",
    "@nestjs/cli": "^11.0.0",
    "@nestjs/schematics": "^11.0.0",
    "@nestjs/testing": "^11.0.1",
    "@types/express": "^5.0.0",
    "@types/jest": "^30.0.0",
    "@types/node": "^24.0.0",
    "@types/supertest": "^7.0.0",
    "eslint": "^9.18.0",
    "eslint-config-prettier": "^10.0.1",
    "eslint-plugin-prettier": "^5.2.2",
    "globals": "^17.0.0",
    "jest": "^30.0.0",
    "prettier": "^3.4.2",
    "source-map-support": "^0.5.21",
    "supertest": "^7.0.0",
    "ts-jest": "^29.2.5",
    "ts-loader": "^9.5.2",
    "ts-node": "^10.9.2",
    "tsconfig-paths": "^4.2.0",
    "typescript": "^5.7.3",
    "typescript-eslint": "^8.20.0"
  },
  "jest": {
    "moduleFileExtensions": ["js", "json", "ts"],
    "rootDir": "src",
    "testRegex": ".*\\.spec\\.ts$",
    "transform": {"^.+\\.(t|j)s$": "ts-jest"},
    "collectCoverageFrom": ["**/*.(t|j)s"],
    "coverageDirectory": "../coverage",
    "testEnvironment": "node"
  }
}
EOF

cat > apps/api/.env.example <<'EOF'
NODE_ENV=development
PORT=3001
FRONTEND_URL=http://localhost:3000
MAPBOX_ACCESS_TOKEN=pk.replace_with_your_mapbox_public_token
EOF

cat > apps/api/src/config/app.config.ts <<'EOF'
export default () => ({
  environment: process.env.NODE_ENV ?? 'development',
  server: {
    port: Number(process.env.PORT ?? 3001),
  },
  frontend: {
    urls: (process.env.FRONTEND_URL ?? 'http://localhost:3000')
      .split(',')
      .map((url) => url.trim())
      .filter(Boolean),
  },
  mapbox: {
    accessToken: process.env.MAPBOX_ACCESS_TOKEN ?? '',
  },
});
EOF

cat > apps/api/src/config/env.validation.ts <<'EOF'
import * as Joi from 'joi';

export const environmentValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'staging', 'production')
    .default('development'),
  PORT: Joi.number().port().default(3001),
  FRONTEND_URL: Joi.string().default('http://localhost:3000'),
  MAPBOX_ACCESS_TOKEN: Joi.string().min(20).required(),
});
EOF

cat > apps/api/src/app.module.ts <<'EOF'
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import appConfig from './config/app.config';
import { environmentValidationSchema } from './config/env.validation';
import { HealthModule } from './modules/health/health.module';
import { LocationsModule } from './modules/locations/locations.module';
import { NavigationModule } from './modules/navigation/navigation.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [appConfig],
      validationSchema: environmentValidationSchema,
    }),
    HealthModule,
    LocationsModule,
    NavigationModule,
  ],
})
export class AppModule {}
EOF

cat > apps/api/src/main.ts <<'EOF'
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const port = config.get<number>('server.port', 3001);
  const allowedOrigins = config.get<string[]>('frontend.urls', [
    'http://localhost:3000',
  ]);

  app.setGlobalPrefix('api');
  app.use(helmet());
  app.enableCors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`Origin ${origin} is not allowed by CORS`), false);
    },
    methods: ['GET', 'POST', 'OPTIONS'],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.enableShutdownHooks();

  await app.listen(port, '0.0.0.0');
  console.log(`MindRoute API listening on port ${port}`);
}

void bootstrap();
EOF

cat > apps/api/src/modules/health/health.service.ts <<'EOF'
import { Injectable } from '@nestjs/common';

export interface HealthStatus {
  status: 'ok';
  service: string;
  version: string;
  timestamp: string;
  uptimeSeconds: number;
}

@Injectable()
export class HealthService {
  getHealth(): HealthStatus {
    return {
      status: 'ok',
      service: 'mindroute-api',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
    };
  }
}
EOF

cat > apps/api/src/modules/locations/dto/search-locations.dto.ts <<'EOF'
import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';

export class SearchLocationsDto {
  @Transform(({ value }) => String(value).trim())
  @IsString()
  @Length(2, 120)
  query!: string;
}
EOF

cat > apps/api/src/modules/locations/locations.service.ts <<'EOF'
import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface MapboxFeature {
  id: string;
  geometry?: { coordinates?: [number, number] };
  properties?: {
    full_address?: string;
    name?: string;
    place_formatted?: string;
  };
}

interface MapboxGeocodingResponse {
  features?: MapboxFeature[];
}

export interface LocationResult {
  id: string;
  name: string;
  fullAddress: string;
  latitude: number;
  longitude: number;
}

@Injectable()
export class LocationsService {
  constructor(private readonly config: ConfigService) {}

  async search(query: string): Promise<LocationResult[]> {
    const token = this.config.get<string>('mapbox.accessToken');
    if (!token) {
      throw new ServiceUnavailableException('Mapbox is not configured');
    }

    const params = new URLSearchParams({
      q: query,
      access_token: token,
      autocomplete: 'true',
      limit: '5',
      language: 'en',
      country: 'US',
      bbox: '-122.527,37.696,-122.348,37.833',
      proximity: '-122.4194,37.7749',
      types: 'address,street,place,poi',
    });

    let response: Response;
    try {
      response = await fetch(
        `https://api.mapbox.com/search/geocode/v6/forward?${params.toString()}`,
        { signal: AbortSignal.timeout(8000) },
      );
    } catch {
      throw new BadGatewayException('Unable to reach the location provider');
    }

    if (!response.ok) {
      throw new BadGatewayException('Location search failed');
    }

    const data = (await response.json()) as MapboxGeocodingResponse;

    return (data.features ?? [])
      .map((feature): LocationResult | null => {
        const coordinates = feature.geometry?.coordinates;
        if (!coordinates) return null;

        const name = feature.properties?.name ?? 'Unnamed location';
        const fullAddress =
          feature.properties?.full_address ??
          [name, feature.properties?.place_formatted].filter(Boolean).join(', ');

        return {
          id: feature.id,
          name,
          fullAddress,
          longitude: coordinates[0],
          latitude: coordinates[1],
        };
      })
      .filter((result): result is LocationResult => result !== null);
  }
}
EOF

cat > apps/api/src/modules/locations/locations.controller.ts <<'EOF'
import { Controller, Get, Query } from '@nestjs/common';
import { SearchLocationsDto } from './dto/search-locations.dto';
import { LocationsService, type LocationResult } from './locations.service';

@Controller('locations')
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Get('search')
  search(@Query() query: SearchLocationsDto): Promise<LocationResult[]> {
    return this.locationsService.search(query.query);
  }
}
EOF

cat > apps/api/src/modules/locations/locations.module.ts <<'EOF'
import { Module } from '@nestjs/common';
import { LocationsController } from './locations.controller';
import { LocationsService } from './locations.service';

@Module({
  controllers: [LocationsController],
  providers: [LocationsService],
})
export class LocationsModule {}
EOF

cat > apps/api/src/modules/navigation/dto/get-routes.dto.ts <<'EOF'
import { Type } from 'class-transformer';
import { IsLatitude, IsLongitude, IsNumber } from 'class-validator';

export class GetRoutesDto {
  @Type(() => Number)
  @IsNumber()
  @IsLatitude()
  originLat!: number;

  @Type(() => Number)
  @IsNumber()
  @IsLongitude()
  originLng!: number;

  @Type(() => Number)
  @IsNumber()
  @IsLatitude()
  destinationLat!: number;

  @Type(() => Number)
  @IsNumber()
  @IsLongitude()
  destinationLng!: number;
}
EOF

cat > apps/api/src/modules/navigation/navigation.service.ts <<'EOF'
import {
  BadGatewayException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { GetRoutesDto } from './dto/get-routes.dto';

interface MapboxRoute {
  distance: number;
  duration: number;
  geometry: {
    type: 'LineString';
    coordinates: [number, number][];
  };
  legs?: Array<{
    steps?: Array<{
      maneuver?: { instruction?: string };
      distance?: number;
      duration?: number;
    }>;
  }>;
}

interface DirectionsResponse {
  routes?: MapboxRoute[];
}

export interface WalkingRoute {
  id: string;
  distanceMeters: number;
  durationSeconds: number;
  geometry: { type: 'LineString'; coordinates: [number, number][] };
  instructions: Array<{
    instruction: string;
    distanceMeters: number;
    durationSeconds: number;
  }>;
}

@Injectable()
export class NavigationService {
  constructor(private readonly config: ConfigService) {}

  async getWalkingRoutes(input: GetRoutesDto): Promise<WalkingRoute[]> {
    const token = this.config.get<string>('mapbox.accessToken');
    if (!token) {
      throw new ServiceUnavailableException('Mapbox is not configured');
    }

    const coordinates = `${input.originLng},${input.originLat};${input.destinationLng},${input.destinationLat}`;
    const params = new URLSearchParams({
      access_token: token,
      alternatives: 'true',
      geometries: 'geojson',
      overview: 'full',
      steps: 'true',
      language: 'en',
    });

    let response: Response;
    try {
      response = await fetch(
        `https://api.mapbox.com/directions/v5/mapbox/walking/${coordinates}?${params.toString()}`,
        { signal: AbortSignal.timeout(10000) },
      );
    } catch {
      throw new BadGatewayException('Unable to reach the routing provider');
    }

    if (!response.ok) {
      throw new BadGatewayException('Walking route request failed');
    }

    const data = (await response.json()) as DirectionsResponse;
    if (!data.routes?.length) {
      throw new NotFoundException('No walking routes were found');
    }

    return data.routes.slice(0, 3).map((route, index) => ({
      id: `route-${index + 1}`,
      distanceMeters: route.distance,
      durationSeconds: route.duration,
      geometry: route.geometry,
      instructions: (route.legs ?? []).flatMap((leg) =>
        (leg.steps ?? []).map((step) => ({
          instruction: step.maneuver?.instruction ?? 'Continue',
          distanceMeters: step.distance ?? 0,
          durationSeconds: step.duration ?? 0,
        })),
      ),
    }));
  }
}
EOF

cat > apps/api/src/modules/navigation/navigation.controller.ts <<'EOF'
import { Controller, Get, Query } from '@nestjs/common';
import { GetRoutesDto } from './dto/get-routes.dto';
import {
  NavigationService,
  type WalkingRoute,
} from './navigation.service';

@Controller('navigation')
export class NavigationController {
  constructor(private readonly navigationService: NavigationService) {}

  @Get('routes')
  getRoutes(@Query() query: GetRoutesDto): Promise<WalkingRoute[]> {
    return this.navigationService.getWalkingRoutes(query);
  }
}
EOF

cat > apps/api/src/modules/navigation/navigation.module.ts <<'EOF'
import { Module } from '@nestjs/common';
import { NavigationController } from './navigation.controller';
import { NavigationService } from './navigation.service';

@Module({
  controllers: [NavigationController],
  providers: [NavigationService],
})
export class NavigationModule {}
EOF

cat > apps/web/package.json <<'EOF'
{
  "name": "web",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint"
  },
  "dependencies": {
    "mapbox-gl": "^3.16.0",
    "next": "16.2.10",
    "react": "19.2.4",
    "react-dom": "19.2.4"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "eslint": "^9",
    "eslint-config-next": "16.2.10",
    "tailwindcss": "^4",
    "typescript": "^5"
  }
}
EOF

cat > apps/web/.env.example <<'EOF'
NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_APP_ENV=development
NEXT_PUBLIC_MAPBOX_TOKEN=pk.replace_with_your_mapbox_public_token
EOF

cat > apps/web/src/config/env.ts <<'EOF'
export const env = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api',
  appEnvironment: process.env.NEXT_PUBLIC_APP_ENV ?? 'development',
  mapboxToken: process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '',
} as const;
EOF

cat > apps/web/src/lib/api-client.ts <<'EOF'
import { env } from '@/config/env';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiRequest<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${env.apiUrl}${path}`, {
      ...options,
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });
  } catch {
    throw new ApiError('The MindRoute API is unavailable.', 0);
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { message?: string | string[] }
      | null;
    const message = Array.isArray(payload?.message)
      ? payload.message.join(', ')
      : payload?.message;
    throw new ApiError(message ?? `Request failed (${response.status})`, response.status);
  }

  return response.json() as Promise<T>;
}
EOF

cat > apps/web/src/features/health/services/health.api.ts <<'EOF'
import { apiRequest } from '@/lib/api-client';

export interface HealthResponse {
  status: 'ok';
  service: string;
  version: string;
  timestamp: string;
  uptimeSeconds: number;
}

export function getApiHealth(): Promise<HealthResponse> {
  return apiRequest<HealthResponse>('/health');
}
EOF

cat > apps/web/src/components/mindroute-app.tsx <<'EOF'
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import mapboxgl, { GeoJSONSource, LngLatBounds } from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { env } from '@/config/env';
import { apiRequest } from '@/lib/api-client';
import { getApiHealth } from '@/features/health/services/health.api';

type Coordinates = { latitude: number; longitude: number };
type LocationResult = Coordinates & {
  id: string;
  name: string;
  fullAddress: string;
};
type WalkingRoute = {
  id: string;
  distanceMeters: number;
  durationSeconds: number;
  geometry: { type: 'LineString'; coordinates: [number, number][] };
  instructions: Array<{
    instruction: string;
    distanceMeters: number;
    durationSeconds: number;
  }>;
};

const SF_CENTER: [number, number] = [-122.4194, 37.7749];
const DEFAULT_ORIGIN: Coordinates = {
  latitude: 37.7749,
  longitude: -122.4194,
};

function formatDistance(meters: number): string {
  const miles = meters / 1609.344;
  return miles < 0.1 ? `${Math.round(meters)} m` : `${miles.toFixed(1)} mi`;
}

function formatDuration(seconds: number): string {
  return `${Math.max(1, Math.round(seconds / 60))} min`;
}

export default function MindRouteApp() {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const originMarker = useRef<mapboxgl.Marker | null>(null);
  const destinationMarker = useRef<mapboxgl.Marker | null>(null);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<LocationResult[]>([]);
  const [origin, setOrigin] = useState<Coordinates>(DEFAULT_ORIGIN);
  const [destination, setDestination] = useState<LocationResult | null>(null);
  const [routes, setRoutes] = useState<WalkingRoute[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [status, setStatus] = useState('Choose your starting point and destination.');
  const [isSearching, setIsSearching] = useState(false);
  const [isRouting, setIsRouting] = useState(false);
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);

  useEffect(() => {
    getApiHealth()
      .then(() => setApiOnline(true))
      .catch(() => setApiOnline(false));
  }, []);

  useEffect(() => {
    if (!mapContainer.current || mapRef.current || !env.mapboxToken) return;

    mapboxgl.accessToken = env.mapboxToken;
    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: SF_CENTER,
      zoom: 12.5,
    });
    map.addControl(new mapboxgl.NavigationControl(), 'top-right');
    map.addControl(new mapboxgl.ScaleControl({ unit: 'imperial' }), 'bottom-right');
    mapRef.current = map;

    return () => {
      originMarker.current?.remove();
      destinationMarker.current?.remove();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  const drawRoute = useCallback((route: WalkingRoute) => {
    const map = mapRef.current;
    if (!map) return;

    const apply = () => {
      const source = map.getSource('selected-route') as GeoJSONSource | undefined;
      const data: GeoJSON.Feature<GeoJSON.LineString> = {
        type: 'Feature',
        properties: {},
        geometry: route.geometry,
      };

      if (source) {
        source.setData(data);
      } else {
        map.addSource('selected-route', { type: 'geojson', data });
        map.addLayer({
          id: 'selected-route-line',
          type: 'line',
          source: 'selected-route',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': '#2563eb', 'line-width': 7, 'line-opacity': 0.9 },
        });
      }

      const bounds = new LngLatBounds();
      route.geometry.coordinates.forEach((coordinate) => bounds.extend(coordinate));
      map.fitBounds(bounds, { padding: 70, maxZoom: 16, duration: 700 });
    };

    if (map.isStyleLoaded()) apply();
    else map.once('load', apply);
  }, []);

  async function searchLocations(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedQuery = query.trim();
    if (trimmedQuery.length < 2) {
      setStatus('Enter at least two characters.');
      return;
    }

    setIsSearching(true);
    setStatus('Searching San Francisco…');
    try {
      const data = await apiRequest<LocationResult[]>(
        `/locations/search?query=${encodeURIComponent(trimmedQuery)}`,
      );
      setResults(data);
      setStatus(data.length ? 'Select a destination.' : 'No matching destinations found.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Search failed.');
    } finally {
      setIsSearching(false);
    }
  }

  function chooseDestination(location: LocationResult) {
    setDestination(location);
    setResults([]);
    setQuery(location.fullAddress);
    setRoutes([]);
    setSelectedRouteId(null);
    setStatus('Destination selected. Generate walking routes when ready.');

    const map = mapRef.current;
    if (!map) return;
    destinationMarker.current?.remove();
    destinationMarker.current = new mapboxgl.Marker({ color: '#dc2626' })
      .setLngLat([location.longitude, location.latitude])
      .addTo(map);
    map.flyTo({ center: [location.longitude, location.latitude], zoom: 14 });
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      setStatus('Geolocation is not supported by this browser.');
      return;
    }

    setStatus('Requesting your location…');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coordinates = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        setOrigin(coordinates);
        setStatus('Current location selected as your starting point.');
        const map = mapRef.current;
        if (!map) return;
        originMarker.current?.remove();
        originMarker.current = new mapboxgl.Marker({ color: '#16a34a' })
          .setLngLat([coordinates.longitude, coordinates.latitude])
          .addTo(map);
        map.flyTo({ center: [coordinates.longitude, coordinates.latitude], zoom: 15 });
      },
      (error) => {
        const messages: Record<number, string> = {
          1: 'Location permission was denied. You can continue from central San Francisco.',
          2: 'Your location is unavailable right now.',
          3: 'The location request timed out.',
        };
        setStatus(messages[error.code] ?? 'Unable to retrieve your location.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }

  async function generateRoutes() {
    if (!destination) {
      setStatus('Select a destination first.');
      return;
    }

    setIsRouting(true);
    setStatus('Generating walking routes…');
    try {
      const params = new URLSearchParams({
        originLat: String(origin.latitude),
        originLng: String(origin.longitude),
        destinationLat: String(destination.latitude),
        destinationLng: String(destination.longitude),
      });
      const data = await apiRequest<WalkingRoute[]>(`/navigation/routes?${params}`);
      setRoutes(data);
      if (data[0]) {
        setSelectedRouteId(data[0].id);
        drawRoute(data[0]);
      }
      setStatus(`${data.length} walking route${data.length === 1 ? '' : 's'} available.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Route generation failed.');
    } finally {
      setIsRouting(false);
    }
  }

  function selectRoute(route: WalkingRoute) {
    setSelectedRouteId(route.id);
    drawRoute(route);
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div>
          <p className="eyebrow">Inclusive navigation prototype</p>
          <h1>MindRoute</h1>
          <p className="intro">
            Plan a clear walking route through San Francisco. AI-based cognitive-load ranking
            will be added later.
          </p>
        </div>

        <div className="api-status" data-online={apiOnline === true}>
          <span />
          {apiOnline === null ? 'Checking API…' : apiOnline ? 'Backend connected' : 'Backend offline'}
        </div>

        <section className="panel-section">
          <h2>1. Starting point</h2>
          <button className="secondary-button" type="button" onClick={useMyLocation}>
            Use my current location
          </button>
          <p className="small-copy">
            Current origin: {origin.latitude.toFixed(4)}, {origin.longitude.toFixed(4)}
          </p>
        </section>

        <section className="panel-section">
          <h2>2. Destination</h2>
          <form onSubmit={searchLocations} className="search-form">
            <label htmlFor="destination">Search within San Francisco</label>
            <div className="search-row">
              <input
                id="destination"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Example: Ferry Building"
                autoComplete="off"
              />
              <button type="submit" disabled={isSearching}>
                {isSearching ? '…' : 'Search'}
              </button>
            </div>
          </form>
          {results.length > 0 && (
            <ul className="results" aria-label="Destination results">
              {results.map((result) => (
                <li key={result.id}>
                  <button type="button" onClick={() => chooseDestination(result)}>
                    <strong>{result.name}</strong>
                    <span>{result.fullAddress}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button
            className="primary-button"
            type="button"
            onClick={generateRoutes}
            disabled={!destination || isRouting}
          >
            {isRouting ? 'Generating…' : 'Generate walking routes'}
          </button>
        </section>

        <section className="panel-section route-section">
          <h2>3. Route options</h2>
          {routes.length === 0 ? (
            <p className="empty-state">Route choices will appear here.</p>
          ) : (
            <div className="route-list">
              {routes.map((route, index) => (
                <button
                  type="button"
                  key={route.id}
                  className="route-card"
                  data-selected={selectedRouteId === route.id}
                  onClick={() => selectRoute(route)}
                >
                  <span>Option {index + 1}</span>
                  <strong>{formatDuration(route.durationSeconds)}</strong>
                  <small>{formatDistance(route.distanceMeters)}</small>
                </button>
              ))}
            </div>
          )}
        </section>

        <div className="status-message" role="status" aria-live="polite">
          {status}
        </div>
      </aside>

      <section className="map-region" aria-label="MindRoute map">
        {!env.mapboxToken && (
          <div className="map-error">
            Add NEXT_PUBLIC_MAPBOX_TOKEN to apps/web/.env.local to display the map.
          </div>
        )}
        <div ref={mapContainer} className="map-container" />
        <div className="map-legend">
          <span><i className="origin-dot" /> Origin</span>
          <span><i className="destination-dot" /> Destination</span>
          <span><i className="route-line" /> Walking route</span>
        </div>
      </section>
    </main>
  );
}
EOF

cat > apps/web/src/app/page.tsx <<'EOF'
import MindRouteApp from '@/components/mindroute-app';

export default function Home() {
  return <MindRouteApp />;
}
EOF

cat > apps/web/src/app/layout.tsx <<'EOF'
import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'MindRoute | Accessible Walking Navigation',
  description: 'A cognitive-accessibility research prototype for pedestrian navigation.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
EOF

cat > apps/web/src/app/globals.css <<'EOF'
@import "tailwindcss";

:root {
  --background: #f4f7fb;
  --surface: #ffffff;
  --text: #172033;
  --muted: #64748b;
  --border: #dce3ed;
  --primary: #2563eb;
  --primary-dark: #1d4ed8;
}

* { box-sizing: border-box; }
html, body { margin: 0; min-height: 100%; }
body {
  background: var(--background);
  color: var(--text);
  font-family: Arial, Helvetica, sans-serif;
}
button, input { font: inherit; }
button { cursor: pointer; }
button:disabled { cursor: not-allowed; opacity: 0.55; }

.app-shell {
  display: grid;
  grid-template-columns: minmax(320px, 390px) 1fr;
  min-height: 100vh;
}

.sidebar {
  z-index: 2;
  display: flex;
  flex-direction: column;
  gap: 20px;
  overflow-y: auto;
  padding: 28px;
  background: var(--surface);
  border-right: 1px solid var(--border);
  box-shadow: 8px 0 30px rgb(15 23 42 / 0.08);
}

.eyebrow {
  margin: 0 0 6px;
  color: var(--primary);
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
h1 { margin: 0; font-size: 2.25rem; line-height: 1; }
.intro { margin: 12px 0 0; color: var(--muted); line-height: 1.55; }

.api-status {
  display: flex;
  align-items: center;
  gap: 8px;
  width: fit-content;
  padding: 7px 10px;
  border: 1px solid var(--border);
  border-radius: 999px;
  color: var(--muted);
  font-size: 0.82rem;
}
.api-status span { width: 9px; height: 9px; border-radius: 50%; background: #f59e0b; }
.api-status[data-online="true"] span { background: #16a34a; }

.panel-section { display: grid; gap: 10px; }
.panel-section h2 { margin: 0; font-size: 1rem; }
.small-copy, .empty-state { margin: 0; color: var(--muted); font-size: 0.85rem; line-height: 1.45; }

.search-form { display: grid; gap: 7px; }
.search-form label { font-size: 0.85rem; font-weight: 700; }
.search-row { display: grid; grid-template-columns: 1fr auto; gap: 8px; }
.search-row input {
  min-width: 0;
  padding: 11px 12px;
  border: 1px solid #b8c3d4;
  border-radius: 10px;
  outline: none;
}
.search-row input:focus { border-color: var(--primary); box-shadow: 0 0 0 3px rgb(37 99 235 / 0.15); }
.search-row button, .primary-button, .secondary-button {
  min-height: 44px;
  border-radius: 10px;
  font-weight: 750;
}
.search-row button, .primary-button {
  border: 0;
  padding: 10px 15px;
  color: white;
  background: var(--primary);
}
.search-row button:hover, .primary-button:hover { background: var(--primary-dark); }
.secondary-button {
  border: 1px solid #b8c3d4;
  padding: 10px 14px;
  color: var(--text);
  background: white;
}

.results {
  display: grid;
  gap: 6px;
  max-height: 230px;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  list-style: none;
}
.results button {
  display: grid;
  width: 100%;
  gap: 3px;
  padding: 11px;
  text-align: left;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: #f8fafc;
}
.results button:hover { border-color: var(--primary); }
.results strong { font-size: 0.9rem; }
.results span { color: var(--muted); font-size: 0.78rem; }

.route-list { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.route-card {
  display: grid;
  gap: 4px;
  min-width: 0;
  padding: 11px 8px;
  text-align: left;
  border: 1px solid var(--border);
  border-radius: 11px;
  background: #f8fafc;
}
.route-card[data-selected="true"] { border-color: var(--primary); background: #eff6ff; box-shadow: 0 0 0 2px rgb(37 99 235 / 0.12); }
.route-card span, .route-card small { color: var(--muted); font-size: 0.74rem; }

.status-message {
  margin-top: auto;
  padding: 12px;
  border-radius: 10px;
  background: #eef2ff;
  color: #3730a3;
  font-size: 0.86rem;
  line-height: 1.45;
}

.map-region { position: relative; min-width: 0; min-height: 100vh; }
.map-container { position: absolute; inset: 0; }
.map-error {
  position: absolute;
  z-index: 3;
  top: 24px;
  left: 50%;
  max-width: 460px;
  transform: translateX(-50%);
  padding: 14px 18px;
  border: 1px solid #fecaca;
  border-radius: 12px;
  background: #fef2f2;
  color: #991b1b;
  box-shadow: 0 10px 28px rgb(15 23 42 / 0.12);
}
.map-legend {
  position: absolute;
  z-index: 2;
  left: 18px;
  bottom: 18px;
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 10px;
  background: rgb(255 255 255 / 0.94);
  box-shadow: 0 8px 24px rgb(15 23 42 / 0.14);
  font-size: 0.76rem;
}
.map-legend span { display: flex; align-items: center; gap: 6px; }
.map-legend i { display: inline-block; }
.origin-dot, .destination-dot { width: 10px; height: 10px; border-radius: 50%; }
.origin-dot { background: #16a34a; }
.destination-dot { background: #dc2626; }
.route-line { width: 18px; height: 4px; border-radius: 99px; background: #2563eb; }

@media (max-width: 800px) {
  .app-shell { display: flex; min-height: 100dvh; flex-direction: column-reverse; }
  .map-region { min-height: 56dvh; }
  .sidebar {
    max-height: none;
    padding: 20px;
    border-top: 1px solid var(--border);
    border-right: 0;
    box-shadow: 0 -8px 30px rgb(15 23 42 / 0.08);
  }
  h1 { font-size: 1.9rem; }
  .route-list { grid-template-columns: 1fr; }
  .route-card { grid-template-columns: 1fr auto auto; align-items: center; }
}
EOF

cat > apps/web/next.config.ts <<'EOF'
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
};

export default nextConfig;
EOF

cat > railway.json <<'EOF'
{
  "$schema": "https://railway.com/railway.schema.json",
  "build": {
    "builder": "RAILPACK",
    "buildCommand": "pnpm install --frozen-lockfile && pnpm --filter api build"
  },
  "deploy": {
    "startCommand": "node apps/api/dist/main.js",
    "healthcheckPath": "/api/health",
    "healthcheckTimeout": 100,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 5
  }
}
EOF

cat > .gitignore <<'EOF'
node_modules/
.pnpm-store/
.next/
dist/
coverage/
.env
.env.*
!.env.example
.DS_Store
*.log
.vercel/
EOF

pnpm install

echo
cat <<'DONE'
MindRoute MVP files are installed.

Next:
1. Copy apps/api/.env.example to apps/api/.env
2. Copy apps/web/.env.example to apps/web/.env.local
3. Put the same Mapbox public token in both files
4. Run: pnpm dev
5. Open: http://localhost:3000
DONE
