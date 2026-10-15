import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

const SLUG = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;
const CATEGORIES = [
  'agua_y_cloacas', 'alumbrado', 'baches_y_pavimento', 'arbolado', 'residuos',
  'electricidad', 'gas', 'transporte', 'infraestructura', 'otros',
] as const;

export class MunicipalityAreaInput {
  @IsString() @Matches(SLUG) slug!: string;
  @IsString() @IsNotEmpty() @MaxLength(120) name!: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class MunicipalityCategoryInput {
  @IsString() @IsIn(CATEGORIES) code!: (typeof CATEGORIES)[number];
  @IsString() @IsNotEmpty() @MaxLength(120) name!: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsOptional() @IsIn(['alta', 'media', 'baja']) defaultPriority?: 'alta' | 'media' | 'baja';
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class MunicipalityNeighborhoodInput {
  @IsString() @Matches(SLUG) slug!: string;
  @IsString() @IsNotEmpty() @MaxLength(120) name!: string;
  @IsOptional() @IsString() @Matches(SLUG) areaSlug?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class MunicipalityRuleInput {
  @IsString() @Matches(SLUG) key!: string;
  @IsObject() value!: Record<string, unknown>;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class MunicipalityConfigurationDto {
  @IsString() @Matches(SLUG) id!: string;
  @IsString() @IsNotEmpty() @MaxLength(160) name!: string;
  @IsString() @IsNotEmpty() @MaxLength(120) country!: string;
  @IsOptional() @IsString() @MaxLength(120) province?: string;
  @IsOptional() @IsString() @MaxLength(160) defaultCity?: string;
  @IsOptional() @IsString() @MaxLength(80) timezone?: string;
  @IsArray() @IsString({ each: true }) allowedCountries!: string[];
  @IsArray() @IsString({ each: true }) allowedAdminAreas!: string[];
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => MunicipalityAreaInput) areas?: MunicipalityAreaInput[];
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => MunicipalityCategoryInput) categories?: MunicipalityCategoryInput[];
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => MunicipalityNeighborhoodInput) neighborhoods?: MunicipalityNeighborhoodInput[];
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => MunicipalityRuleInput) rules?: MunicipalityRuleInput[];
}