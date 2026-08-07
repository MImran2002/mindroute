import type { EnvironmentalDataStatus } from './environmental-observation.interface';

export interface RouteComparisonRow {
  routeId: string;

  distanceMeters: number;
  durationSeconds: number;
  detourPercent: number;

  turnCount: number;
  sharpTurnCount: number;
  decisionPointCount: number;
  instructionDensityPerKm: number;
  averageSegmentLengthMeters: number;
  shortSegmentCount: number;
  routeStraightness: number;

  crossingCount: number;
  signalizedCrossingCount: number;
  unsignalizedCrossingCount: number;
  complexIntersectionCount: number;
  crossingComplexity: number;

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

  dataConfidence: number;
  environmentalDataStatus: EnvironmentalDataStatus;
}
