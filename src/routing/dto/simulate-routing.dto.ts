import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { UpsertRoutingRulesDto } from './upsert-routing-rules.dto';

export class SimulateRoutingDto {
  @ApiPropertyOptional({
    description:
      'Clave de idempotencia para evitar planes duplicados en reintentos de generacion',
  })
  @IsOptional()
  @IsString()
  idempotencyKey?: string;

  @ApiPropertyOptional({ description: 'Fecha de planificacion (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  planningDate?: string;

  @ApiPropertyOptional({
    description: 'Maximo de reclamos a leer',
    default: 1000,
  })
  @IsOptional()
  @IsInt()
  @Min(50)
  @Max(5000)
  maxFetch?: number;

  @ApiPropertyOptional({
    type: UpsertRoutingRulesDto,
    description:
      'Reglas temporales para simular sin persistir cambios de configuracion',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpsertRoutingRulesDto)
  overrideRules?: UpsertRoutingRulesDto;

  @ApiPropertyOptional({
    description:
      'Si true, persiste el plan generado en ms-routing (usa endpoint generate por defecto)',
  })
  @IsOptional()
  @IsBoolean()
  persistPlan?: boolean;

  @ApiPropertyOptional({
    description:
      'Si true usa Google Directions para optimizar el orden de paradas cuando haya API key',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  useGoogleOptimization?: boolean;

  @ApiPropertyOptional({
    description: 'Origen global de salida para calculo de ruta (latitud)',
  })
  @IsOptional()
  @IsLatitude()
  originLat?: number;

  @ApiPropertyOptional({
    description: 'Origen global de salida para calculo de ruta (longitud)',
  })
  @IsOptional()
  @IsLongitude()
  originLng?: number;
}
