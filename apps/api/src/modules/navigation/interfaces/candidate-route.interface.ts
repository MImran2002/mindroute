/**
 * Geographic coordinate represented as:
 * [longitude, latitude]
 */
export type RouteCoordinate = [number, number];

export type RouteCandidateSource = 'direct' | 'left-offset' | 'right-offset';

export interface RouteGeometry {
  type: 'LineString';
  coordinates: RouteCoordinate[];
}

export interface RouteIntersection {
  location?: RouteCoordinate;
  bearings?: number[];
  entry?: boolean[];
  traffic_signal?: boolean;
}

export interface RouteManeuver {
  instruction?: string;
  type?: string;
  modifier?: string;
  bearing_before?: number;
  bearing_after?: number;
  location?: RouteCoordinate;
}

export interface RouteStep {
  name?: string;
  distanceMeters: number;
  durationSeconds: number;
  maneuver: RouteManeuver;
  intersections: RouteIntersection[];
}

export interface CandidateRoute {
  id: string;
  candidateSource: RouteCandidateSource;
  distanceMeters: number;
  durationSeconds: number;
  geometry: RouteGeometry;
  steps: RouteStep[];
}

/**
 * Shape returned by the Mapbox Directions API.
 *
 * These interfaces remain internal to the Mapbox provider layer.
 * The rest of MindRoute should work with CandidateRoute instead.
 */
export interface MapboxRouteStep {
  name?: string;
  distance?: number;
  duration?: number;

  maneuver?: {
    instruction?: string;
    type?: string;
    modifier?: string;
    bearing_before?: number;
    bearing_after?: number;
    location?: RouteCoordinate;
  };

  intersections?: Array<{
    location?: RouteCoordinate;
    bearings?: number[];
    entry?: boolean[];
    traffic_signal?: boolean;
  }>;
}

export interface MapboxRoute {
  distance: number;
  duration: number;

  geometry: RouteGeometry;

  legs?: Array<{
    steps?: MapboxRouteStep[];
  }>;
}

export interface MapboxDirectionsResponse {
  routes?: MapboxRoute[];
}
