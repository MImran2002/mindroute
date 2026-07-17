import type { Coordinates } from "../location/location.types";

export interface RouteSummary {
  routeId: string;
  distanceMeters: number;
  durationSeconds: number;
  geometry: Coordinates[];
}

export interface RouteFeatures {
  turnCount: number;
  decisionPointCount: number;
  crossingCount: number;
  instructionDensity: number;
  routeStraightness: number;
}
