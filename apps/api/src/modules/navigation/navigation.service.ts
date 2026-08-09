import {
  BadGatewayException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';

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
  RouteStep,
} from './interfaces/candidate-route.interface';
import type {
  AggregatedRouteEnvironment,
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

export interface WalkingRoute {
  id: string;
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
    private readonly aiTrainingRecordService: AITrainingRecordService,
    private readonly aiTrainingDatasetService: AITrainingDatasetService,
    private readonly aiTrainingStorageService: AITrainingStorageService,
    private readonly environmentalAggregationService: EnvironmentalAggregationService,
    private readonly openStreetMapEnvironmentalProvider: OpenStreetMapEnvironmentalProvider,
    private readonly mockEnvironmentalProvider: MockEnvironmentalProvider,
  ) {}

  async getWalkingRoutes(input: GetRoutesDto): Promise<WalkingRoute[]> {
    const requestId = randomUUID();
    const capturedAt = new Date().toISOString();

    const token = this.config.get<string>('mapbox.accessToken');

    if (!token) {
      throw new ServiceUnavailableException('Mapbox is not configured');
    }

    const coordinates =
      `${input.originLng},${input.originLat};` +
      `${input.destinationLng},${input.destinationLat}`;

    const params = new URLSearchParams({
      access_token: token,
      alternatives: 'true',
      geometries: 'geojson',
      overview: 'full',
      steps: 'true',
      language: 'en',
      annotations: 'distance,duration',
    });

    let response: Response;

    try {
      response = await fetch(
        `https://api.mapbox.com/directions/v5/mapbox/walking/${coordinates}?${params.toString()}`,
        {
          signal: AbortSignal.timeout(10000),
        },
      );
    } catch {
      throw new BadGatewayException('Unable to reach the routing provider');
    }

    if (!response.ok) {
      throw new BadGatewayException('Walking route request failed');
    }

    const data = (await response.json()) as MapboxDirectionsResponse;

    if (!data.routes?.length) {
      throw new NotFoundException('No walking routes were found');
    }

    const candidateRoutes = data.routes
      .slice(0, 3)
      .map((route, index) => this.normalizeCandidateRoute(route, index));

    const fastestDurationSeconds = Math.min(
      ...candidateRoutes.map((route) => route.durationSeconds),
    );

    const analyzedRoutes = await Promise.all(
      candidateRoutes.map(async (route): Promise<WalkingRoute> => {
        const navigationFeatures = this.routeFeatureExtractor.extract(
          route,
          fastestDurationSeconds,
        );

        const samples = this.routeSamplingService.sampleRoute(route, 100);

        let sampleEnvironments: RouteSampleEnvironment[];
        let environmentalDataStatus: EnvironmentalDataStatus = 'real';

        try {
          sampleEnvironments =
            await this.openStreetMapEnvironmentalProvider.getEnvironmentForSamples(
              samples,
            );
        } catch {
          sampleEnvironments =
            await this.mockEnvironmentalProvider.getEnvironmentForSamples(
              samples,
            );

          environmentalDataStatus = 'fallback';
        }

        const environmentalSummary =
          this.environmentalAggregationService.aggregate(sampleEnvironments);

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
          environmentalDataStatus,
        });

        const score = this.routeBaselineScorerService.scoreRoute(comparisonRow);

        return {
          id: route.id,
          rank: 0,

          distanceMeters: route.distanceMeters,
          durationSeconds: route.durationSeconds,

          geometry: route.geometry,
          features,

          environmentalSummary,
          environmentalDataStatus,

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

    const rankedRoutes = analyzedRoutes
      .sort(
        (firstRoute, secondRoute) =>
          firstRoute.score.finalScore - secondRoute.score.finalScore,
      )
      .map((route, index) => ({
        ...route,
        rank: index + 1,
      }));

    const recommendedRoutes =
      this.routeRecommendationService.assignRecommendations(rankedRoutes);

    const routesWithTrainingRecords = recommendedRoutes.map((route) => ({
      ...route,
      trainingRecord: this.aiTrainingRecordService.createRecord({
        requestId,
        capturedAt,
        originLat: input.originLat,
        originLng: input.originLng,
        destinationLat: input.destinationLat,
        destinationLng: input.destinationLng,
        comparisonRow: route.comparisonRow,
        score: route.score,
        rank: route.rank,
        recommendation: route.recommendation!,
      }),
    }));

    await this.aiTrainingStorageService.appendRecords(
      routesWithTrainingRecords.map((route) => route.trainingRecord),
    );

    return routesWithTrainingRecords;
  }

  async getAITrainingRecords(input: GetRoutesDto): Promise<AITrainingRecord[]> {
    const routes = await this.getWalkingRoutes(input);

    return routes
      .map((route) => route.trainingRecord)
      .filter((record): record is AITrainingRecord => record !== undefined);
  }

  async getAITrainingRecordsCsv(input: GetRoutesDto): Promise<string> {
    const records = await this.getAITrainingRecords(input);

    return this.aiTrainingDatasetService.toCsv(records);
  }

  private normalizeCandidateRoute(
    route: MapboxRoute,
    index: number,
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
      distanceMeters: route.distance,
      durationSeconds: route.duration,
      geometry: route.geometry,
      steps,
    };
  }
}
