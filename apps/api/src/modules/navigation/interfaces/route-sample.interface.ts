import type { RouteCoordinate } from './candidate-route.interface';

/**
 * A geographic point sampled along a candidate route.
 *
 * Environmental providers will later attach nearby observations
 * such as traffic, greenery, shade, construction, and pedestrian
 * activity to these sample points.
 */
export interface RouteSamplePoint {
  id: string;
  routeId: string;
  coordinate: RouteCoordinate;
  distanceFromStartMeters: number;
  segmentIndex: number;
}
