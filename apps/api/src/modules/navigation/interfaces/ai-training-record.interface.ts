import type {
  EnvironmentalRetrievalSource,
  EnvironmentalDataStatus,
} from './environmental-observation.interface';
import type { RouteCandidateSource } from './candidate-route.interface';
import type { RouteRecommendationLabel } from './route-recommendation.interface';

export interface AITrainingRecord {
  schemaVersion: '2.0';

  requestId: string;
  capturedAt: string;

  originLat: number;
  originLng: number;
  destinationLat: number;
  destinationLng: number;

  routeId: string;
  candidateSource: RouteCandidateSource;
  rank: number;

  // Basic route information
  distanceMeters: number;
  durationSeconds: number;
  detourPercent: number;

  // Navigation complexity
  turnCount: number;
  sharpTurnCount: number;
  decisionPointCount: number;
  instructionDensityPerKm: number;
  averageSegmentLengthMeters: number;
  shortSegmentCount: number;
  routeStraightness: number;

  // Crossing complexity
  crossingCount: number;
  signalizedCrossingCount: number;
  unsignalizedCrossingCount: number;
  complexIntersectionCount: number;
  crossingComplexity: number;

  // Environmental features
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
  environmentalRetrievalSource?: EnvironmentalRetrievalSource;

  // Baseline-generated weak labels.
  // Later these can be supplemented/replaced by real user feedback.
  baselineCognitiveLoadScore: number;
  baselineComfortScore: number;
  baselineFinalScore: number;

  recommendationLabel: RouteRecommendationLabel;

  labelSource: 'baseline-v1';
}
