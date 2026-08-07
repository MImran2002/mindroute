import type { RouteCoordinate } from './candidate-route.interface';

/**
 * Environmental feature names used throughout MindRoute.
 *
 * Every data provider must map its source-specific information
 * into one or more of these standardized feature types.
 */
export type EnvironmentalFeatureType =
  | 'shade'
  | 'greenery'
  | 'park'
  | 'pedestrian-density'
  | 'traffic'
  | 'noise'
  | 'commercial-activity'
  | 'construction'
  | 'event'
  | 'point-of-interest';

/**
 * Identifies where an environmental value came from.
 */
export type EnvironmentalDataStatus =
  'real' | 'partial' | 'fallback' | 'unavailable';

export type EnvironmentalDataSource =
  | 'openstreetmap'
  | 'datasf'
  | '511-bay-area'
  | 'mapbox'
  | 'derived'
  | 'mock'
  | 'unknown';

/**
 * One normalized environmental measurement near a route
 * sample point.
 *
 * value and confidence must both use the range 0 to 1.
 */
export interface EnvironmentalObservation {
  id: string;
  featureType: EnvironmentalFeatureType;

  coordinate: RouteCoordinate;

  /**
   * Normalized environmental intensity.
   *
   * Examples:
   * 0 = no exposure
   * 0.5 = moderate exposure
   * 1 = very high exposure
   */
  value: number;

  /**
   * Reliability and completeness of this observation.
   *
   * 0 = no confidence
   * 1 = highly reliable
   */
  confidence: number;

  source: EnvironmentalDataSource;

  /**
   * Distance between the environmental feature and the route
   * sample point, when available.
   */
  distanceFromSampleMeters?: number;

  /**
   * Time at which the source observation was measured.
   * Static map features may leave this undefined.
   */
  observedAt?: string;

  /**
   * Time at which MindRoute retrieved or derived the value.
   */
  retrievedAt: string;

  /**
   * Optional source-specific details useful for debugging.
   * These details must not be passed directly into the AI model.
   */
  metadata?: Record<string, string | number | boolean | null>;
}

/**
 * All environmental measurements attached to one sampled point
 * along a candidate route.
 */
export interface RouteSampleEnvironment {
  sampleId: string;
  routeId: string;
  coordinate: RouteCoordinate;

  observations: EnvironmentalObservation[];
}

/**
 * Route-level environmental values aggregated from all sampled
 * points along one candidate route.
 */
export interface AggregatedRouteEnvironment {
  estimatedShadeExposure: number;
  greeneryExposure: number;
  parkExposure: number;
  pedestrianDensity: number;
  trafficExposure: number;
  noiseExposure: number;
  commercialActivityExposure: number;
  constructionExposure: number;
  eventExposure: number;
  pointOfInterestDensity: number;

  /**
   * Overall environmental-data confidence for this route.
   */
  dataConfidence: number;

  /**
   * Number of sampled route points that contributed data.
   */
  sampleCount: number;

  /**
   * Number of environmental observations used during
   * aggregation.
   */
  observationCount: number;
}
