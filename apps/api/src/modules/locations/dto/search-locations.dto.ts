import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';

export class SearchLocationsDto {
  @Transform(({ value }) => String(value).trim())
  @IsString()
  @Length(2, 120)
  query!: string;
}
