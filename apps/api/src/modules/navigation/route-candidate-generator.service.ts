import { Injectable } from '@nestjs/common';

export interface RouteCandidatePlan {
  id: string;
  coordinates: Array<[number, number]>;
  waypointIndexes: number[];
}

interface RouteCandidateGeneratorInput {
  originLat: number;
  originLng: number;
  destinationLat: number;
  destinationLng: number;
}

@Injectable()
export class RouteCandidateGeneratorService {
  generate(input: RouteCandidateGeneratorInput): RouteCandidatePlan[] {
    const origin: [number, number] = [input.originLng, input.originLat];

    const destination: [number, number] = [
      input.destinationLng,
      input.destinationLat,
    ];

    const midpointLng = (input.originLng + input.destinationLng) / 2;

    const midpointLat = (input.originLat + input.destinationLat) / 2;

    const deltaLng = input.destinationLng - input.originLng;

    const deltaLat = input.destinationLat - input.originLat;

    const magnitude = Math.hypot(deltaLng, deltaLat);

    if (magnitude === 0) {
      return [
        {
          id: 'direct',
          coordinates: [origin, destination],
          waypointIndexes: [0, 1],
        },
      ];
    }

    const perpendicularLng = -deltaLat / magnitude;
    const perpendicularLat = deltaLng / magnitude;

    const offsetDegrees = this.calculateOffsetDegrees(magnitude);

    const leftWaypoint: [number, number] = [
      midpointLng + perpendicularLng * offsetDegrees,
      midpointLat + perpendicularLat * offsetDegrees,
    ];

    const rightWaypoint: [number, number] = [
      midpointLng - perpendicularLng * offsetDegrees,
      midpointLat - perpendicularLat * offsetDegrees,
    ];

    return [
      {
        id: 'direct',
        coordinates: [origin, destination],
        waypointIndexes: [0, 1],
      },
      {
        id: 'left-offset',
        coordinates: [origin, leftWaypoint, destination],
        waypointIndexes: [0, 2],
      },
      {
        id: 'right-offset',
        coordinates: [origin, rightWaypoint, destination],
        waypointIndexes: [0, 2],
      },
    ];
  }

  private calculateOffsetDegrees(routeMagnitude: number): number {
    const proportionalOffset = routeMagnitude * 0.2;

    return Math.min(Math.max(proportionalOffset, 0.001), 0.006);
  }
}
