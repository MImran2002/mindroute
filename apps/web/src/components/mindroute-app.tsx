'use client';
import type { Feature, LineString } from 'geojson';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import mapboxgl, { GeoJSONSource, LngLatBounds } from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { env } from '@/config/env';
import { apiRequest } from '@/lib/api-client';
import { getApiHealth } from '@/features/health/services/health.api';

type Coordinates = { latitude: number; longitude: number };
type LocationResult = Coordinates & {
  id: string;
  name: string;
  fullAddress: string;
};
type WalkingRoute = {
  id: string;
  distanceMeters: number;
  durationSeconds: number;
  geometry: { type: 'LineString'; coordinates: [number, number][] };
  instructions: Array<{
    instruction: string;
    distanceMeters: number;
    durationSeconds: number;
  }>;
};

const SF_CENTER: [number, number] = [-122.4194, 37.7749];
const DEFAULT_ORIGIN: Coordinates = {
  latitude: 37.7749,
  longitude: -122.4194,
};

function formatDistance(meters: number): string {
  const miles = meters / 1609.344;
  return miles < 0.1 ? `${Math.round(meters)} m` : `${miles.toFixed(1)} mi`;
}

function formatDuration(seconds: number): string {
  return `${Math.max(1, Math.round(seconds / 60))} min`;
}

export default function MindRouteApp() {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const originMarker = useRef<mapboxgl.Marker | null>(null);
  const destinationMarker = useRef<mapboxgl.Marker | null>(null);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<LocationResult[]>([]);
  const [origin, setOrigin] = useState<Coordinates>(DEFAULT_ORIGIN);
  const [destination, setDestination] = useState<LocationResult | null>(null);
  const [routes, setRoutes] = useState<WalkingRoute[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [status, setStatus] = useState('Choose your starting point and destination.');
  const [isSearching, setIsSearching] = useState(false);
  const [isRouting, setIsRouting] = useState(false);
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);

  useEffect(() => {
    getApiHealth()
      .then(() => setApiOnline(true))
      .catch(() => setApiOnline(false));
  }, []);

  useEffect(() => {
    if (!mapContainer.current || mapRef.current || !env.mapboxToken) return;

    mapboxgl.accessToken = env.mapboxToken;
    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: SF_CENTER,
      zoom: 12.5,
    });
    map.addControl(new mapboxgl.NavigationControl(), 'top-right');
    map.addControl(new mapboxgl.ScaleControl({ unit: 'imperial' }), 'bottom-right');
    mapRef.current = map;

    return () => {
      originMarker.current?.remove();
      destinationMarker.current?.remove();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  const drawRoute = useCallback((route: WalkingRoute) => {
    const map = mapRef.current;
    if (!map) return;

    const apply = () => {
      const source = map.getSource('selected-route') as GeoJSONSource | undefined;
      const data: Feature<LineString> = {
        type: 'Feature',
        properties: {},
        geometry: route.geometry,
      };

      if (source) {
        source.setData(data);
      } else {
        map.addSource('selected-route', { type: 'geojson', data });
        map.addLayer({
          id: 'selected-route-line',
          type: 'line',
          source: 'selected-route',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': '#2563eb', 'line-width': 7, 'line-opacity': 0.9 },
        });
      }

      const bounds = new LngLatBounds();
      route.geometry.coordinates.forEach((coordinate) => bounds.extend(coordinate));
      map.fitBounds(bounds, { padding: 70, maxZoom: 16, duration: 700 });
    };

    if (map.isStyleLoaded()) apply();
    else map.once('load', apply);
  }, []);

  async function searchLocations(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedQuery = query.trim();
    if (trimmedQuery.length < 2) {
      setStatus('Enter at least two characters.');
      return;
    }

    setIsSearching(true);
    setStatus('Searching San Francisco…');
    try {
      const data = await apiRequest<LocationResult[]>(
        `/locations/search?query=${encodeURIComponent(trimmedQuery)}`,
      );
      setResults(data);
      setStatus(data.length ? 'Select a destination.' : 'No matching destinations found.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Search failed.');
    } finally {
      setIsSearching(false);
    }
  }

  function chooseDestination(location: LocationResult) {
    setDestination(location);
    setResults([]);
    setQuery(location.fullAddress);
    setRoutes([]);
    setSelectedRouteId(null);
    setStatus('Destination selected. Generate walking routes when ready.');

    const map = mapRef.current;
    if (!map) return;
    destinationMarker.current?.remove();
    destinationMarker.current = new mapboxgl.Marker({ color: '#dc2626' })
      .setLngLat([location.longitude, location.latitude])
      .addTo(map);
    map.flyTo({ center: [location.longitude, location.latitude], zoom: 14 });
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      setStatus('Geolocation is not supported by this browser.');
      return;
    }

    setStatus('Requesting your location…');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coordinates = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        setOrigin(coordinates);
        setStatus('Current location selected as your starting point.');
        const map = mapRef.current;
        if (!map) return;
        originMarker.current?.remove();
        originMarker.current = new mapboxgl.Marker({ color: '#16a34a' })
          .setLngLat([coordinates.longitude, coordinates.latitude])
          .addTo(map);
        map.flyTo({ center: [coordinates.longitude, coordinates.latitude], zoom: 15 });
      },
      (error) => {
        const messages: Record<number, string> = {
          1: 'Location permission was denied. You can continue from central San Francisco.',
          2: 'Your location is unavailable right now.',
          3: 'The location request timed out.',
        };
        setStatus(messages[error.code] ?? 'Unable to retrieve your location.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }

  async function generateRoutes() {
    if (!destination) {
      setStatus('Select a destination first.');
      return;
    }

    setIsRouting(true);
    setStatus('Generating walking routes…');
    try {
      const params = new URLSearchParams({
        originLat: String(origin.latitude),
        originLng: String(origin.longitude),
        destinationLat: String(destination.latitude),
        destinationLng: String(destination.longitude),
      });
      const data = await apiRequest<WalkingRoute[]>(`/navigation/routes?${params}`);
      setRoutes(data);
      if (data[0]) {
        setSelectedRouteId(data[0].id);
        drawRoute(data[0]);
      }
      setStatus(`${data.length} walking route${data.length === 1 ? '' : 's'} available.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Route generation failed.');
    } finally {
      setIsRouting(false);
    }
  }

  function selectRoute(route: WalkingRoute) {
    setSelectedRouteId(route.id);
    drawRoute(route);
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div>
          <p className="eyebrow">Inclusive navigation prototype</p>
          <h1>MindRoute</h1>
          <p className="intro">
            Plan a clear walking route through San Francisco. AI-based cognitive-load ranking
            will be added later.
          </p>
        </div>

        <div className="api-status" data-online={apiOnline === true}>
          <span />
          {apiOnline === null ? 'Checking API…' : apiOnline ? 'Backend connected' : 'Backend offline'}
        </div>

        <section className="panel-section">
          <h2>1. Starting point</h2>
          <button className="secondary-button" type="button" onClick={useMyLocation}>
            Use my current location
          </button>
          <p className="small-copy">
            Current origin: {origin.latitude.toFixed(4)}, {origin.longitude.toFixed(4)}
          </p>
        </section>

        <section className="panel-section">
          <h2>2. Destination</h2>
          <form onSubmit={searchLocations} className="search-form">
            <label htmlFor="destination">Search within San Francisco</label>
            <div className="search-row">
              <input
                id="destination"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Example: Ferry Building"
                autoComplete="off"
              />
              <button type="submit" disabled={isSearching}>
                {isSearching ? '…' : 'Search'}
              </button>
            </div>
          </form>
          {results.length > 0 && (
            <ul className="results" aria-label="Destination results">
              {results.map((result) => (
                <li key={result.id}>
                  <button type="button" onClick={() => chooseDestination(result)}>
                    <strong>{result.name}</strong>
                    <span>{result.fullAddress}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button
            className="primary-button"
            type="button"
            onClick={generateRoutes}
            disabled={!destination || isRouting}
          >
            {isRouting ? 'Generating…' : 'Generate walking routes'}
          </button>
        </section>

        <section className="panel-section route-section">
          <h2>3. Route options</h2>
          {routes.length === 0 ? (
            <p className="empty-state">Route choices will appear here.</p>
          ) : (
            <div className="route-list">
              {routes.map((route, index) => (
                <button
                  type="button"
                  key={route.id}
                  className="route-card"
                  data-selected={selectedRouteId === route.id}
                  onClick={() => selectRoute(route)}
                >
                  <span>Option {index + 1}</span>
                  <strong>{formatDuration(route.durationSeconds)}</strong>
                  <small>{formatDistance(route.distanceMeters)}</small>
                </button>
              ))}
            </div>
          )}
        </section>

        <div className="status-message" role="status" aria-live="polite">
          {status}
        </div>
      </aside>

      <section className="map-region" aria-label="MindRoute map">
        {!env.mapboxToken && (
          <div className="map-error">
            Add NEXT_PUBLIC_MAPBOX_TOKEN to apps/web/.env.local to display the map.
          </div>
        )}
        <div ref={mapContainer} className="map-container" />
        <div className="map-legend">
          <span><i className="origin-dot" /> Origin</span>
          <span><i className="destination-dot" /> Destination</span>
          <span><i className="route-line" /> Walking route</span>
        </div>
      </section>
    </main>
  );
}
