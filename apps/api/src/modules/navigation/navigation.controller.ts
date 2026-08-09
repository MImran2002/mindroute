import { Body, Controller, Get, Header, Post, Query } from '@nestjs/common';
import type { NavigationRoutesResponse } from './interfaces/navigation-routes-response.interface';
import { GetRoutesDto } from './dto/get-routes.dto';
import { CreateRouteSelectionDto } from './dto/create-route-selection.dto';
import { NavigationService, type WalkingRoute } from './navigation.service';
import { RouteSelectionService } from './route-selection.service';
import { SupervisedTrainingDatasetService } from './supervised-training-dataset.service';
import { AITrainingDatasetService } from './ai-training-dataset.service';
import { TrainingDatasetStatsService } from './training-dataset-stats.service';
import { RouteGenerationDiagnosticsService } from './route-generation-diagnostics.service';

@Controller('navigation')
export class NavigationController {
  constructor(
    private readonly navigationService: NavigationService,
    private readonly routeSelectionService: RouteSelectionService,
    private readonly supervisedTrainingDatasetService: SupervisedTrainingDatasetService,
    private readonly aiTrainingDatasetService: AITrainingDatasetService,
    private readonly trainingDatasetStatsService: TrainingDatasetStatsService,
    private readonly routeGenerationDiagnosticsService: RouteGenerationDiagnosticsService,
  ) {}

  @Get('routes')
  getRoutes(@Query() query: GetRoutesDto): Promise<NavigationRoutesResponse> {
    return this.navigationService.getWalkingRoutes(query);
  }

  @Post('route-selections')
  recordRouteSelection(@Body() body: CreateRouteSelectionDto) {
    return this.routeSelectionService.recordSelection(body);
  }

  @Get('route-generation-stats')
  getRouteGenerationStats() {
    return this.routeGenerationDiagnosticsService.getStats();
  }

  @Get('training-dataset-stats')
  getTrainingDatasetStats() {
    return this.trainingDatasetStatsService.getStats();
  }

  @Get('supervised-training-records')
  getSupervisedTrainingRecords() {
    return this.supervisedTrainingDatasetService.getRecords();
  }

  @Get('supervised-training-records.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async getSupervisedTrainingRecordsCsv(): Promise<string> {
    const records = await this.supervisedTrainingDatasetService.getRecords();

    return this.aiTrainingDatasetService.toCsv(records);
  }

  @Get('training-records')
  getTrainingRecords(@Query() query: GetRoutesDto) {
    return this.navigationService.getAITrainingRecords(query);
  }

  @Get('training-records.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  getTrainingRecordsCsv(@Query() query: GetRoutesDto): Promise<string> {
    return this.navigationService.getAITrainingRecordsCsv(query);
  }
}
