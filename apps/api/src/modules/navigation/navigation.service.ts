import {
  BadGatewayException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { GetRoutesDto } from './dto/get-routes.dto';
import type {
  CandidateRoute,
  MapboxDirectionsResponse,
  MapboxRoute,
  RouteStep,
} from './interfaces/candidate-route.interface';

export interface WalkingRoute {
  id: string;
  distanceMeters: number;
  durationSeconds: number;

  geometry: {
    type: 'LineString';
    coordinates: [number, number][];
  };

  instructions: Array<{
    instruction: string;
    distanceMeters: number;
    durationSeconds: number;
  }>;
}

@Injectable()
export class NavigationService {
  constructor(private readonly config: ConfigService) {}

  async getWalkingRoutes(input: GetRoutesDto): Promise<WalkingRoute[]> {
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

      // Request segment-level distance and duration information.
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

    /*
     * Normalize every Mapbox route into MindRoute's internal
     * CandidateRoute format.
     *
     * Future feature-extraction and environmental-enrichment
     * services will consume these candidate routes rather than
     * depending directly on Mapbox's response format.
     */
    const candidateRoutes = data.routes
      .slice(0, 3)
      .map((route, index) => this.normalizeCandidateRoute(route, index));

    /*
     * Keep the current API response compatible with the frontend.
     * Later we will add extracted features and environmental values
     * to this response.
     */
    return candidateRoutes.map((route) => ({
      id: route.id,
      distanceMeters: route.distanceMeters,
      durationSeconds: route.durationSeconds,
      geometry: route.geometry,

      instructions: route.steps.map((step) => ({
        instruction: step.maneuver.instruction ?? 'Continue',
        distanceMeters: step.distanceMeters,
        durationSeconds: step.durationSeconds,
      })),
    }));
  }

  /**
   * Converts a provider-specific Mapbox route into MindRoute's
   * provider-independent CandidateRoute representation.
   */
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
