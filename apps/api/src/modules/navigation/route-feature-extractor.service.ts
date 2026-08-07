import { Injectable } from '@nestjs/common';
import type {
  CandidateRoute,
  RouteCoordinate,
  RouteStep,
} from './interfaces/candidate-route.interface';
import type { RouteFeatures } from './interfaces/route-features.interface';

@Injectable()
export class RouteFeatureExtractorService {
  extract(
    route: CandidateRoute,
    fastestDurationSeconds: number,
  ): RouteFeatures {
    const turnCount = route.steps.filter((step) => this.isTurn(step)).length;

    const sharpTurnCount = route.steps.filter((step) =>
      this.isSharpTurn(step),
    ).length;

    const decisionPointCount = route.steps.filter((step) =>
      this.isDecisionPoint(step),
    ).length;

    const segmentDistances = route.steps
      .map((step) => step.distanceMeters)
      .filter((distance) => distance > 0);

    const averageSegmentLengthMeters =
      segmentDistances.length > 0
        ? segmentDistances.reduce((total, distance) => total + distance, 0) /
          segmentDistances.length
        : route.distanceMeters;

    const shortSegmentCount = segmentDistances.filter(
      (distance) => distance < 50,
    ).length;

    const instructionDensityPerKm =
      route.distanceMeters > 0
        ? decisionPointCount / (route.distanceMeters / 1000)
        : 0;

    const crossingMetrics = this.calculateCrossingMetrics(route.steps);

    const detourPercent =
      fastestDurationSeconds > 0
        ? Math.max(
            0,
            ((route.durationSeconds - fastestDurationSeconds) /
              fastestDurationSeconds) *
              100,
          )
        : 0;

    return {
      distanceMeters: route.distanceMeters,
      durationSeconds: route.durationSeconds,
      detourPercent,

      turnCount,
      sharpTurnCount,
      decisionPointCount,
      instructionDensityPerKm,
      averageSegmentLengthMeters,
      shortSegmentCount,
      routeStraightness: this.calculateStraightness(route.geometry.coordinates),

      crossingCount: crossingMetrics.crossingCount,
      signalizedCrossingCount: crossingMetrics.signalizedCrossingCount,
      unsignalizedCrossingCount: crossingMetrics.unsignalizedCrossingCount,
      complexIntersectionCount: crossingMetrics.complexIntersectionCount,
      crossingComplexity: crossingMetrics.crossingComplexity,

      estimatedShadeExposure: 0,
      greeneryExposure: 0,
      parkExposure: 0,
      pedestrianDensity: 0,
      trafficExposure: 0,
      noiseExposure: 0,
      commercialActivityExposure: 0,
      constructionExposure: 0,
      eventExposure: 0,
      pointOfInterestDensity: 0,

      dataConfidence: 0.35,
    };
  }

  private isTurn(step: RouteStep): boolean {
    const modifier = step.maneuver.modifier?.toLowerCase();

    return [
      'left',
      'right',
      'slight left',
      'slight right',
      'sharp left',
      'sharp right',
      'uturn',
    ].includes(modifier ?? '');
  }

  private isSharpTurn(step: RouteStep): boolean {
    const modifier = step.maneuver.modifier?.toLowerCase();

    return ['sharp left', 'sharp right', 'uturn'].includes(modifier ?? '');
  }

  private isDecisionPoint(step: RouteStep): boolean {
    if (this.isTurn(step)) {
      return true;
    }

    return step.intersections.some((intersection) => {
      const availableChoices = intersection.entry?.filter(Boolean).length ?? 0;

      return availableChoices > 2;
    });
  }

  private isCrosswalkStep(step: RouteStep): boolean {
    const instruction = step.maneuver.instruction?.toLowerCase() ?? '';

    const streetName = step.name?.toLowerCase() ?? '';

    return (
      instruction.includes('crosswalk') || streetName.includes('crosswalk')
    );
  }

  private calculateCrossingMetrics(steps: RouteStep[]) {
    const crossingSteps = steps.filter((step) => this.isCrosswalkStep(step));

    let signalizedCrossingCount = 0;
    let unsignalizedCrossingCount = 0;
    let complexIntersectionCount = 0;

    for (const step of crossingSteps) {
      const hasTrafficSignal = step.intersections.some(
        (intersection) => intersection.traffic_signal === true,
      );

      if (hasTrafficSignal) {
        signalizedCrossingCount += 1;
      } else {
        unsignalizedCrossingCount += 1;
      }

      const isComplex = step.intersections.some((intersection) => {
        const availableChoices =
          intersection.entry?.filter(Boolean).length ?? 0;

        return availableChoices > 2;
      });

      if (isComplex) {
        complexIntersectionCount += 1;
      }
    }

    const crossingCount = crossingSteps.length;

    const crossingComplexity =
      crossingCount > 0
        ? Math.min(
            1,
            (unsignalizedCrossingCount * 0.5 + complexIntersectionCount) /
              crossingCount,
          )
        : 0;

    return {
      crossingCount,
      signalizedCrossingCount,
      unsignalizedCrossingCount,
      complexIntersectionCount,
      crossingComplexity,
    };
  }

  private calculateStraightness(coordinates: RouteCoordinate[]): number {
    if (coordinates.length < 2) {
      return 1;
    }

    const firstCoordinate = coordinates[0];
    const lastCoordinate = coordinates[coordinates.length - 1];

    const directDistance = this.haversineDistance(
      firstCoordinate,
      lastCoordinate,
    );

    let traveledDistance = 0;

    for (let index = 1; index < coordinates.length; index += 1) {
      traveledDistance += this.haversineDistance(
        coordinates[index - 1],
        coordinates[index],
      );
    }

    if (traveledDistance === 0) {
      return 1;
    }

    return Math.min(1, directDistance / traveledDistance);
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
