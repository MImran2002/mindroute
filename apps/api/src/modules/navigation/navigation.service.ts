import {
  BadGatewayException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { GetRoutesDto } from './dto/get-routes.dto';

interface MapboxRoute {
  distance: number;
  duration: number;
  geometry: {
    type: 'LineString';
    coordinates: [number, number][];
  };
  legs?: Array<{
    steps?: Array<{
      maneuver?: { instruction?: string };
      distance?: number;
      duration?: number;
    }>;
  }>;
}

interface DirectionsResponse {
  routes?: MapboxRoute[];
}

export interface WalkingRoute {
  id: string;
  distanceMeters: number;
  durationSeconds: number;
  geometry: { type: 'LineString'; coordinates: [number, number][] };
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

    const coordinates = `${input.originLng},${input.originLat};${input.destinationLng},${input.destinationLat}`;
    const params = new URLSearchParams({
      access_token: token,
      alternatives: 'true',
      geometries: 'geojson',
      overview: 'full',
      steps: 'true',
      language: 'en',
    });

    let response: Response;
    try {
      response = await fetch(
        `https://api.mapbox.com/directions/v5/mapbox/walking/${coordinates}?${params.toString()}`,
        { signal: AbortSignal.timeout(10000) },
      );
    } catch {
      throw new BadGatewayException('Unable to reach the routing provider');
    }

    if (!response.ok) {
      throw new BadGatewayException('Walking route request failed');
    }

    const data = (await response.json()) as DirectionsResponse;
    if (!data.routes?.length) {
      throw new NotFoundException('No walking routes were found');
    }

    return data.routes.slice(0, 3).map((route, index) => ({
      id: `route-${index + 1}`,
      distanceMeters: route.distance,
      durationSeconds: route.duration,
      geometry: route.geometry,
      instructions: (route.legs ?? []).flatMap((leg) =>
        (leg.steps ?? []).map((step) => ({
          instruction: step.maneuver?.instruction ?? 'Continue',
          distanceMeters: step.distance ?? 0,
          durationSeconds: step.duration ?? 0,
        })),
      ),
    }));
  }
}
