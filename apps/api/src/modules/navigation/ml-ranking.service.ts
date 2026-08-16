import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { RouteFeatures } from './interfaces/route-features.interface';

interface MlRankedRoute {
  routeId: string;
  mlScore: number;
  mlRank: number;
}

interface MlRankResponse {
  requestId: string;
  modelAvailable: boolean;
  productionReady: boolean;
  schemaVersion: string | null;
  rankedRoutes: MlRankedRoute[];
}

export interface MlRankingResult {
  modelAvailable: boolean;
  productionReady: boolean;
  schemaVersion: string | null;
  rankedRoutes: MlRankedRoute[];
}

@Injectable()
export class MlRankingService {
  private readonly logger = new Logger(
    MlRankingService.name,
  );

  constructor(
    private readonly config: ConfigService,
  ) {}

  async rankRoutes(
    requestId: string,
    routes: Array<{
      id: string;
      distanceMeters: number;
      durationSeconds: number;
      features: RouteFeatures;
    }>,
  ): Promise<MlRankingResult | null> {
    const serviceUrl =
      this.config.get<string>('ml.serviceUrl') ??
      process.env.ML_SERVICE_URL ??
      'http://127.0.0.1:8000';

    try {
      const response = await fetch(
        `${serviceUrl}/rank`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            requestId,
            routes: routes.map((route) => ({
              routeId: route.id,
              features: {
                distanceMeters:
                  route.distanceMeters,
                durationSeconds:
                  route.durationSeconds,

                estimatedShadeExposure:
                  route.features
                    .estimatedShadeExposure,

                greeneryExposure:
                  route.features.greeneryExposure,

                parkExposure:
                  route.features.parkExposure,

                pedestrianDensity:
                  route.features.pedestrianDensity,

                trafficExposure:
                  route.features.trafficExposure,

                noiseExposure:
                  route.features.noiseExposure,

                commercialActivityExposure:
                  route.features
                    .commercialActivityExposure,

                constructionExposure:
                  route.features
                    .constructionExposure,

                pointOfInterestDensity:
                  route.features
                    .pointOfInterestDensity,

                crossingComplexity:
                  route.features
                    .crossingComplexity,
              },
            })),
          }),
          signal: AbortSignal.timeout(3000),
        },
      );

      if (!response.ok) {
        this.logger.warn(
          `ML ranking service returned HTTP ${response.status}. ` +
            'Using baseline ranking.',
        );

        return null;
      }

      const result =
        (await response.json()) as MlRankResponse;

      return {
        modelAvailable: result.modelAvailable,
        productionReady: result.productionReady,
        schemaVersion: result.schemaVersion,
        rankedRoutes: result.rankedRoutes,
      };
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unknown ML service error';

      this.logger.warn(
        `ML ranking unavailable: ${message}. ` +
          'Using baseline ranking.',
      );

      return null;
    }
  }
}
