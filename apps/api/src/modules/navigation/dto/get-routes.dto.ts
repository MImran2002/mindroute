import { Type } from 'class-transformer';
import { IsLatitude, IsLongitude, IsNumber } from 'class-validator';

export class GetRoutesDto {
  @Type(() => Number)
  @IsNumber()
  @IsLatitude()
  originLat!: number;

  @Type(() => Number)
  @IsNumber()
  @IsLongitude()
  originLng!: number;

  @Type(() => Number)
  @IsNumber()
  @IsLatitude()
  destinationLat!: number;

  @Type(() => Number)
  @IsNumber()
  @IsLongitude()
  destinationLng!: number;
}
