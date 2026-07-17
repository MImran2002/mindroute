export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface LocationResult {
  id: string;
  name: string;
  fullAddress: string;
  coordinates: Coordinates;
}
