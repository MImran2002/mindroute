import {
  BadGatewayException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';

import type { NavigationRoutesResponse } from './interfaces/navigation-routes-response.interface';

import type { GetRoutesDto } from './dto/get-routes.dto';
import { AITrainingDatasetService } from './ai-training-dataset.service';
import { AITrainingRecordService } from './ai-training-record.service';
import { AITrainingStorageService } from './ai-training-storage.service';
import { EnvironmentalAggregationService } from './environmental-aggregation.service';
import type { AITrainingRecord } from './interfaces/ai-training-record.interface';
import type {
  CandidateRoute,
  MapboxDirectionsResponse,
  MapboxRoute,
  RouteCandidateSource,
  RouteStep,
} from './interfaces/candidate-route.interface';
import type {
  EnvironmentalRetrievalSource,
  AggregatedRouteEnvironment,
  EnvironmentalDataSource,
  EnvironmentalDataStatus,
  RouteSampleEnvironment,
} from './interfaces/environmental-observation.interface';
import type { RouteComparisonRow } from './interfaces/route-comparison-row.interface';
import type { RouteRecommendation } from './interfaces/route-recommendation.interface';
import type { RouteFeatures } from './interfaces/route-features.interface';
import type { RouteSamplePoint } from './interfaces/route-sample.interface';
import type { RouteScore } from './interfaces/route-score.interface';
import { MockEnvironmentalProvider } from './providers/mock-environmental.provider';
import { OpenStreetMapEnvironmentalProvider } from './providers/openstreetmap-environmental.provider';
import { RouteBaselineScorerService } from './route-baseline-scorer.service';
import { RouteComparisonRowService } from './route-comparison-row.service';
import { RouteRecommendationService } from './route-recommendation.service';
import { RouteFeatureExtractorService } from './route-feature-extractor.service';
import { RouteSamplingService } from './route-sampling.service';
import {
  RouteCandidateGeneratorService,
  type RouteCandidatePlan,
} from './route-candidate-generator.service';
import { RouteGenerationDiagnosticsService } from './route-generation-diagnostics.service';
import { MlRankingService } from './ml-ranking.service';

export interface WalkingRoute {
  id: string;
  candidateSource: RouteCandidateSource;
  rank: number;

  distanceMeters: number;
  durationSeconds: number;

  geometry: {
    type: 'LineString';
    coordinates: [number, number][];
  };

  features: RouteFeatures;

  environmentalSummary: AggregatedRouteEnvironment;
  environmentalDataStatus: EnvironmentalDataStatus;
  environmentalDataSource: EnvironmentalRetrievalSource;

  comparisonRow: RouteComparisonRow;
  score: RouteScore;
  recommendation?: RouteRecommendation;
  trainingRecord?: AITrainingRecord;

  samples: RouteSamplePoint[];
  sampleEnvironments: RouteSampleEnvironment[];

  instructions: Array<{
    instruction: string;
    distanceMeters: number;
    durationSeconds: number;
  }>;
}

@Injectable()
export class NavigationService {
  constructor(
    private readonly config: ConfigService,
    private readonly routeFeatureExtractor: RouteFeatureExtractorService,
    private readonly routeSamplingService: RouteSamplingService,
    private readonly routeComparisonRowService: RouteComparisonRowService,
    private readonly routeBaselineScorerService: RouteBaselineScorerService,
    private readonly routeRecommendationService: RouteRecommendationService,
    private readonly routeCandidateGeneratorService: RouteCandidateGeneratorService,
    private readonly routeGenerationDiagnosticsService: RouteGenerationDiagnosticsService,
    private readonly mlRankingService: MlRankingService,
    private readonly aiTrainingRecordService: AITrainingRecordService,
    private readonly aiTrainingDatasetService: AITrainingDatasetService,
    private readonly aiTrainingStorageService: AITrainingStorageService,
    private readonly environmentalAggregationService: EnvironmentalAggregationService,
    private readonly openStreetMapEnvironmentalProvider: OpenStreetMapEnvironmentalProvider,
    private readonly mockEnvironmentalProvider: MockEnvironmentalProvider,
  ) {}

  async getWalkingRoutes(
    input: GetRoutesDto,
  ): Promise<NavigationRoutesResponse> {
    const requestId = randomUUID();
    const capturedAt = new Date().toISOString();

    const token = this.config.get<string>('mapbox.accessToken');

    if (!token) {
      throw new ServiceUnavailableException('Mapbox is not configured');
    }

    const candidatePlans = this.routeCandidateGeneratorService.generate(input);

    const candidateResults = await Promise.all(
      candidatePlans.map((plan) => this.fetchCandidateRoute(plan, token)),
    );

    const providerSuccesses = candidateResults.filter(
      (result) => result !== null,
    ).length;

    const providerFailures = candidatePlans.length - providerSuccesses;

    const validCandidateResults = candidateResults.filter(
      (
        result,
      ): result is {
        route: MapboxRoute;
        candidateSource: RouteCandidateSource;
      } => result !== null,
    );

    if (validCandidateResults.length === 0) {
      throw new NotFoundException('No walking routes were found');
    }

    const normalizedCandidateRoutes = validCandidateResults.map(
      (result, index) =>
        this.normalizeCandidateRoute(
          result.route,
          index,
          result.candidateSource,
        ),
    );

    const deduplicatedCandidateRoutes = this.deduplicateCandidateRoutes(
      normalizedCandidateRoutes,
    );

    const candidateRoutes = deduplicatedCandidateRoutes.map((route, index) => ({
      ...route,
      id: `route-${index + 1}`,
    }));

    const fastestDurationSeconds = Math.min(
      ...candidateRoutes.map((route) => route.durationSeconds),
    );

    const routeSamples = new Map<string, RouteSamplePoint[]>();

    for (const route of candidateRoutes) {
      routeSamples.set(
        route.id,
        this.routeSamplingService.sampleRoute(route, 200),
      );
    }

    const allSamples = Array.from(routeSamples.values()).flat();

    let allSampleEnvironments: RouteSampleEnvironment[];

    let environmentalDataStatus: EnvironmentalDataStatus = 'real';

    let environmentalDataSource: EnvironmentalRetrievalSource = 'live';

    try {
      allSampleEnvironments =
        await this.openStreetMapEnvironmentalProvider.getEnvironmentForSamples(
          allSamples,
        );

      environmentalDataSource =
        this.openStreetMapEnvironmentalProvider.getLastDataSource();
    } catch {
      allSampleEnvironments =
        await this.mockEnvironmentalProvider.getEnvironmentForSamples(
          allSamples,
        );

      environmentalDataStatus = 'fallback';
      environmentalDataSource = 'fallback';
    }

    const environmentsByRouteId = new Map<string, RouteSampleEnvironment[]>();

    for (const environment of allSampleEnvironments) {
      const existing = environmentsByRouteId.get(environment.routeId) ?? [];

      existing.push(environment);

      environmentsByRouteId.set(environment.routeId, existing);
    }

    const analyzedRoutes = await Promise.all(
      candidateRoutes.map(async (route): Promise<WalkingRoute> => {
        const navigationFeatures = this.routeFeatureExtractor.extract(
          route,
          fastestDurationSeconds,
        );

        const samples = routeSamples.get(route.id) ?? [];

        const sampleEnvironments = environmentsByRouteId.get(route.id) ?? [];

        const environmentalSummary =
          this.environmentalAggregationService.aggregate(sampleEnvironments);

        const routeObservations = sampleEnvironments.flatMap(
          (sampleEnvironment) => sampleEnvironment.observations,
        );

        const hasRealEnvironmentalData =
          routeObservations.some(
            (observation) =>
              observation.source !== 'mock' &&
              observation.source !== 'unknown',
          );

        const hasFallbackEnvironmentalData =
          routeObservations.some(
            (observation) =>
              observation.source === 'mock' ||
              observation.source === 'unknown',
          );

        let routeEnvironmentalDataStatus: EnvironmentalDataStatus =
          'unavailable';

        if (
          hasRealEnvironmentalData &&
          hasFallbackEnvironmentalData
        ) {
          routeEnvironmentalDataStatus = 'partial';
        } else if (hasRealEnvironmentalData) {
          routeEnvironmentalDataStatus = 'real';
        } else if (hasFallbackEnvironmentalData) {
          routeEnvironmentalDataStatus = 'fallback';
        }

        const routeEnvironmentalDataSource: EnvironmentalRetrievalSource =
          routeEnvironmentalDataStatus === 'fallback'
            ? 'fallback'
            : routeEnvironmentalDataStatus === 'partial'
              ? 'mixed'
              : environmentalDataSource;

        const features: RouteFeatures = {
          ...navigationFeatures,

          estimatedShadeExposure: environmentalSummary.estimatedShadeExposure,

          greeneryExposure: environmentalSummary.greeneryExposure,

          parkExposure: environmentalSummary.parkExposure,

          pedestrianDensity: environmentalSummary.pedestrianDensity,

          trafficExposure: environmentalSummary.trafficExposure,

          noiseExposure: environmentalSummary.noiseExposure,

          commercialActivityExposure:
            environmentalSummary.commercialActivityExposure,

          constructionExposure: environmentalSummary.constructionExposure,

          eventExposure: environmentalSummary.eventExposure,

          pointOfInterestDensity: environmentalSummary.pointOfInterestDensity,

          dataConfidence: environmentalSummary.dataConfidence,
        };

        const comparisonRow = this.routeComparisonRowService.createRow({
          routeId: route.id,
          features,
          environmentalDataStatus:
            routeEnvironmentalDataStatus,
        });

        const score = this.routeBaselineScorerService.scoreRoute(comparisonRow);

        return {
          id: route.id,
          candidateSource: route.candidateSource,

          rank: 0,

          distanceMeters: route.distanceMeters,

          durationSeconds: route.durationSeconds,

          geometry: route.geometry,

          features,

          environmentalSummary,
          environmentalDataStatus:
            routeEnvironmentalDataStatus,
          environmentalDataSource:
            routeEnvironmentalDataSource,

          comparisonRow,
          score,

          samples,
          sampleEnvironments,

          instructions: route.steps.map((step) => ({
            instruction: step.maneuver.instruction ?? 'Continue',

            distanceMeters: step.distanceMeters,

            durationSeconds: step.durationSeconds,
          })),
        };
      }),
    );

    const baselineRankedRoutes = analyzedRoutes
      .sort(
        (firstRoute, secondRoute) =>
          firstRoute.score.finalScore -
          secondRoute.score.finalScore,
      )
      .map((route, index) => ({
        ...route,
        rank: index + 1,
      }));

    const mlRanking =
      await this.mlRankingService.rankRoutes(
        requestId,
        baselineRankedRoutes,
      );

    let rankedRoutes = baselineRankedRoutes;

    if (
      mlRanking?.modelAvailable &&
      mlRanking.productionReady
    ) {
      const mlRankByRouteId = new Map(
        mlRanking.rankedRoutes.map(
          (route) => [
            route.routeId,
            route.mlRank,
          ],
        ),
      );

      const hasCompleteMlRanking =
        baselineRankedRoutes.every(
          (route) =>
            mlRankByRouteId.has(route.id),
        );

      if (hasCompleteMlRanking) {
        rankedRoutes = [
          ...baselineRankedRoutes,
        ]
          .sort(
            (firstRoute, secondRoute) =>
              (mlRankByRouteId.get(
                firstRoute.id,
              ) ?? Number.MAX_SAFE_INTEGER) -
              (mlRankByRouteId.get(
                secondRoute.id,
              ) ?? Number.MAX_SAFE_INTEGER),
          )
          .map((route, index) => ({
            ...route,
            rank: index + 1,
          }));
      }
    }

    const recommendedRoutes =
      this.routeRecommendationService.assignRecommendations(
        rankedRoutes,
      );

    const routesWithTrainingRecords = recommendedRoutes.map((route) => ({
      ...route,
      trainingRecord: this.aiTrainingRecordService.createRecord({
        requestId,
        capturedAt,
        originLat: input.originLat,
        originLng: input.originLng,
        destinationLat: input.destinationLat,
        destinationLng: input.destinationLng,
        candidateSource: route.candidateSource,
        comparisonRow: route.comparisonRow,
        score: route.score,
        rank: route.rank,
        recommendation: route.recommendation!,
        environmentalRetrievalSource: route.environmentalDataSource,
      }),
    }));

    await this.aiTrainingStorageService.appendRecords(
      routesWithTrainingRecords.map((route) => route.trainingRecord),
    );

    await this.routeGenerationDiagnosticsService.appendRecord({
      requestId,
      capturedAt,
      plansAttempted: candidatePlans.length,
      providerSuccesses,
      providerFailures,
      routesBeforeDeduplication: normalizedCandidateRoutes.length,
      routesAfterDeduplication: deduplicatedCandidateRoutes.length,
      duplicatesRemoved:
        normalizedCandidateRoutes.length - deduplicatedCandidateRoutes.length,
      survivingCandidateSources: deduplicatedCandidateRoutes.map(
        (route) => route.candidateSource,
      ),
      environmental:
        this.openStreetMapEnvironmentalProvider.getLastRetrievalDiagnostics(),
    });

    return {
      requestId,
      routes: routesWithTrainingRecords,
      diagnostics: {
        plansAttempted: candidatePlans.length,
        providerSuccesses,
        providerFailures,
        routesBeforeDeduplication: normalizedCandidateRoutes.length,
        routesAfterDeduplication: deduplicatedCandidateRoutes.length,
        duplicatesRemoved:
          normalizedCandidateRoutes.length - deduplicatedCandidateRoutes.length,

        environmental:
          this.openStreetMapEnvironmentalProvider.getLastRetrievalDiagnostics(),
      },
    };
  }

  async getAITrainingRecords(input: GetRoutesDto): Promise<AITrainingRecord[]> {
    const result = await this.getWalkingRoutes(input);

    return result.routes
      .map((route) => route.trainingRecord)
      .filter((record): record is AITrainingRecord => record !== undefined);
  }

  async getAITrainingRecordsCsv(input: GetRoutesDto): Promise<string> {
    const records = await this.getAITrainingRecords(input);

    return this.aiTrainingDatasetService.toCsv(records);
  }

  private async fetchCandidateRoute(
    plan: RouteCandidatePlan,
    token: string,
  ): Promise<{
    route: MapboxRoute;
    candidateSource: RouteCandidateSource;
  } | null> {
    const coordinates = plan.coordinates
      .map(([lng, lat]) => `${lng},${lat}`)
      .join(';');

    const params = new URLSearchParams({
      access_token: token,
      alternatives: 'false',
      geometries: 'geojson',
      overview: 'full',
      steps: 'true',
      language: 'en',
      annotations: 'distance,duration',
    });

    if (plan.coordinates.length > 2) {
      params.set('waypoints', plan.waypointIndexes.join(';'));
    }

    let response: Response;

    try {
      response = await fetch(
        `https://api.mapbox.com/directions/v5/mapbox/walking/${coordinates}?${params.toString()}`,
        {
          signal: AbortSignal.timeout(10000),
        },
      );
    } catch {
      return null;
    }

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as MapboxDirectionsResponse;

    const route = data.routes?.[0];

    if (!route) {
      return null;
    }

    return {
      route,
      candidateSource: plan.id,
    };
  }

  private deduplicateCandidateRoutes(
    routes: CandidateRoute[],
  ): CandidateRoute[] {
    const uniqueRoutes: CandidateRoute[] = [];

    for (const candidate of routes) {
      const isDuplicate = uniqueRoutes.some((existing) =>
        this.areRoutesGeometricallySimilar(existing, candidate),
      );

      if (!isDuplicate) {
        uniqueRoutes.push(candidate);
      }
    }

    return uniqueRoutes;
  }

  private areRoutesGeometricallySimilar(
    first: CandidateRoute,
    second: CandidateRoute,
  ): boolean {
    const firstPoints = this.createRoundedGeometrySet(first);
    const secondPoints = this.createRoundedGeometrySet(second);

    if (firstPoints.size === 0 || secondPoints.size === 0) {
      return false;
    }

    let sharedPoints = 0;

    for (const point of firstPoints) {
      if (secondPoints.has(point)) {
        sharedPoints += 1;
      }
    }

    const smallerRoutePointCount = Math.min(
      firstPoints.size,
      secondPoints.size,
    );

    const overlapRatio = sharedPoints / smallerRoutePointCount;

    return overlapRatio >= 0.8;
  }

  private createRoundedGeometrySet(route: CandidateRoute): Set<string> {
    return new Set(
      route.geometry.coordinates.map(([lng, lat]) => {
        const roundedLng = lng.toFixed(4);
        const roundedLat = lat.toFixed(4);

        return `${roundedLng},${roundedLat}`;
      }),
    );
  }

  private normalizeCandidateRoute(
    route: MapboxRoute,
    index: number,
    candidateSource: RouteCandidateSource,
  ): CandidateRoute {
    const steps = (route.legs ?? []).flatMap((leg) =>
      (leg.steps ?? []).map<RouteStep>((step) => ({
        name: step.name,

        distanceMeters: step.distance ?? 0,
        durationSeconds: step.duration ?? 0,

        maneuver: {
          instruction: step.maneuver?.instruction,
          type: step.maneuver?.type,
          modifier: step.maneuver?.modifier,
          bearing_before: step.maneuver?.bearing_before,
          bearing_after: step.maneuver?.bearing_after,
          location: step.maneuver?.location,
        },

        intersections: (step.intersections ?? []).map((intersection) => ({
          location: intersection.location,
          bearings: intersection.bearings,
          entry: intersection.entry,
          traffic_signal: intersection.traffic_signal,
        })),
      })),
    );

    return {
      id: `route-${index + 1}`,
      candidateSource,
      distanceMeters: route.distance,
      durationSeconds: route.duration,
      geometry: route.geometry,
      steps,
    };
  }
}
