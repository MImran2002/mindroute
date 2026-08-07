import { Injectable } from '@nestjs/common';
import type {
  CandidateRoute,
  RouteCoordinate,
} from './interfaces/candidate-route.interface';
import type { RouteSamplePoint } from './interfaces/route-sample.interface';

@Injectable()
export class RouteSamplingService {
  /**
   * Samples points along a route at approximately the requested
   * interval.
   *
   * The first and final coordinates are always included.
   */
  sampleRoute(route: CandidateRoute, intervalMeters = 100): RouteSamplePoint[] {
    const coordinates = route.geometry.coordinates;

    if (coordinates.length === 0) {
      return [];
    }

    if (coordinates.length === 1) {
      return [
        {
          id: `${route.id}-sample-1`,
          routeId: route.id,
          coordinate: coordinates[0],
          distanceFromStartMeters: 0,
          segmentIndex: 0,
        },
      ];
    }

    const safeInterval = Math.max(10, intervalMeters);
    const samples: RouteSamplePoint[] = [];

    let totalDistanceMeters = 0;
    let nextSampleDistanceMeters = 0;
    let sampleNumber = 1;

    samples.push({
      id: `${route.id}-sample-${sampleNumber}`,
      routeId: route.id,
      coordinate: coordinates[0],
      distanceFromStartMeters: 0,
      segmentIndex: 0,
    });

    sampleNumber += 1;
    nextSampleDistanceMeters = safeInterval;

    for (
      let segmentIndex = 1;
      segmentIndex < coordinates.length;
      segmentIndex += 1
    ) {
      const segmentStart = coordinates[segmentIndex - 1];
      const segmentEnd = coordinates[segmentIndex];

      const segmentLengthMeters = this.haversineDistance(
        segmentStart,
        segmentEnd,
      );

      if (segmentLengthMeters === 0) {
        continue;
      }

      const segmentStartDistanceMeters = totalDistanceMeters;
      const segmentEndDistanceMeters =
        totalDistanceMeters + segmentLengthMeters;

      while (nextSampleDistanceMeters <= segmentEndDistanceMeters) {
        const distanceIntoSegmentMeters =
          nextSampleDistanceMeters - segmentStartDistanceMeters;

        const interpolationRatio =
          distanceIntoSegmentMeters / segmentLengthMeters;

        const coordinate = this.interpolateCoordinate(
          segmentStart,
          segmentEnd,
          interpolationRatio,
        );

        samples.push({
          id: `${route.id}-sample-${sampleNumber}`,
          routeId: route.id,
          coordinate,
          distanceFromStartMeters: nextSampleDistanceMeters,
          segmentIndex: segmentIndex - 1,
        });

        sampleNumber += 1;
        nextSampleDistanceMeters += safeInterval;
      }

      totalDistanceMeters = segmentEndDistanceMeters;
    }

    const finalCoordinate = coordinates[coordinates.length - 1];

    const lastSample = samples[samples.length - 1];

    const finalPointAlreadyIncluded =
      this.haversineDistance(lastSample.coordinate, finalCoordinate) < 1;

    if (!finalPointAlreadyIncluded) {
      samples.push({
        id: `${route.id}-sample-${sampleNumber}`,
        routeId: route.id,
        coordinate: finalCoordinate,
        distanceFromStartMeters: totalDistanceMeters,
        segmentIndex: coordinates.length - 2,
      });
    }

    return samples;
  }

  private interpolateCoordinate(
    start: RouteCoordinate,
    end: RouteCoordinate,
    ratio: number,
  ): RouteCoordinate {
    const boundedRatio = Math.min(1, Math.max(0, ratio));

    const longitude = start[0] + (end[0] - start[0]) * boundedRatio;

    const latitude = start[1] + (end[1] - start[1]) * boundedRatio;

    return [longitude, latitude];
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
}
