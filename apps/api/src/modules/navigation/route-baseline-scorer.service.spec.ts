import type { RouteComparisonRow } from './interfaces/route-comparison-row.interface';
import { RouteBaselineScorerService } from './route-baseline-scorer.service';

describe('RouteBaselineScorerService', () => {
  let service: RouteBaselineScorerService;

  beforeEach(() => {
    service = new RouteBaselineScorerService();
  });

  it('returns scores between 0 and 100', () => {
    const result = service.scoreRoute(createRoute());

    expect(result.cognitiveLoadScore).toBeGreaterThanOrEqual(0);
    expect(result.cognitiveLoadScore).toBeLessThanOrEqual(100);

    expect(result.comfortScore).toBeGreaterThanOrEqual(0);
    expect(result.comfortScore).toBeLessThanOrEqual(100);

    expect(result.finalScore).toBeGreaterThanOrEqual(0);
    expect(result.finalScore).toBeLessThanOrEqual(100);

    expect(result.scoringMethod).toBe('rule-based-v1');
  });

  it('scores a complex route higher than a simple route', () => {
    const simpleRoute = createRoute({
      routeId: 'simple-route',
      turnCount: 2,
      sharpTurnCount: 0,
      decisionPointCount: 3,
      crossingCount: 2,
      unsignalizedCrossingCount: 1,
      complexIntersectionCount: 0,
      crossingComplexity: 0.2,
      pedestrianDensity: 0.2,
      trafficExposure: 0.2,
      noiseExposure: 0.2,
    });

    const complexRoute = createRoute({
      routeId: 'complex-route',
      turnCount: 12,
      sharpTurnCount: 5,
      decisionPointCount: 18,
      crossingCount: 10,
      unsignalizedCrossingCount: 8,
      complexIntersectionCount: 6,
      crossingComplexity: 0.9,
      pedestrianDensity: 0.9,
      trafficExposure: 0.9,
      noiseExposure: 0.9,
    });

    const simpleScore = service.scoreRoute(simpleRoute);
    const complexScore = service.scoreRoute(complexRoute);

    expect(complexScore.cognitiveLoadScore).toBeGreaterThan(
      simpleScore.cognitiveLoadScore,
    );

    expect(complexScore.finalScore).toBeGreaterThan(simpleScore.finalScore);
  });

  it('gives a comfortable route a higher comfort score', () => {
    const uncomfortableRoute = createRoute({
      routeId: 'uncomfortable-route',
      estimatedShadeExposure: 0.1,
      greeneryExposure: 0.1,
      parkExposure: 0,
      pointOfInterestDensity: 0.1,
    });

    const comfortableRoute = createRoute({
      routeId: 'comfortable-route',
      estimatedShadeExposure: 0.9,
      greeneryExposure: 0.9,
      parkExposure: 0.8,
      pointOfInterestDensity: 0.5,
    });

    expect(service.scoreRoute(comfortableRoute).comfortScore).toBeGreaterThan(
      service.scoreRoute(uncomfortableRoute).comfortScore,
    );
  });

  it('reduces environmental influence when fallback data is used', () => {
    const realRoute = createRoute({
      routeId: 'real-route',
      environmentalDataStatus: 'real',
      dataConfidence: 1,
    });

    const fallbackRoute = createRoute({
      routeId: 'fallback-route',
      environmentalDataStatus: 'fallback',
      dataConfidence: 1,
    });

    const realScore = service.scoreRoute(realRoute);
    const fallbackScore = service.scoreRoute(fallbackRoute);

    expect(fallbackScore.cognitiveLoadScore).toBeLessThan(
      realScore.cognitiveLoadScore,
    );

    expect(fallbackScore.comfortScore).toBeLessThan(realScore.comfortScore);
  });
});

function createRoute(
  overrides: Partial<RouteComparisonRow> = {},
): RouteComparisonRow {
  return {
    routeId: 'route-1',

    distanceMeters: 1500,
    durationSeconds: 1000,
    detourPercent: 0,

    turnCount: 4,
    sharpTurnCount: 1,
    decisionPointCount: 8,
    instructionDensityPerKm: 10,
    averageSegmentLengthMeters: 100,
    shortSegmentCount: 3,
    routeStraightness: 0.8,

    crossingCount: 4,
    signalizedCrossingCount: 2,
    unsignalizedCrossingCount: 2,
    complexIntersectionCount: 1,
    crossingComplexity: 0.4,

    estimatedShadeExposure: 0.5,
    greeneryExposure: 0.4,
    parkExposure: 0.2,
    pedestrianDensity: 0.5,
    trafficExposure: 0.5,
    noiseExposure: 0.5,
    commercialActivityExposure: 0.4,
    constructionExposure: 0.1,
    eventExposure: 0.1,
    pointOfInterestDensity: 0.4,

    dataConfidence: 0.8,
    environmentalDataStatus: 'real',

    ...overrides,
  };
}
