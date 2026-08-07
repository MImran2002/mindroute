export interface OpenStreetMapElement {
  type: 'node' | 'way' | 'relation';
  id: number;

  lat?: number;
  lon?: number;

  center?: {
    lat: number;
    lon: number;
  };

  tags?: Record<string, string>;
}

export interface OpenStreetMapOverpassResponse {
  version?: number;
  generator?: string;
  osm3s?: {
    timestamp_osm_base?: string;
    copyright?: string;
  };
  elements: OpenStreetMapElement[];
}
