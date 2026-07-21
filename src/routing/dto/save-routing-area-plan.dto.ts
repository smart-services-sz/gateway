import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class SaveRoutingAreaPlanDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty()
  @IsString()
  userId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  userName?: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  categorias!: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  originAddress?: string;

  @ApiProperty()
  @IsLatitude()
  originLat!: number;

  @ApiProperty()
  @IsLongitude()
  originLng!: number;

  @ApiProperty()
  @IsInt()
  @Min(1)
  @Max(1000)
  dailyByUser!: number;

  @ApiProperty()
  @IsInt()
  @Min(1)
  @Max(1000)
  dailyByCategory!: number;
}
