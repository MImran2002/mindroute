import { Body, Controller, Get, Header, Post, Query } from '@nestjs/common';
import { GetRoutesDto } from './dto/get-routes.dto';
import { CreateRouteSelectionDto } from './dto/create-route-selection.dto';
import { NavigationService, type WalkingRoute } from './navigation.service';
import { RouteSelectionService } from './route-selection.service';

@Controller('navigation')
export class NavigationController {
  constructor(
    private readonly navigationService: NavigationService,
    private readonly routeSelectionService: RouteSelectionService,
  ) {}

  @Get('routes')
  getRoutes(@Query() query: GetRoutesDto): Promise<WalkingRoute[]> {
    return this.navigationService.getWalkingRoutes(query);
  }

  @Post('route-selections')
  recordRouteSelection(@Body() body: CreateRouteSelectionDto) {
    return this.routeSelectionService.recordSelection(body);
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
