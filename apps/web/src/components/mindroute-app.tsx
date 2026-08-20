"use client";
import type { Feature, LineString } from "geojson";
import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import mapboxgl, { GeoJSONSource, LngLatBounds } from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { env } from "@/config/env";
import { apiRequest } from "@/lib/api-client";
import { getApiHealth } from "@/features/health/services/health.api";

type Coordinates = { latitude: number; longitude: number };
type ThemeMode = "day" | "night";
type RouteDisplayMode = "single" | "multiple";
type LocationResult = Coordinates & {
  id: string;
  name: string;
  fullAddress: string;
};
type RouteRecommendationLabel =
  | "Best overall"
  | "Lowest cognitive load"
  | "Most comfortable"
  | "Fastest"
  | "Alternative";

type RouteRecommendation = {
  primaryLabel: RouteRecommendationLabel;
  labels: RouteRecommendationLabel[];
  explanation: string;
};

type RouteScore = {
  cognitiveLoadScore: number;
  comfortScore: number;
  finalScore: number;
  breakdown: {
    navigationComplexity: number;
    crossingComplexity: number;
    environmentalStrain: number;
    routeEfficiency: number;
    environmentalComfort: number;
  };
  scoringMethod: "rule-based-v1";
};

type RouteComparisonRow = {
  routeId: string;

  distanceMeters: number;
  durationSeconds: number;
  detourPercent: number;

  turnCount: number;
  sharpTurnCount: number;
  decisionPointCount: number;
  instructionDensityPerKm: number;
  averageSegmentLengthMeters: number;
  shortSegmentCount: number;
  routeStraightness: number;

  crossingCount: number;
  signalizedCrossingCount: number;
  unsignalizedCrossingCount: number;
  complexIntersectionCount: number;
  crossingComplexity: number;

  estimatedShadeExposure: number;
  greeneryExposure: number;
  parkExposure: number;
  pedestrianDensity: number;
  trafficExposure: number;
  noiseExposure: number;
  commercialActivityExposure: number;
  constructionExposure: number;
  eventExposure: number;
  pointOfInterestDensity: number;

  dataConfidence: number;
  environmentalDataStatus: "real" | "fallback";
};

type WalkingRoute = {
  id: string;
  candidateSource: "direct" | "left-offset" | "right-offset";
  rank: number;

  distanceMeters: number;
  durationSeconds: number;

  geometry: {
    type: "LineString";
    coordinates: [number, number][];
  };

  comparisonRow: RouteComparisonRow;
  score: RouteScore;
  recommendation?: RouteRecommendation;

  instructions: Array<{
    instruction: string;
    distanceMeters: number;
    durationSeconds: number;
  }>;
};

type RouteGenerationDiagnostics = {
  plansAttempted: number;
  providerSuccesses: number;
  providerFailures: number;
  routesBeforeDeduplication: number;
  routesAfterDeduplication: number;
  duplicatesRemoved: number;
};

type NavigationRoutesResponse = {
  requestId: string;
  routes: WalkingRoute[];
  diagnostics: RouteGenerationDiagnostics;
};

type RouteSelectionResponse = {
  requestId: string;
  routeId: string;
  selectedAt: string;
  labelSource: "user-choice";
};

const SF_CENTER: [number, number] = [-122.4194, 37.7749];
const DEFAULT_ORIGIN: Coordinates = {
  latitude: 37.7749,
  longitude: -122.4194,
};

const MAP_STYLES: Record<ThemeMode, string> = {
  day: "mapbox://styles/mapbox/light-v11",
  night: "mapbox://styles/mapbox/dark-v11",
};

const NORMAL_ROUTE_COLORS: Record<RouteRecommendationLabel, string> = {
  "Best overall": "#2563eb",
  "Lowest cognitive load": "#7c3aed",
  "Most comfortable": "#16a34a",
  Fastest: "#ea580c",
  Alternative: "#64748b",
};

const COLOR_BLIND_ROUTE_COLORS: Record<RouteRecommendationLabel, string> = {
  "Best overall": "#0072b2",
  "Lowest cognitive load": "#cc79a7",
  "Most comfortable": "#009e73",
  Fastest: "#e69f00",
  Alternative: "#6b7280",
};

function getRouteColor(route: WalkingRoute, colorBlindMode: boolean): string {
  const label = route.recommendation?.primaryLabel ?? "Alternative";

  const palette = colorBlindMode
    ? COLOR_BLIND_ROUTE_COLORS
    : NORMAL_ROUTE_COLORS;

  return palette[label];
}

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

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LocationResult[]>([]);
  const [origin, setOrigin] = useState<Coordinates>(DEFAULT_ORIGIN);
  const [destination, setDestination] = useState<LocationResult | null>(null);
  const [routes, setRoutes] = useState<WalkingRoute[]>([]);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [confirmedRouteId, setConfirmedRouteId] = useState<string | null>(null);
  const [isConfirmingRoute, setIsConfirmingRoute] = useState(false);
  const [status, setStatus] = useState(
    "Choose your starting point and destination.",
  );
  const [isSearching, setIsSearching] = useState(false);
  const [isRouting, setIsRouting] = useState(false);
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);

  const [themeMode, setThemeMode] = useState<ThemeMode>("day");

  const [colorBlindMode, setColorBlindMode] = useState(false);

  const [routeDisplayMode, setRouteDisplayMode] =
    useState<RouteDisplayMode>("single");

  const lastAppliedThemeRef = useRef<ThemeMode>("day");

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
      style: MAP_STYLES.day,
      center: SF_CENTER,
      zoom: 12.5,
    });
    map.addControl(new mapboxgl.NavigationControl(), "top-right");
    map.addControl(
      new mapboxgl.ScaleControl({ unit: "imperial" }),
      "bottom-right",
    );
    mapRef.current = map;

    return () => {
      originMarker.current?.remove();
      destinationMarker.current?.remove();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  const clearRouteLayers = useCallback(() => {
    const map = mapRef.current;

    if (!map) {
      return;
    }

    const style = map.getStyle();

    const layerIds =
      style.layers
        ?.map((layer) => layer.id)
        .filter((id) => id.startsWith("mindroute-route-line-")) ?? [];

    layerIds.forEach((id) => {
      if (map.getLayer(id)) {
        map.removeLayer(id);
      }
    });

    const sourceIds = Object.keys(style.sources ?? {}).filter((id) =>
      id.startsWith("mindroute-route-source-"),
    );

    sourceIds.forEach((id) => {
      if (map.getSource(id)) {
        map.removeSource(id);
      }
    });
  }, []);

  const drawVisibleRoutes = useCallback(
    (visibleRoutes: WalkingRoute[], focusRouteId?: string | null) => {
      const map = mapRef.current;

      if (!map || visibleRoutes.length === 0) {
        return;
      }

      const apply = () => {
        clearRouteLayers();

        const bounds = new LngLatBounds();

        visibleRoutes.forEach((route, index) => {
          const sourceId = `mindroute-route-source-${index}`;

          const layerId = `mindroute-route-line-${index}`;

          const isFocused = focusRouteId === route.id;

          const data: Feature<LineString> = {
            type: "Feature",
            properties: {
              routeId: route.id,
              recommendation:
                route.recommendation?.primaryLabel ?? "Alternative",
            },
            geometry: route.geometry,
          };

          map.addSource(sourceId, {
            type: "geojson",
            data,
          });

          map.addLayer({
            id: layerId,
            type: "line",
            source: sourceId,

            layout: {
              "line-cap": "round",
              "line-join": "round",
            },

            paint: {
              "line-color": getRouteColor(route, colorBlindMode),

              "line-width": isFocused ? 8 : 5,

              "line-opacity": isFocused ? 0.95 : 0.72,
            },
          });

          route.geometry.coordinates.forEach((coordinate) => {
            bounds.extend(coordinate);
          });
        });

        map.fitBounds(bounds, {
          padding: 70,
          maxZoom: 16,
          duration: 700,
        });
      };

      if (map.isStyleLoaded()) {
        apply();
      } else {
        map.once("style.load", apply);
      }
    },
    [clearRouteLayers, colorBlindMode],
  );

  const drawRoute = useCallback(
    (route: WalkingRoute) => {
      drawVisibleRoutes([route], route.id);
    },
    [drawVisibleRoutes],
  );

  useEffect(() => {
    const map = mapRef.current;

    if (!map) {
      return;
    }

    if (lastAppliedThemeRef.current === themeMode) {
      return;
    }

    const applyTheme = () => {
      const redraw = () => {
        if (routes.length === 0) {
          return;
        }

        if (routeDisplayMode === "multiple") {
          drawVisibleRoutes(routes, selectedRouteId);

          return;
        }

        const selected =
          routes.find((route) => route.id === selectedRouteId) ?? routes[0];

        if (selected) {
          drawVisibleRoutes([selected], selected.id);
        }
      };

      lastAppliedThemeRef.current = themeMode;

      map.once("style.load", redraw);

      map.setStyle(MAP_STYLES[themeMode]);
    };

    if (map.isStyleLoaded()) {
      applyTheme();
    } else {
      map.once("style.load", applyTheme);
    }
  }, [themeMode, routes, routeDisplayMode, selectedRouteId, drawVisibleRoutes]);

  useEffect(() => {
    if (routes.length === 0) {
      return;
    }

    if (routeDisplayMode === "multiple") {
      drawVisibleRoutes(routes, selectedRouteId);

      return;
    }

    const selected =
      routes.find((route) => route.id === selectedRouteId) ?? routes[0];

    if (selected) {
      drawVisibleRoutes([selected], selected.id);
    }
  }, [
    colorBlindMode,
    routeDisplayMode,
    routes,
    selectedRouteId,
    drawVisibleRoutes,
  ]);

  async function searchLocations(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedQuery = query.trim();
    if (trimmedQuery.length < 2) {
      setStatus("Enter at least two characters.");
      return;
    }

    setIsSearching(true);
    setStatus("Searching San Francisco…");
    try {
      const data = await apiRequest<LocationResult[]>(
        `/locations/search?query=${encodeURIComponent(trimmedQuery)}`,
      );
      setResults(data);
      setStatus(
        data.length
          ? "Select a destination."
          : "No matching destinations found.",
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Search failed.");
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
    setStatus("Destination selected. Generate walking routes when ready.");

    const map = mapRef.current;
    if (!map) return;
    destinationMarker.current?.remove();
    destinationMarker.current = new mapboxgl.Marker({ color: "#dc2626" })
      .setLngLat([location.longitude, location.latitude])
      .addTo(map);
    map.flyTo({ center: [location.longitude, location.latitude], zoom: 14 });
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      setStatus("Geolocation is not supported by this browser.");
      return;
    }

    setStatus("Requesting your location…");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coordinates = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        setOrigin(coordinates);
        setStatus("Current location selected as your starting point.");
        const map = mapRef.current;
        if (!map) return;
        originMarker.current?.remove();
        originMarker.current = new mapboxgl.Marker({ color: "#16a34a" })
          .setLngLat([coordinates.longitude, coordinates.latitude])
          .addTo(map);
        map.flyTo({
          center: [coordinates.longitude, coordinates.latitude],
          zoom: 15,
        });
      },
      (error) => {
        const messages: Record<number, string> = {
          1: "Location permission was denied. You can continue from central San Francisco.",
          2: "Your location is unavailable right now.",
          3: "The location request timed out.",
        };
        setStatus(messages[error.code] ?? "Unable to retrieve your location.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }

  async function generateRoutes() {
    if (!destination) {
      setStatus("Select a destination first.");
      return;
    }

    setIsRouting(true);
    setStatus("Generating walking routes…");
    try {
      const params = new URLSearchParams({
        originLat: String(origin.latitude),
        originLng: String(origin.longitude),
        destinationLat: String(destination.latitude),
        destinationLng: String(destination.longitude),
      });
      const data = await apiRequest<NavigationRoutesResponse>(
        `/navigation/routes?${params}`,
      );

      setRoutes(data.routes);
      setRequestId(data.requestId);
      setConfirmedRouteId(null);

      if (data.routes[0]) {
        setSelectedRouteId(data.routes[0].id);

        if (routeDisplayMode === "multiple") {
          drawVisibleRoutes(data.routes, data.routes[0].id);
        } else {
          drawRoute(data.routes[0]);
        }
      }

      setStatus(
        `${data.routes.length} walking route${data.routes.length === 1 ? "" : "s"} available.`,
      );
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Route generation failed.",
      );
    } finally {
      setIsRouting(false);
    }
  }

  function selectRoute(route: WalkingRoute) {
    setSelectedRouteId(route.id);

    if (routeDisplayMode === "multiple") {
      drawVisibleRoutes(routes, route.id);
    } else {
      drawRoute(route);
    }
  }

  async function confirmRoute(route: WalkingRoute) {
    if (!requestId || confirmedRouteId || isConfirmingRoute) {
      return;
    }

    setIsConfirmingRoute(true);
    setStatus("Saving your route choice…");

    try {
      await apiRequest<RouteSelectionResponse>("/navigation/route-selections", {
        method: "POST",
        body: JSON.stringify({
          requestId,
          routeId: route.id,
        }),
      });

      setConfirmedRouteId(route.id);
      setSelectedRouteId(route.id);
      if (routeDisplayMode === "multiple") {
        drawVisibleRoutes(routes, route.id);
      } else {
        drawRoute(route);
      }

      setStatus(
        "Route selected. Your choice was saved and can be used as preference training data.",
      );
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Unable to save your route choice.",
      );
    } finally {
      setIsConfirmingRoute(false);
    }
  }

  return (
    <main className="app-shell" data-theme={themeMode}>
      <aside className="sidebar">
        <div>
          <p className="eyebrow">Inclusive navigation prototype</p>
          <h1>MindRoute</h1>
          <p className="intro">
            Plan a clear walking route through San Francisco with personalized
            cognitive-load and comfort-aware recommendations.
          </p>
        </div>

        <div className="api-status" data-online={apiOnline === true}>
          <span />
          {apiOnline === null
            ? "Checking API…"
            : apiOnline
              ? "Backend connected"
              : "Backend offline"}
        </div>

        <section className="panel-section display-settings">
          <h2>Display settings</h2>

          <div className="setting-group">
            <span className="setting-label">Theme</span>

            <div
              className="segmented-control"
              role="group"
              aria-label="Map theme"
            >
              {(["day", "night"] as ThemeMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  data-active={themeMode === mode}
                  onClick={() => setThemeMode(mode)}
                >
                  {mode[0].toUpperCase() + mode.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <label className="toggle-row">
            <input
              type="checkbox"
              checked={colorBlindMode}
              onChange={(event) => setColorBlindMode(event.target.checked)}
            />

            <span>
              <strong>Color-blind-friendly colors</strong>

              <small>Use a higher-contrast route palette.</small>
            </span>
          </label>
        </section>

        <section className="panel-section">
          <h2>1. Starting point</h2>
          <button
            className="secondary-button"
            type="button"
            onClick={useMyLocation}
          >
            Use my current location
          </button>
          <p className="small-copy">
            Current origin: {origin.latitude.toFixed(4)},{" "}
            {origin.longitude.toFixed(4)}
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
                {isSearching ? "…" : "Search"}
              </button>
            </div>
          </form>
          {results.length > 0 && (
            <ul className="results" aria-label="Destination results">
              {results.map((result) => (
                <li key={result.id}>
                  <button
                    type="button"
                    onClick={() => chooseDestination(result)}
                  >
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
            {isRouting ? "Generating…" : "Generate walking routes"}
          </button>
        </section>

        <section className="panel-section route-section">
          <div className="route-section-heading">
            <h2>3. Route options</h2>

            {routes.length > 0 && (
              <div
                className="segmented-control compact"
                role="group"
                aria-label="Route display mode"
              >
                <button
                  type="button"
                  data-active={routeDisplayMode === "single"}
                  onClick={() => setRouteDisplayMode("single")}
                >
                  Single
                </button>

                <button
                  type="button"
                  data-active={routeDisplayMode === "multiple"}
                  onClick={() => setRouteDisplayMode("multiple")}
                >
                  Multiple
                </button>
              </div>
            )}
          </div>
          {routes.length === 0 ? (
            <p className="empty-state">Route choices will appear here.</p>
          ) : (
            <div className="route-list">
              {routes.map((route, index) => (
                <div
                  key={route.id}
                  className="route-card"
                  data-selected={selectedRouteId === route.id}
                >
                  <div
                    className="route-color-strip"
                    style={{
                      backgroundColor: getRouteColor(route, colorBlindMode),
                    }}
                    aria-hidden="true"
                  />

                  <div className="route-card-header">
                    <span className="route-option-label">
                      <i
                        className="route-color-dot"
                        style={{
                          backgroundColor: getRouteColor(route, colorBlindMode),
                        }}
                      />
                      Option {index + 1}
                    </span>
                    {route.recommendation?.primaryLabel && (
                      <span className="route-recommendation">
                        {route.recommendation.primaryLabel}
                      </span>
                    )}
                  </div>

                  <div className="route-card-summary">
                    <strong>{formatDuration(route.durationSeconds)}</strong>
                    <small>{formatDistance(route.distanceMeters)}</small>
                  </div>

                  <div className="route-score-row">
                    <span>Cognitive load</span>
                    <strong>
                      {Math.round(route.score.cognitiveLoadScore)}
                    </strong>
                  </div>

                  <div className="route-score-row">
                    <span>Comfort</span>
                    <strong>{Math.round(route.score.comfortScore)}</strong>
                  </div>

                  <div className="route-environment">
                    <span>
                      Greenery{" "}
                      {Math.round(route.comparisonRow.greeneryExposure * 100)}%
                    </span>
                    <span>
                      Shade{" "}
                      {Math.round(
                        route.comparisonRow.estimatedShadeExposure * 100,
                      )}
                      %
                    </span>
                    <span>
                      Pedestrians{" "}
                      {Math.round(route.comparisonRow.pedestrianDensity * 100)}%
                    </span>
                    <span>
                      Traffic{" "}
                      {Math.round(route.comparisonRow.trafficExposure * 100)}%
                    </span>
                  </div>

                  {route.recommendation?.explanation && (
                    <p className="route-explanation">
                      {route.recommendation.explanation}
                    </p>
                  )}
                  <div className="route-card-actions">
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => selectRoute(route)}
                    >
                      {routeDisplayMode === "multiple"
                        ? "Highlight"
                        : "Preview"}
                    </button>

                    <button
                      type="button"
                      className="primary-button"
                      onClick={() => confirmRoute(route)}
                      disabled={confirmedRouteId !== null || isConfirmingRoute}
                    >
                      {confirmedRouteId === route.id
                        ? "Selected"
                        : isConfirmingRoute
                          ? "Saving…"
                          : "Use this route"}
                    </button>
                  </div>
                </div>
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
            Add NEXT_PUBLIC_MAPBOX_TOKEN to apps/web/.env.local to display the
            map.
          </div>
        )}
        <div ref={mapContainer} className="map-container" />
        <div className="map-legend">
          <span>
            <i className="origin-dot" />
            Origin
          </span>

          <span>
            <i className="destination-dot" />
            Destination
          </span>

          {routes.length === 0 ? (
            <span>
              <i className="route-line" />
              Walking route
            </span>
          ) : (
            routes.map((route) => (
              <span key={route.id}>
                <i
                  className="route-line"
                  style={{
                    backgroundColor: getRouteColor(route, colorBlindMode),
                  }}
                />

                {route.recommendation?.primaryLabel ?? "Alternative"}
              </span>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
