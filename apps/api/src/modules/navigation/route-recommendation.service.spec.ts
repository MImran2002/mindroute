import type { WalkingRoute } from './navigation.service';
import { RouteRecommendationService } from './route-recommendation.service';

describe('RouteRecommendationService', () => {
  let service: RouteRecommendationService;

  beforeEach(() => {
    service = new RouteRecommendationService();
  });

  it('returns an empty array when there are no routes', () => {
    expect(service.assignRecommendations([])).toEqual([]);
  });

  it('assigns all matching labels to one route', () => {
    const routes = [createRoute()];

    const result = service.assignRecommendations(routes);

    expect(result[0].recommendation).toEqual({
      primaryLabel: 'Best overall',
      labels: [
        'Best overall',
        'Lowest cognitive load',
        'Most comfortable',
        'Fastest',
      ],
      explanation: 'Ranked first with a final score of 30.',
    });
  });

  it('identifies different routes for each recommendation', () => {
    const routes = [
      createRoute({
        id: 'best-overall',
        rank: 1,
        durationSeconds: 1000,
        cognitiveLoadScore: 35,
        comfortScore: 50,
        finalScore: 20,
      }),
      createRoute({
        id: 'lowest-load',
        rank: 2,
        durationSeconds: 1100,
        cognitiveLoadScore: 20,
        comfortScore: 40,
        finalScore: 25,
      }),
      createRoute({
        id: 'comfortable',
        rank: 3,
        durationSeconds: 1200,
        cognitiveLoadScore: 40,
        comfortScore: 90,
        finalScore: 30,
      }),
      createRoute({
        id: 'fastest',
        rank: 4,
        durationSeconds: 600,
        cognitiveLoadScore: 45,
        comfortScore: 30,
        finalScore: 35,
      }),
    ];

    const result = service.assignRecommendations(routes);

    expect(result[0].recommendation?.labels).toContain('Best overall');

    expect(result[1].recommendation?.labels).toContain('Lowest cognitive load');

    expect(result[2].recommendation?.labels).toContain('Most comfortable');

    expect(result[3].recommendation?.labels).toContain('Fastest');
  });

  it('labels unmatched routes as alternatives', () => {
    const routes = [
      createRoute({
        id: 'best-route',
        rank: 1,
        cognitiveLoadScore: 20,
        comfortScore: 90,
        finalScore: 10,
        durationSeconds: 500,
      }),
      createRoute({
        id: 'alternative-route',
        rank: 2,
        cognitiveLoadScore: 50,
        comfortScore: 30,
        finalScore: 45,
        durationSeconds: 900,
      }),
    ];

    const result = service.assignRecommendations(routes);

    expect(result[1].recommendation).toEqual({
      primaryLabel: 'Alternative',
      labels: ['Alternative'],
      explanation: 'A viable alternative walking route.',
    });
  });
});

interface RouteOverrides {
  id?: string;
  rank?: number;
  durationSeconds?: number;
  cognitiveLoadScore?: number;
  comfortScore?: number;
  finalScore?: number;
}

function createRoute(overrides: RouteOverrides = {}): WalkingRoute {
  const {
    id = 'route-1',
    rank = 1,
    durationSeconds = 900,
    cognitiveLoadScore = 40,
    comfortScore = 40,
    finalScore = 30,
  } = overrides;

  return {
    id,
    rank,

    distanceMeters: 1500,
    durationSeconds,

    geometry: {
      type: 'LineString',
      coordinates: [
        [-122.4194, 37.7749],
        [-122.4094, 37.7849],
      ],
    },

    features: {
      distanceMeters: 1500,
      durationSeconds,
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
    },

    environmentalSummary: {
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
      sampleCount: 1,
      observationCount: 10,
    },

    environmentalDataStatus: 'real',

    comparisonRow: {
      routeId: id,

      distanceMeters: 1500,
      durationSeconds,
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
    },

    score: {
      cognitiveLoadScore,
      comfortScore,
      finalScore,

      breakdown: {
        navigationComplexity: 30,
        crossingComplexity: 30,
        environmentalStrain: 30,
        routeEfficiency: 30,
        environmentalComfort: 30,
      },

      scoringMethod: 'rule-based-v1',
    },

    samples: [],
    sampleEnvironments: [],
    instructions: [],
  };
}
