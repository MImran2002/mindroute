import { Injectable } from '@nestjs/common';

import type { RouteComparisonRow } from './interfaces/route-comparison-row.interface';
import type { RouteScore } from './interfaces/route-score.interface';

@Injectable()
export class RouteBaselineScorerService {
  scoreRoute(route: RouteComparisonRow): RouteScore {
    const navigationComplexity = this.clamp(
      route.turnCount * 3 +
        route.sharpTurnCount * 6 +
        route.decisionPointCount * 2 +
        route.shortSegmentCount * 1.5 +
        route.instructionDensityPerKm * 0.75 +
        (1 - route.routeStraightness) * 20,
    );

    const crossingComplexity = this.clamp(
      route.crossingCount * 3 +
        route.unsignalizedCrossingCount * 6 +
        route.signalizedCrossingCount * 2 +
        route.complexIntersectionCount * 7 +
        route.crossingComplexity * 20,
    );

    const environmentalStrain = this.clamp(
      route.pedestrianDensity * 20 +
        route.trafficExposure * 20 +
        route.noiseExposure * 20 +
        route.commercialActivityExposure * 12 +
        route.constructionExposure * 15 +
        route.eventExposure * 13,
    );

    const routeEfficiency = this.clamp(
      route.detourPercent * 0.8 +
        Math.min(route.durationSeconds / 60, 30) * 1.5,
    );

    const environmentalComfort = this.clamp(
      route.estimatedShadeExposure * 35 +
        route.greeneryExposure * 30 +
        route.parkExposure * 20 +
        route.pointOfInterestDensity * 5,
    );

    const rawCognitiveLoad =
      navigationComplexity * 0.3 +
      crossingComplexity * 0.25 +
      environmentalStrain * 0.3 +
      routeEfficiency * 0.15;

    const confidenceMultiplier =
      route.environmentalDataStatus === 'fallback'
        ? 0.7
        : 0.85 + route.dataConfidence * 0.15;

    const cognitiveLoadScore = this.round(
      rawCognitiveLoad * confidenceMultiplier,
    );

    const comfortScore = this.round(
      environmentalComfort * confidenceMultiplier,
    );

    const finalScore = this.round(cognitiveLoadScore - comfortScore * 0.25);

    return {
      cognitiveLoadScore,
      comfortScore,
      finalScore: this.clamp(finalScore),
      breakdown: {
        navigationComplexity: this.round(navigationComplexity),
        crossingComplexity: this.round(crossingComplexity),
        environmentalStrain: this.round(environmentalStrain),
        routeEfficiency: this.round(routeEfficiency),
        environmentalComfort: this.round(environmentalComfort),
      },
      scoringMethod: 'rule-based-v1',
    };
  }

  private clamp(value: number): number {
    return Math.max(0, Math.min(100, value));
  }

  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
