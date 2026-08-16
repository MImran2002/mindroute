import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import type {
  EnvironmentalFeatureType,
  EnvironmentalObservation,
  RouteSampleEnvironment,
} from '../interfaces/environmental-observation.interface';
import type { RouteCoordinate } from '../interfaces/candidate-route.interface';
import type { RouteSamplePoint } from '../interfaces/route-sample.interface';
import type { EnvironmentalProvider } from './environmental-provider.interface';
import { MockEnvironmentalProvider } from './mock-environmental.provider';
import type {
  OpenStreetMapElement,
  OpenStreetMapOverpassResponse,
} from './openstreetmap.types';

interface BoundingBox {
  south: number;
  west: number;
  north: number;
  east: number;
}

export interface EnvironmentalRetrievalDiagnostics {
  sampleCount: number;
  groupCount: number;
  liveGroups: number;
  cacheGroups: number;
  fallbackGroups: number;
  fallbackReasons: string[];
  durationMs: number;
}

@Injectable()
export class OpenStreetMapEnvironmentalProvider implements EnvironmentalProvider {
  constructor(
    private readonly mockEnvironmentalProvider: MockEnvironmentalProvider,
  ) {}

  private readonly cacheTtlMs = 30 * 60 * 1000;

  private lastDataSource: 'live' | 'cache' | 'mixed' | 'fallback' = 'live';

  private lastRetrievalDiagnostics: EnvironmentalRetrievalDiagnostics = {
    sampleCount: 0,
    groupCount: 0,
    liveGroups: 0,
    cacheGroups: 0,
    fallbackGroups: 0,
    fallbackReasons: [],
    durationMs: 0,
  };

  private readonly elementCache = new Map<
    string,
    {
      elements: OpenStreetMapElement[];
      expiresAt: number;
    }
  >();

  private readonly persistentCacheTtlMs =
    24 * 60 * 60 * 1000;

  private readonly persistentCachePath = join(
    process.cwd(),
    'data',
    'osm-environment-cache.json',
  );

  private persistentCacheLoaded = false;

  private readonly logger = new Logger(OpenStreetMapEnvironmentalProvider.name);

  private readonly providerCooldownMs = 10 * 1000;

  private readonly environmentalRequestBudgetMs = 45 * 1000;

  private readonly providerCooldownUntil = new Map<string, number>();

  private preferredOverpassUrl: string | null = null;

  private readonly overpassUrls: string[] = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass.private.coffee/api/interpreter',
  ];

  async getEnvironmentForSamples(
    samples: RouteSamplePoint[],
  ): Promise<RouteSampleEnvironment[]> {
    if (samples.length === 0) {
      return [];
    }

    const environmentalRequestStartedAt = Date.now();

    const sampleGroups = this.chunkSamples(samples, 8);

    const retrievedAt = new Date().toISOString();
    const environments: RouteSampleEnvironment[] = [];

    let usedLiveData = false;
    let usedCacheData = false;
    let usedFallbackData = false;

    let liveGroups = 0;
    let cacheGroups = 0;
    let fallbackGroups = 0;
    const fallbackReasons: string[] = [];

    for (const sampleGroup of sampleGroups) {
      const boundingBox = this.calculateBoundingBox(sampleGroup, 150);

      try {
        const elements = await this.fetchElements(
          boundingBox,
          environmentalRequestStartedAt,
        );

        if (this.lastDataSource === 'cache') {
          usedCacheData = true;
          cacheGroups += 1;
        } else {
          usedLiveData = true;
          liveGroups += 1;
        }

        for (const sample of sampleGroup) {
          environments.push({
            sampleId: sample.id,
            routeId: sample.routeId,
            coordinate: sample.coordinate,
            observations: this.createObservationsForSample(
              sample,
              elements,
              retrievedAt,
            ),
          });
        }
      } catch (error: unknown) {
        usedFallbackData = true;
        fallbackGroups += 1;

        const message =
          error instanceof Error
            ? error.message
            : 'Unknown environmental retrieval error';

        fallbackReasons.push(message);

        this.logger.warn(
          `Using mock environmental data for ${sampleGroup.length} sample(s): ${message}`,
        );

        const fallbackEnvironments =
          await this.mockEnvironmentalProvider.getEnvironmentForSamples(
            sampleGroup,
          );

        environments.push(...fallbackEnvironments);
      }
    }

    if (usedFallbackData && (usedLiveData || usedCacheData)) {
      this.lastDataSource = 'mixed';
    } else if (usedFallbackData) {
      this.lastDataSource = 'fallback';
    } else if (usedLiveData) {
      this.lastDataSource = 'live';
    } else if (usedCacheData) {
      this.lastDataSource = 'cache';
    }

    this.lastRetrievalDiagnostics = {
      sampleCount: samples.length,
      groupCount: sampleGroups.length,
      liveGroups,
      cacheGroups,
      fallbackGroups,
      fallbackReasons,
      durationMs: Date.now() - environmentalRequestStartedAt,
    };

    return environments;
  }

  private chunkSamples(
    samples: RouteSamplePoint[],
    groupSize: number,
  ): RouteSamplePoint[][] {
    const samplesByRoute = new Map<string, RouteSamplePoint[]>();

    for (const sample of samples) {
      const routeSamples = samplesByRoute.get(sample.routeId) ?? [];

      routeSamples.push(sample);

      samplesByRoute.set(sample.routeId, routeSamples);
    }

    const groups: RouteSamplePoint[][] = [];

    for (const routeSamples of samplesByRoute.values()) {
      for (let index = 0; index < routeSamples.length; index += groupSize) {
        groups.push(routeSamples.slice(index, index + groupSize));
      }
    }

    return groups;
  }

  private loadPersistentCache(): void {
    if (this.persistentCacheLoaded) {
      return;
    }

    this.persistentCacheLoaded = true;

    if (!existsSync(this.persistentCachePath)) {
      return;
    }

    try {
      const raw = readFileSync(
        this.persistentCachePath,
        'utf8',
      );

      const stored = JSON.parse(raw) as Record<
        string,
        {
          elements: OpenStreetMapElement[];
          expiresAt: number;
        }
      >;

      const now = Date.now();
      let loadedCount = 0;

      for (const [cacheKey, entry] of Object.entries(stored)) {
        if (entry.expiresAt <= now) {
          continue;
        }

        this.elementCache.set(cacheKey, entry);
        loadedCount += 1;
      }

      this.logger.log(
        `Loaded ${loadedCount} persistent OSM cache entr${
          loadedCount === 1 ? 'y' : 'ies'
        }`,
      );
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unknown persistent cache error';

      this.logger.warn(
        `Could not load persistent OSM cache: ${message}`,
      );
    }
  }

  private savePersistentCache(): void {
    try {
      mkdirSync(
        dirname(this.persistentCachePath),
        { recursive: true },
      );

      const now = Date.now();

      const stored: Record<
        string,
        {
          elements: OpenStreetMapElement[];
          expiresAt: number;
        }
      > = {};

      for (const [cacheKey, entry] of this.elementCache.entries()) {
        if (entry.expiresAt <= now) {
          continue;
        }

        stored[cacheKey] = entry;
      }

      writeFileSync(
        this.persistentCachePath,
        JSON.stringify(stored),
        'utf8',
      );
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unknown persistent cache error';

      this.logger.warn(
        `Could not save persistent OSM cache: ${message}`,
      );
    }
  }

  private parseCacheBoundingBox(
    cacheKey: string,
  ): BoundingBox | null {
    const parts = cacheKey.split(':');

    if (
      parts.length !== 5 ||
      parts[0] !== 'osm-query-v1'
    ) {
      return null;
    }

    const south = Number(parts[1]);
    const west = Number(parts[2]);
    const north = Number(parts[3]);
    const east = Number(parts[4]);

    if (
      !Number.isFinite(south) ||
      !Number.isFinite(west) ||
      !Number.isFinite(north) ||
      !Number.isFinite(east)
    ) {
      return null;
    }

    return {
      south,
      west,
      north,
      east,
    };
  }

  private findContainingCachedElements(
    boundingBox: BoundingBox,
  ): OpenStreetMapElement[] | null {
    const now = Date.now();

    let bestMatch:
      | {
          elements: OpenStreetMapElement[];
          area: number;
        }
      | null = null;

    for (const [cacheKey, entry] of this.elementCache.entries()) {
      if (entry.expiresAt <= now) {
        continue;
      }

      const cachedBox =
        this.parseCacheBoundingBox(cacheKey);

      if (!cachedBox) {
        continue;
      }

      const containsRequestedBox =
        cachedBox.south <= boundingBox.south &&
        cachedBox.west <= boundingBox.west &&
        cachedBox.north >= boundingBox.north &&
        cachedBox.east >= boundingBox.east;

      if (!containsRequestedBox) {
        continue;
      }

      const area =
        (cachedBox.north - cachedBox.south) *
        (cachedBox.east - cachedBox.west);

      if (
        bestMatch === null ||
        area < bestMatch.area
      ) {
        bestMatch = {
          elements: entry.elements,
          area,
        };
      }
    }

    return bestMatch?.elements ?? null;
  }

  private async fetchElements(
    boundingBox: BoundingBox,
    environmentalRequestStartedAt: number,
  ): Promise<OpenStreetMapElement[]> {
    this.loadPersistentCache();

    const cacheKey = this.createCacheKey(boundingBox);

    const cached = this.elementCache.get(cacheKey);

    if (cached) {
      if (cached.expiresAt > Date.now()) {
        this.logger.log(
          `Overpass cache hit for ${cacheKey}: ` +
            `${cached.elements.length} element(s)`,
        );

        this.lastDataSource = 'cache';

        return cached.elements;
      }

      this.elementCache.delete(cacheKey);
      this.savePersistentCache();
    }

    const containingCachedElements =
      this.findContainingCachedElements(
        boundingBox,
      );

    if (containingCachedElements) {
      this.logger.log(
        `Overpass containing-region cache hit for ${cacheKey}: ` +
          `${containingCachedElements.length} element(s)`,
      );

      this.lastDataSource = 'cache';

      return containingCachedElements;
    }

    const elapsedRequestMs =
      Date.now() - environmentalRequestStartedAt;

    if (elapsedRequestMs >= this.environmentalRequestBudgetMs) {
      throw new BadGatewayException(
        `Environmental retrieval time budget exhausted after ${elapsedRequestMs}ms.`,
      );
    }

    const query = this.buildOverpassQuery(boundingBox);

    const failures: string[] = [];
    let providersAttempted = 0;
    let providersSkippedForCooldown = 0;

    const orderedOverpassUrls =
      this.preferredOverpassUrl === null
        ? this.overpassUrls
        : [
            this.preferredOverpassUrl,
            ...this.overpassUrls.filter(
              (url) => url !== this.preferredOverpassUrl,
            ),
          ];

    for (const overpassUrl of orderedOverpassUrls) {
      const cooldownUntil = this.providerCooldownUntil.get(overpassUrl);

      if (cooldownUntil !== undefined && cooldownUntil > Date.now()) {
        providersSkippedForCooldown += 1;

        this.logger.warn(`Skipping ${overpassUrl}; provider cooling down`);

        continue;
      }

      providersAttempted += 1;

      const elapsedRequestMs =
        Date.now() - environmentalRequestStartedAt;

      const remainingRequestBudgetMs =
        this.environmentalRequestBudgetMs - elapsedRequestMs;

      if (remainingRequestBudgetMs <= 0) {
        throw new BadGatewayException(
          `Environmental retrieval time budget exhausted after ${elapsedRequestMs}ms.`,
        );
      }

      const providerTimeoutMs = Math.min(
        this.getProviderTimeoutMs(overpassUrl),
        remainingRequestBudgetMs,
      );

      const startedAt = Date.now();

      try {
        const response = await fetch(overpassUrl, {
          method: 'POST',

          headers: {
            'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
            Accept: 'application/json',
            'User-Agent': 'MindRoute/0.1 development prototype',
          },

          body: new URLSearchParams({
            data: query,
          }).toString(),

          signal: AbortSignal.timeout(providerTimeoutMs),
        });

        const durationMs = Date.now() - startedAt;

        if (!response.ok) {
          const failure =
            `${overpassUrl}: HTTP ${response.status} ` +
            `after ${durationMs}ms`;

          failures.push(failure);
          this.logger.warn(failure);

          this.providerCooldownUntil.set(
            overpassUrl,
            Date.now() + this.providerCooldownMs,
          );

          continue;
        }

        const data = (await response.json()) as OpenStreetMapOverpassResponse;

        const elements = data.elements ?? [];

        this.logger.log(
          `Overpass success from ${overpassUrl}: ` +
            `${elements.length} element(s) in ${durationMs}ms`,
        );

        this.preferredOverpassUrl = overpassUrl;

        this.logger.log(`Preferred Overpass provider is now ${overpassUrl}`);

        this.providerCooldownUntil.delete(overpassUrl);

        this.lastDataSource = 'live';

        this.elementCache.set(cacheKey, {
          elements,
          expiresAt:
            Date.now() + this.persistentCacheTtlMs,
        });

        this.savePersistentCache();

        return elements;
      } catch (error: unknown) {
        const durationMs = Date.now() - startedAt;

        const message =
          error instanceof Error ? error.message : 'Unknown request error';

        const failure = `${overpassUrl}: ${message} after ${durationMs}ms`;

        failures.push(failure);
        this.logger.warn(failure);

        this.providerCooldownUntil.set(
          overpassUrl,
          Date.now() + this.providerCooldownMs,
        );

        if (
          Date.now() - environmentalRequestStartedAt >=
          this.environmentalRequestBudgetMs
        ) {
          break;
        }
      }
    }

    if (
      providersAttempted === 0 &&
      providersSkippedForCooldown === orderedOverpassUrls.length
    ) {
      throw new BadGatewayException(
        'All OpenStreetMap environmental providers are temporarily cooling down after earlier failures.',
      );
    }

    throw new BadGatewayException(
      `All OpenStreetMap environmental providers failed: ${failures.join(
        '; ',
      )}`,
    );
  }

  private getProviderTimeoutMs(_overpassUrl: string): number {
    return 9000;
  }

  private buildOverpassQuery(boundingBox: BoundingBox): string {
    const box =
      `${boundingBox.south},` +
      `${boundingBox.west},` +
      `${boundingBox.north},` +
      `${boundingBox.east}`;

    return `
[out:json][timeout:8];
(
  node["amenity"](${box});
  node["shop"](${box});
  node["tourism"](${box});

  node["leisure"="park"](${box});
  way["leisure"="park"](${box});

  node["leisure"="garden"](${box});
  way["leisure"="garden"](${box});

  node["natural"="tree"](${box});

  node["natural"="wood"](${box});
  way["natural"="wood"](${box});

  node["landuse"="forest"](${box});
  way["landuse"="forest"](${box});

  node["landuse"="grass"](${box});
  way["landuse"="grass"](${box});

  node["highway"="crossing"](${box});
  node["highway"="traffic_signals"](${box});

  way["highway"="primary"](${box});
  way["highway"="secondary"](${box});
  way["highway"="tertiary"](${box});

  way["highway"="pedestrian"](${box});
  way["highway"="construction"](${box});
);
out center tags;
`;
  }

  private createCacheKey(boundingBox: BoundingBox): string {
    return [
      'osm-query-v1',
      boundingBox.south.toFixed(4),
      boundingBox.west.toFixed(4),
      boundingBox.north.toFixed(4),
      boundingBox.east.toFixed(4),
    ].join(':');
  }

  private createObservationsForSample(
    sample: RouteSamplePoint,
    elements: OpenStreetMapElement[],
    retrievedAt: string,
  ): EnvironmentalObservation[] {
    const nearbyElements = elements
      .map((element) => ({
        element,
        coordinate: this.getElementCoordinate(element),
      }))
      .filter(
        (
          item,
        ): item is {
          element: OpenStreetMapElement;
          coordinate: RouteCoordinate;
        } => item.coordinate !== null,
      )
      .map((item) => ({
        ...item,
        distanceMeters: this.haversineDistance(
          sample.coordinate,
          item.coordinate,
        ),
      }))
      .filter((item) => item.distanceMeters <= 150);

    const observations: EnvironmentalObservation[] = [];

    observations.push(
      this.createObservation(
        sample,
        'greenery',
        this.calculateGreeneryValue(nearbyElements),
        0.65,
        retrievedAt,
        nearbyElements.length,
      ),
    );

    observations.push(
      this.createObservation(
        sample,
        'park',
        this.calculateParkValue(nearbyElements),
        0.7,
        retrievedAt,
        nearbyElements.length,
      ),
    );

    observations.push(
      this.createObservation(
        sample,
        'point-of-interest',
        this.calculatePoiValue(nearbyElements),
        0.7,
        retrievedAt,
        nearbyElements.length,
      ),
    );

    observations.push(
      this.createObservation(
        sample,
        'commercial-activity',
        this.calculateCommercialValue(nearbyElements),
        0.65,
        retrievedAt,
        nearbyElements.length,
      ),
    );

    observations.push(
      this.createObservation(
        sample,
        'traffic',
        this.calculateTrafficValue(nearbyElements),
        0.55,
        retrievedAt,
        nearbyElements.length,
      ),
    );

    observations.push(
      this.createObservation(
        sample,
        'shade',
        this.calculateShadeValue(nearbyElements),
        0.5,
        retrievedAt,
        nearbyElements.length,
      ),
    );

    observations.push(
      this.createObservation(
        sample,
        'pedestrian-density',
        this.calculatePedestrianValue(nearbyElements),
        0.5,
        retrievedAt,
        nearbyElements.length,
      ),
    );

    observations.push(
      this.createObservation(
        sample,
        'noise',
        this.calculateNoiseValue(nearbyElements),
        0.45,
        retrievedAt,
        nearbyElements.length,
      ),
    );

    observations.push(
      this.createObservation(
        sample,
        'construction',
        this.calculateConstructionValue(nearbyElements),
        0.55,
        retrievedAt,
        nearbyElements.length,
      ),
    );

    return observations;
  }

  private calculateGreeneryValue(
    nearbyElements: Array<{
      element: OpenStreetMapElement;
      distanceMeters: number;
    }>,
  ): number {
    const greeneryElements = nearbyElements.filter(({ element }) => {
      const tags = element.tags ?? {};

      return (
        tags.natural === 'tree' ||
        tags.natural === 'wood' ||
        tags.landuse === 'forest' ||
        tags.landuse === 'grass' ||
        tags.leisure === 'park' ||
        tags.leisure === 'garden'
      );
    });

    return this.normalizeCount(greeneryElements.length, 8);
  }

  private calculateParkValue(
    nearbyElements: Array<{
      element: OpenStreetMapElement;
      distanceMeters: number;
    }>,
  ): number {
    const closestPark = nearbyElements
      .filter(({ element }) => {
        const tags = element.tags ?? {};

        return (
          tags.leisure === 'park' ||
          tags.leisure === 'garden' ||
          tags.landuse === 'forest'
        );
      })
      .sort((first, second) => first.distanceMeters - second.distanceMeters)[0];

    if (!closestPark) {
      return 0;
    }

    return this.distanceToProximityValue(closestPark.distanceMeters, 150);
  }

  private calculatePoiValue(
    nearbyElements: Array<{
      element: OpenStreetMapElement;
      distanceMeters: number;
    }>,
  ): number {
    const poiCount = nearbyElements.filter(({ element }) => {
      const tags = element.tags ?? {};

      return Boolean(tags.amenity || tags.shop || tags.tourism || tags.leisure);
    }).length;

    return this.normalizeCount(poiCount, 40);
  }

  private calculateCommercialValue(
    nearbyElements: Array<{
      element: OpenStreetMapElement;
      distanceMeters: number;
    }>,
  ): number {
    const commercialCount = nearbyElements.filter(({ element }) => {
      const tags = element.tags ?? {};

      return Boolean(
        tags.shop ||
        tags.amenity === 'restaurant' ||
        tags.amenity === 'cafe' ||
        tags.amenity === 'fast_food' ||
        tags.amenity === 'bar' ||
        tags.amenity === 'pub' ||
        tags.amenity === 'bank',
      );
    }).length;

    return this.normalizeCount(commercialCount, 12);
  }

  private calculateShadeValue(
    nearbyElements: Array<{
      element: OpenStreetMapElement;
      distanceMeters: number;
    }>,
  ): number {
    let shadeValue = 0;

    for (const { element, distanceMeters } of nearbyElements) {
      const tags = element.tags ?? {};

      let elementShadeValue = 0;

      if (tags.natural === 'tree') {
        elementShadeValue = 0.8;
      } else if (
        tags.natural === 'wood' ||
        tags.landuse === 'forest'
      ) {
        elementShadeValue = 1;
      } else if (
        tags.leisure === 'park' ||
        tags.leisure === 'garden'
      ) {
        elementShadeValue = 0.45;
      }

      if (elementShadeValue === 0) {
        continue;
      }

      const proximity =
        this.distanceToProximityValue(
          distanceMeters,
          100,
        );

      shadeValue = Math.max(
        shadeValue,
        elementShadeValue * proximity,
      );
    }

    return this.clamp01(shadeValue);
  }

  private calculatePedestrianValue(
    nearbyElements: Array<{
      element: OpenStreetMapElement;
      distanceMeters: number;
    }>,
  ): number {
    const crossingCount = nearbyElements.filter(
      ({ element }) =>
        element.tags?.highway === 'crossing',
    ).length;

    const pedestrianStreetCount =
      nearbyElements.filter(
        ({ element }) =>
          element.tags?.highway === 'pedestrian',
      ).length;

    const crossingActivity =
      this.normalizeCount(crossingCount, 6);

    const pedestrianStreetActivity =
      this.normalizeCount(
        pedestrianStreetCount,
        3,
      );

    const poiActivity =
      this.calculatePoiValue(nearbyElements);

    const commercialActivity =
      this.calculateCommercialValue(
        nearbyElements,
      );

    return this.clamp01(
      crossingActivity * 0.35 +
        pedestrianStreetActivity * 0.25 +
        poiActivity * 0.2 +
        commercialActivity * 0.2,
    );
  }

  private calculateNoiseValue(
    nearbyElements: Array<{
      element: OpenStreetMapElement;
      distanceMeters: number;
    }>,
  ): number {
    const traffic =
      this.calculateTrafficValue(nearbyElements);

    const commercial =
      this.calculateCommercialValue(nearbyElements);

    return this.clamp01(
      traffic * 0.7 +
        commercial * 0.3,
    );
  }

  private calculateConstructionValue(
    nearbyElements: Array<{
      element: OpenStreetMapElement;
      distanceMeters: number;
    }>,
  ): number {
    let constructionValue = 0;

    for (const { element, distanceMeters } of nearbyElements) {
      const tags = element.tags ?? {};

      const isConstruction =
        tags.highway === 'construction' ||
        Boolean(tags.construction);

      if (!isConstruction) {
        continue;
      }

      constructionValue = Math.max(
        constructionValue,
        this.distanceToProximityValue(
          distanceMeters,
          150,
        ),
      );
    }

    return this.clamp01(constructionValue);
  }

  private calculateTrafficValue(
    nearbyElements: Array<{
      element: OpenStreetMapElement;
      distanceMeters: number;
    }>,
  ): number {
    let highestTrafficValue = 0;

    for (const { element, distanceMeters } of nearbyElements) {
      const highway = element.tags?.highway;

      if (!highway) {
        continue;
      }

      const roadValue = this.getHighwayTrafficValue(highway);

      const proximityValue = this.distanceToProximityValue(distanceMeters, 100);

      highestTrafficValue = Math.max(
        highestTrafficValue,
        roadValue * proximityValue,
      );
    }

    return this.clamp01(highestTrafficValue);
  }

  private getHighwayTrafficValue(highway: string): number {
    const values: Record<string, number> = {
      footway: 0.05,
      pedestrian: 0.05,
      path: 0.05,
      steps: 0.05,
      living_street: 0.15,
      residential: 0.25,
      service: 0.3,
      unclassified: 0.35,
      tertiary: 0.5,
      tertiary_link: 0.5,
      secondary: 0.7,
      secondary_link: 0.7,
      primary: 0.85,
      primary_link: 0.85,
      trunk: 1,
      trunk_link: 1,
      motorway: 1,
      motorway_link: 1,
    };

    return values[highway] ?? 0.3;
  }

  private createObservation(
    sample: RouteSamplePoint,
    featureType: EnvironmentalFeatureType,
    value: number,
    confidence: number,
    retrievedAt: string,
    nearbyElementCount: number,
  ): EnvironmentalObservation {
    return {
      id: `${sample.id}-${featureType}`,
      featureType,
      coordinate: sample.coordinate,
      value: this.clamp01(value),
      confidence: this.clamp01(confidence),
      source: 'openstreetmap',
      retrievedAt,

      metadata: {
        nearbyElementCount,
        searchRadiusMeters: 150,
      },
    };
  }

  private getElementCoordinate(
    element: OpenStreetMapElement,
  ): RouteCoordinate | null {
    if (typeof element.lon === 'number' && typeof element.lat === 'number') {
      return [element.lon, element.lat];
    }

    if (element.center) {
      return [element.center.lon, element.center.lat];
    }

    return null;
  }

  getLastDataSource(): 'live' | 'cache' | 'mixed' | 'fallback' {
    return this.lastDataSource;
  }

  getLastRetrievalDiagnostics(): EnvironmentalRetrievalDiagnostics {
    return this.lastRetrievalDiagnostics;
  }

  private calculateBoundingBox(
    samples: RouteSamplePoint[],
    paddingMeters: number,
  ): BoundingBox {
    const latitudes = samples.map((sample) => sample.coordinate[1]);

    const longitudes = samples.map((sample) => sample.coordinate[0]);

    const averageLatitude =
      latitudes.reduce((total, value) => total + value, 0) / latitudes.length;

    const latitudePadding = paddingMeters / 111_320;

    const longitudePadding =
      paddingMeters / (111_320 * Math.cos((averageLatitude * Math.PI) / 180));

    return {
      south: Math.min(...latitudes) - latitudePadding,

      west: Math.min(...longitudes) - longitudePadding,

      north: Math.max(...latitudes) + latitudePadding,

      east: Math.max(...longitudes) + longitudePadding,
    };
  }

  private normalizeCount(count: number, highCount: number): number {
    if (highCount <= 0) {
      return 0;
    }

    return this.clamp01(count / highCount);
  }

  private distanceToProximityValue(
    distanceMeters: number,
    maximumDistanceMeters: number,
  ): number {
    if (maximumDistanceMeters <= 0) {
      return 0;
    }

    return this.clamp01(1 - distanceMeters / maximumDistanceMeters);
  }

  private haversineDistance(
    first: RouteCoordinate,
    second: RouteCoordinate,
  ): number {
    const earthRadiusMeters = 6_371_000;

    const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

    const firstLatitude = toRadians(first[1]);
    const secondLatitude = toRadians(second[1]);

    const latitudeDifference = toRadians(second[1] - first[1]);

    const longitudeDifference = toRadians(second[0] - first[0]);

    const value =
      Math.sin(latitudeDifference / 2) ** 2 +
      Math.cos(firstLatitude) *
        Math.cos(secondLatitude) *
        Math.sin(longitudeDifference / 2) ** 2;

    return (
      earthRadiusMeters * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value))
    );
  }

  private clamp01(value: number): number {
    return Math.min(1, Math.max(0, value));
  }
}
