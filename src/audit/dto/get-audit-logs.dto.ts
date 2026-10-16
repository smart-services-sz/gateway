import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

enum AuditLevel {
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  SECURITY = 'SECURITY',
}

export class GetAuditLogsDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  service?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  performedBy?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  action?: string;

  @IsOptional()
  @IsEnum(AuditLevel)
  level?: AuditLevel;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  entity?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  entityId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  municipalityId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  correlationId?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}