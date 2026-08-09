import { Controller, Get, Header, Query } from '@nestjs/common';
import { GetRoutesDto } from './dto/get-routes.dto';
import { NavigationService, type WalkingRoute } from './navigation.service';

@Controller('navigation')
export class NavigationController {
  constructor(private readonly navigationService: NavigationService) {}

  @Get('routes')
  getRoutes(@Query() query: GetRoutesDto): Promise<WalkingRoute[]> {
    return this.navigationService.getWalkingRoutes(query);
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
