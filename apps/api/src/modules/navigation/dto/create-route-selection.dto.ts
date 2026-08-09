import { IsString, IsUUID, Matches } from 'class-validator';

export class CreateRouteSelectionDto {
  @IsUUID()
  requestId!: string;

  @IsString()
  @Matches(/^route-\d+$/)
  routeId!: string;
}
