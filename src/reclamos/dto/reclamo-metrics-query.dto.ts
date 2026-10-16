import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

export class ReclamoMetricsQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Matches(/^[a-z0-9]+(?:_[a-z0-9]+)*$/)
  municipalityId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Matches(/^[a-z0-9]+(?:_[a-z0-9]+)*$/)
  areaId?: string;

  @IsOptional()
  @IsIn(['pendiente', 'en_proceso', 'resuelto', 'rechazado', 'cerrado'])
  estado?: string;

  @IsOptional()
  @IsIn(['agua_y_cloacas', 'alumbrado', 'baches_y_pavimento', 'arbolado', 'residuos', 'electricidad', 'gas', 'transporte', 'infraestructura', 'otros'])
  categoria?: string;

  @IsOptional()
  @IsIn(['alta', 'media', 'baja'])
  prioridad?: string;

  @IsOptional()
  @IsIn(['whatsapp', 'web', 'email', 'instagram', 'facebook', 'manual', 'other'])
  canal?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn([1, 7, 30])
  bucketDays: 1 | 7 | 30 = 1;
}