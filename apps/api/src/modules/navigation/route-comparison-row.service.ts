import { Injectable } from '@nestjs/common';

import type { EnvironmentalDataStatus } from './interfaces/environmental-observation.interface';
import type { RouteComparisonRow } from './interfaces/route-comparison-row.interface';
import type { RouteFeatures } from './interfaces/route-features.interface';

interface RouteComparisonInput {
  routeId: string;
  features: RouteFeatures;
  environmentalDataStatus: EnvironmentalDataStatus;
}

@Injectable()
export class RouteComparisonRowService {
  createRow(input: RouteComparisonInput): RouteComparisonRow {
    return {
      routeId: input.routeId,
      ...input.features,
      environmentalDataStatus: input.environmentalDataStatus,
    };
  }

  createRows(inputs: RouteComparisonInput[]): RouteComparisonRow[] {
    return inputs.map((input) => this.createRow(input));
  }
}
