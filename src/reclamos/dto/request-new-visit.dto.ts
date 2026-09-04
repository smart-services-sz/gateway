import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class RequestNewVisitDto {
  @ApiProperty({ description: 'UUID del reclamo' })
  @IsUUID('4')
  reclamoId!: string;

  @ApiProperty({ maxLength: 2000 })
  @IsString()
  @MaxLength(2000)
  motivo!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  programadaEn?: string;

  @IsOptional()
  @IsUUID('4')
  actorId?: string;
}
