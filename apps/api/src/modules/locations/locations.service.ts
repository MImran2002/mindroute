import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface MapboxFeature {
  id: string;
  geometry?: { coordinates?: [number, number] };
  properties?: {
    full_address?: string;
    name?: string;
    place_formatted?: string;
  };
}

interface MapboxGeocodingResponse {
  features?: MapboxFeature[];
}

export interface LocationResult {
  id: string;
  name: string;
  fullAddress: string;
  latitude: number;
  longitude: number;
}

@Injectable()
export class LocationsService {
  constructor(private readonly config: ConfigService) {}

  async search(query: string): Promise<LocationResult[]> {
    const token = this.config.get<string>('mapbox.accessToken');
    if (!token) {
      throw new ServiceUnavailableException('Mapbox is not configured');
    }

    const params = new URLSearchParams({
      q: query,
      access_token: token,
      autocomplete: 'true',
      limit: '5',
      language: 'en',
      country: 'US',
      bbox: '-122.527,37.696,-122.348,37.833',
      proximity: '-122.4194,37.7749',
      types: 'address,street,place',
    });

    let response: Response;
    try {
      response = await fetch(
        `https://api.mapbox.com/search/geocode/v6/forward?${params.toString()}`,
        { signal: AbortSignal.timeout(8000) },
      );
    } catch {
      throw new BadGatewayException('Unable to reach the location provider');
    }

    if (!response.ok) {
      throw new BadGatewayException('Location search failed');
    }

    const data = (await response.json()) as MapboxGeocodingResponse;

    return (data.features ?? [])
      .map((feature): LocationResult | null => {
        const coordinates = feature.geometry?.coordinates;
        if (!coordinates) return null;

        const name = feature.properties?.name ?? 'Unnamed location';
        const fullAddress =
          feature.properties?.full_address ??
          [name, feature.properties?.place_formatted]
            .filter(Boolean)
            .join(', ');

        return {
          id: feature.id,
          name,
          fullAddress,
          longitude: coordinates[0],
          latitude: coordinates[1],
        };
      })
      .filter((result): result is LocationResult => result !== null);
  }
}
