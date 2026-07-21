import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CategoryRuleDto {
  @ApiProperty({
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
  })
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
    { message: 'categoria no valida' },
  )
  categoria!:
    | 'agua_y_cloacas'
    | 'alumbrado'
    | 'baches_y_pavimento'
    | 'arbolado'
    | 'residuos'
    | 'electricidad'
    | 'gas'
    | 'transporte'
    | 'infraestructura'
    | 'otros';

  @ApiProperty()
  @IsInt()
  @Min(1)
  @Max(1000)
  cupoDiario!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  pesoPrioridad?: number;
}

export class ZoneRuleDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  id!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nombre?: string;

  @ApiProperty()
  @IsLatitude()
  minLat!: number;

  @ApiProperty()
  @IsLatitude()
  maxLat!: number;

  @ApiProperty()
  @IsLongitude()
  minLng!: number;

  @ApiProperty()
  @IsLongitude()
  maxLng!: number;
}

export class CrewRuleDto {
  @ApiPropertyOptional({
    description: 'Identificador legado de cuadrilla (alias de userId)',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  crewId?: string;

  @ApiPropertyOptional({
    description: 'ID del usuario operativo al que se asigna la ruta',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  userId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nombre?: string;

  @ApiPropertyOptional({ description: 'Nombre del usuario operativo' })
  @IsOptional()
  @IsString()
  userName?: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  @Max(20)
  maxReclamosDiarios!: number;

  @ApiProperty({
    type: [String],
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
  })
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
    { each: true, message: 'categoria no valida en allowedCategorias' },
  )
  allowedCategorias!: Array<
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

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedZoneIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsLatitude()
  startLat?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsLongitude()
  startLng?: number;
}

export class UpsertRoutingRulesDto {
  @ApiProperty({ type: [CategoryRuleDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CategoryRuleDto)
  categoryRules!: CategoryRuleDto[];

  @ApiProperty({ type: [CrewRuleDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CrewRuleDto)
  crews!: CrewRuleDto[];

  @ApiPropertyOptional({ type: [ZoneRuleDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ZoneRuleDto)
  zones?: ZoneRuleDto[];
}
