import { Injectable } from '@nestjs/common';
import type {
  AggregatedRouteEnvironment,
  EnvironmentalFeatureType,
  EnvironmentalObservation,
  RouteSampleEnvironment,
} from './interfaces/environmental-observation.interface';

@Injectable()
export class EnvironmentalAggregationService {
  aggregate(
    sampleEnvironments: RouteSampleEnvironment[],
  ): AggregatedRouteEnvironment {
    const observations = sampleEnvironments.flatMap(
      (sample) => sample.observations,
    );

    return {
      estimatedShadeExposure: this.calculateFeatureAverage(
        observations,
        'shade',
      ),

      greeneryExposure: this.calculateFeatureAverage(observations, 'greenery'),

      parkExposure: this.calculateFeatureAverage(observations, 'park'),

      pedestrianDensity: this.calculateFeatureAverage(
        observations,
        'pedestrian-density',
      ),

      trafficExposure: this.calculateFeatureAverage(observations, 'traffic'),

      noiseExposure: this.calculateFeatureAverage(observations, 'noise'),

      commercialActivityExposure: this.calculateFeatureAverage(
        observations,
        'commercial-activity',
      ),

      constructionExposure: this.calculateFeatureAverage(
        observations,
        'construction',
      ),

      eventExposure: this.calculateFeatureAverage(observations, 'event'),

      pointOfInterestDensity: this.calculateFeatureAverage(
        observations,
        'point-of-interest',
      ),

      dataConfidence: this.calculateOverallConfidence(observations),

      sampleCount: sampleEnvironments.length,
      observationCount: observations.length,
    };
  }

  private calculateFeatureAverage(
    observations: EnvironmentalObservation[],
    featureType: EnvironmentalFeatureType,
  ): number {
    const matchingObservations = observations.filter(
      (observation) => observation.featureType === featureType,
    );

    if (matchingObservations.length === 0) {
      return 0;
    }

    const weightedTotal = matchingObservations.reduce(
      (total, observation) =>
        total +
        this.clamp01(observation.value) * this.clamp01(observation.confidence),
      0,
    );

    const confidenceTotal = matchingObservations.reduce(
      (total, observation) => total + this.clamp01(observation.confidence),
      0,
    );

    if (confidenceTotal === 0) {
      return 0;
    }

    return this.clamp01(weightedTotal / confidenceTotal);
  }

  private calculateOverallConfidence(
    observations: EnvironmentalObservation[],
  ): number {
    if (observations.length === 0) {
      return 0;
    }

    const confidenceTotal = observations.reduce(
      (total, observation) => total + this.clamp01(observation.confidence),
      0,
    );

    return this.clamp01(confidenceTotal / observations.length);
  }

  private clamp01(value: number): number {
    return Math.min(1, Math.max(0, value));
  }
}
