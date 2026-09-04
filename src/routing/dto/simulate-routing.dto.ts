import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsLatitude,
  IsLongitude,
  Matches,
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
    enum: ['pendiente', 'en_proceso', 'resuelto', 'rechazado', 'cerrado'],
    isArray: true,
    description: 'Estados de reclamo habilitados para seleccion de rutas',
  })
  @IsOptional()
  @IsArray()
  @IsIn(['pendiente', 'en_proceso', 'resuelto', 'rechazado', 'cerrado'], {
    each: true,
  })
  claimStatuses?: Array<
    'pendiente' | 'en_proceso' | 'resuelto' | 'rechazado' | 'cerrado'
  >;

  @ApiPropertyOptional({
    enum: ['alta', 'media', 'baja'],
    isArray: true,
    description: 'Prioridades de reclamo habilitadas para seleccion de rutas',
  })
  @IsOptional()
  @IsArray()
  @IsIn(['alta', 'media', 'baja'], { each: true })
  priorities?: Array<'alta' | 'media' | 'baja'>;

  @ApiPropertyOptional({
    enum: [
      'agua_y_cloacas',
      'alumbrado',
      'baches_y_pavimento',
      'arbolado',
      'residuos',
      'electricidad',
      'gas',
      'transporte',
      'infraestructura',
      'otros',
    ],
    isArray: true,
    description: 'Categorias de reclamo habilitadas para seleccion de rutas',
  })
  @IsOptional()
  @IsArray()
  @IsIn(
    [
      'agua_y_cloacas',
      'alumbrado',
      'baches_y_pavimento',
      'arbolado',
      'residuos',
      'electricidad',
      'gas',
      'transporte',
      'infraestructura',
      'otros',
    ],
    { each: true },
  )
  categories?: Array<
    | 'agua_y_cloacas'
    | 'alumbrado'
    | 'baches_y_pavimento'
    | 'arbolado'
    | 'residuos'
    | 'electricidad'
    | 'gas'
    | 'transporte'
    | 'infraestructura'
    | 'otros'
  >;

  @ApiPropertyOptional({ description: 'Identificador del municipio operativo' })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9]+(?:_[a-z0-9]+)*$/)
  municipalityId?: string;

  @ApiPropertyOptional({ description: 'Identificador del area operativa' })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9]+(?:_[a-z0-9]+)*$/)
  areaId?: string;

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
