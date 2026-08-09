import { Injectable } from '@nestjs/common';

import type { AITrainingRecord } from './interfaces/ai-training-record.interface';
import type { RouteComparisonRow } from './interfaces/route-comparison-row.interface';
import type { RouteRecommendation } from './interfaces/route-recommendation.interface';
import type { RouteScore } from './interfaces/route-score.interface';

interface CreateAITrainingRecordInput {
  requestId: string;
  capturedAt: string;

  originLat: number;
  originLng: number;
  destinationLat: number;
  destinationLng: number;

  comparisonRow: RouteComparisonRow;
  score: RouteScore;
  rank: number;
  recommendation: RouteRecommendation;
}

@Injectable()
export class AITrainingRecordService {
  createRecord(input: CreateAITrainingRecordInput): AITrainingRecord {
    const {
      requestId,
      capturedAt,
      originLat,
      originLng,
      destinationLat,
      destinationLng,
      comparisonRow,
      score,
      rank,
      recommendation,
    } = input;

    return {
      schemaVersion: '1.2',

      requestId,
      capturedAt,

      originLat,
      originLng,
      destinationLat,
      destinationLng,

      routeId: comparisonRow.routeId,
      rank,

      distanceMeters: comparisonRow.distanceMeters,
      durationSeconds: comparisonRow.durationSeconds,
      detourPercent: comparisonRow.detourPercent,

      turnCount: comparisonRow.turnCount,
      sharpTurnCount: comparisonRow.sharpTurnCount,
      decisionPointCount: comparisonRow.decisionPointCount,
      instructionDensityPerKm: comparisonRow.instructionDensityPerKm,
      averageSegmentLengthMeters: comparisonRow.averageSegmentLengthMeters,
      shortSegmentCount: comparisonRow.shortSegmentCount,
      routeStraightness: comparisonRow.routeStraightness,

      crossingCount: comparisonRow.crossingCount,
      signalizedCrossingCount: comparisonRow.signalizedCrossingCount,
      unsignalizedCrossingCount: comparisonRow.unsignalizedCrossingCount,
      complexIntersectionCount: comparisonRow.complexIntersectionCount,
      crossingComplexity: comparisonRow.crossingComplexity,

      estimatedShadeExposure: comparisonRow.estimatedShadeExposure,
      greeneryExposure: comparisonRow.greeneryExposure,
      parkExposure: comparisonRow.parkExposure,
      pedestrianDensity: comparisonRow.pedestrianDensity,
      trafficExposure: comparisonRow.trafficExposure,
      noiseExposure: comparisonRow.noiseExposure,
      commercialActivityExposure: comparisonRow.commercialActivityExposure,
      constructionExposure: comparisonRow.constructionExposure,
      eventExposure: comparisonRow.eventExposure,
      pointOfInterestDensity: comparisonRow.pointOfInterestDensity,

      dataConfidence: comparisonRow.dataConfidence,
      environmentalDataStatus: comparisonRow.environmentalDataStatus,

      baselineCognitiveLoadScore: score.cognitiveLoadScore,
      baselineComfortScore: score.comfortScore,
      baselineFinalScore: score.finalScore,

      recommendationLabel: recommendation.primaryLabel,

      labelSource: 'baseline-v1',
    };
  }
}
