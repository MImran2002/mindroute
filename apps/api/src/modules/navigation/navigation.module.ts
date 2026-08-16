import { Module } from '@nestjs/common';
import { EnvironmentalAggregationService } from './environmental-aggregation.service';
import { NavigationController } from './navigation.controller';
import { NavigationService } from './navigation.service';
import { MockEnvironmentalProvider } from './providers/mock-environmental.provider';
import { OpenStreetMapEnvironmentalProvider } from './providers/openstreetmap-environmental.provider';
import { RouteRecommendationService } from './route-recommendation.service';
import { RouteSelectionService } from './route-selection.service';
import { RouteFeatureExtractorService } from './route-feature-extractor.service';
import { RouteSamplingService } from './route-sampling.service';
import { RouteBaselineScorerService } from './route-baseline-scorer.service';
import { RouteComparisonRowService } from './route-comparison-row.service';
import { AITrainingDatasetService } from './ai-training-dataset.service';
import { AITrainingRecordService } from './ai-training-record.service';
import { AITrainingStorageService } from './ai-training-storage.service';
import { SupervisedTrainingDatasetService } from './supervised-training-dataset.service';
import { TrainingDatasetStatsService } from './training-dataset-stats.service';
import { RouteCandidateGeneratorService } from './route-candidate-generator.service';
import { RouteGenerationDiagnosticsService } from './route-generation-diagnostics.service';
import { MlRankingService } from './ml-ranking.service';

@Module({
  controllers: [NavigationController],

  providers: [
    MlRankingService,
    RouteGenerationDiagnosticsService,
    RouteCandidateGeneratorService,
    TrainingDatasetStatsService,
    SupervisedTrainingDatasetService,
    RouteSelectionService,
    AITrainingDatasetService,
    AITrainingRecordService,
    AITrainingStorageService,
    RouteRecommendationService,
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
