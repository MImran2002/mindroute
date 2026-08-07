import { Injectable } from '@nestjs/common';
import type {
  EnvironmentalObservation,
  RouteSampleEnvironment,
} from '../interfaces/environmental-observation.interface';
import type { RouteSamplePoint } from '../interfaces/route-sample.interface';
import type { EnvironmentalProvider } from './environmental-provider.interface';

@Injectable()
export class MockEnvironmentalProvider implements EnvironmentalProvider {
  getEnvironmentForSamples(
    samples: RouteSamplePoint[],
  ): Promise<RouteSampleEnvironment[]> {
    const retrievedAt = new Date().toISOString();

    return Promise.resolve(
      samples.map((sample, index) => {
        const positionRatio =
          samples.length > 1 ? index / (samples.length - 1) : 0;

        const observations: EnvironmentalObservation[] = [
          this.createObservation(
            sample,
            'shade',
            this.clamp01(0.25 + positionRatio * 0.45),
            0.5,
            retrievedAt,
          ),

          this.createObservation(
            sample,
            'greenery',
            this.clamp01(0.2 + positionRatio * 0.35),
            0.5,
            retrievedAt,
          ),

          this.createObservation(
            sample,
            'park',
            positionRatio > 0.55 && positionRatio < 0.8 ? 0.7 : 0.1,
            0.45,
            retrievedAt,
          ),

          this.createObservation(
            sample,
            'pedestrian-density',
            this.clamp01(0.75 - Math.abs(positionRatio - 0.5)),
            0.5,
            retrievedAt,
          ),

          this.createObservation(
            sample,
            'traffic',
            this.clamp01(0.7 - positionRatio * 0.35),
            0.5,
            retrievedAt,
          ),

          this.createObservation(
            sample,
            'noise',
            this.clamp01(0.65 - positionRatio * 0.25),
            0.4,
            retrievedAt,
          ),

          this.createObservation(
            sample,
            'commercial-activity',
            this.clamp01(0.8 - Math.abs(positionRatio - 0.5) * 0.9),
            0.45,
            retrievedAt,
          ),

          this.createObservation(
            sample,
            'construction',
            positionRatio > 0.3 && positionRatio < 0.45 ? 0.8 : 0.05,
            0.4,
            retrievedAt,
          ),

          this.createObservation(
            sample,
            'event',
            positionRatio > 0.75 ? 0.5 : 0.05,
            0.35,
            retrievedAt,
          ),

          this.createObservation(
            sample,
            'point-of-interest',
            this.clamp01(0.7 - Math.abs(positionRatio - 0.5) * 0.8),
            0.5,
            retrievedAt,
          ),
        ];

        return {
          sampleId: sample.id,
          routeId: sample.routeId,
          coordinate: sample.coordinate,
          observations,
        };
      }),
    );
  }

  private createObservation(
    sample: RouteSamplePoint,
    featureType: EnvironmentalObservation['featureType'],
    value: number,
    confidence: number,
    retrievedAt: string,
  ): EnvironmentalObservation {
    return {
      id: `${sample.id}-${featureType}`,
      featureType,
      coordinate: sample.coordinate,
      value,
      confidence,
      source: 'mock',
      retrievedAt,
    };
  }

  private clamp01(value: number): number {
    return Math.min(1, Math.max(0, value));
  }
}
