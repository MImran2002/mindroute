import { Controller, Get, Query } from '@nestjs/common';
import { GetRoutesDto } from './dto/get-routes.dto';
import { NavigationService, type WalkingRoute } from './navigation.service';

@Controller('navigation')
export class NavigationController {
  constructor(private readonly navigationService: NavigationService) {}

  @Get('routes')
  getRoutes(@Query() query: GetRoutesDto): Promise<WalkingRoute[]> {
    return this.navigationService.getWalkingRoutes(query);
  }
}
