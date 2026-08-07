import { Module } from '@nestjs/common';
import { EnvironmentalAggregationService } from './environmental-aggregation.service';
import { NavigationController } from './navigation.controller';
import { NavigationService } from './navigation.service';
import { MockEnvironmentalProvider } from './providers/mock-environmental.provider';
import { OpenStreetMapEnvironmentalProvider } from './providers/openstreetmap-environmental.provider';
import { RouteFeatureExtractorService } from './route-feature-extractor.service';
import { RouteSamplingService } from './route-sampling.service';
import { RouteBaselineScorerService } from './route-baseline-scorer.service';
import { RouteComparisonRowService } from './route-comparison-row.service';

@Module({
  controllers: [NavigationController],

  providers: [
    RouteBaselineScorerService,
    RouteComparisonRowService,
    NavigationService,
    RouteFeatureExtractorService,
    RouteSamplingService,
    EnvironmentalAggregationService,
    MockEnvironmentalProvider,
    OpenStreetMapEnvironmentalProvider,
  ],
})
export class NavigationModule {}
