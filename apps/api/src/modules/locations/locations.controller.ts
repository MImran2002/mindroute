import { Controller, Get, Query } from '@nestjs/common';
import { SearchLocationsDto } from './dto/search-locations.dto';
import { LocationsService, type LocationResult } from './locations.service';

@Controller('locations')
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Get('search')
  search(@Query() query: SearchLocationsDto): Promise<LocationResult[]> {
    return this.locationsService.search(query.query);
  }
}
