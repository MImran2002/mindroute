/**
 * Navigation and environmental measurements calculated for
 * one candidate pedestrian route.
 *
 * These values will eventually form one row of the AI route
 * comparison dataset.
 */
export interface RouteFeatures {
  /*
   * Traditional routing measurements
   */
  distanceMeters: number;
  durationSeconds: number;
  detourPercent: number;

  /*
   * Navigation-complexity measurements
   */
  turnCount: number;
  sharpTurnCount: number;
  decisionPointCount: number;
  instructionDensityPerKm: number;
  averageSegmentLengthMeters: number;
  shortSegmentCount: number;
  routeStraightness: number;

  /*
   * Crossing and intersection measurements
   */
  crossingCount: number;
  signalizedCrossingCount: number;
  unsignalizedCrossingCount: number;
  complexIntersectionCount: number;
  crossingComplexity: number;

  /*
   * Environmental measurements
   *
   * These remain zero until their corresponding environmental
   * data providers are implemented.
   */
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

  /*
   * Confidence indicates how complete and reliable the route's
   * environmental measurements are.
   *
   * Expected range: 0 to 1.
   */
  dataConfidence: number;
}

/**
 * Candidate route combined with its extracted feature row.
 *
 * This is the final pre-AI representation that will later be
 * passed to the baseline scorer and machine-learning model.
 */
export interface AnalyzedCandidateRoute {
  routeId: string;
  features: RouteFeatures;
}
