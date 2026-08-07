import type { RouteSamplePoint } from '../interfaces/route-sample.interface';
import type { RouteSampleEnvironment } from '../interfaces/environmental-observation.interface';

export interface EnvironmentalProvider {
  getEnvironmentForSamples(
    samples: RouteSamplePoint[],
  ): Promise<RouteSampleEnvironment[]>;
}
