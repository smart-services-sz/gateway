import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsLatitude,
  IsLongitude,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdateReclamoDto {
  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'problema no puede superar 1000 caracteres' })
  problema?: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'direccion no puede superar 500 caracteres' })
  direccion?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsLatitude({ message: 'lat debe ser una latitud valida' })
  lat?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsLongitude({ message: 'lng debe ser una longitud valida' })
  lng?: number;

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
  })
  @IsOptional()
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
  categoria?:
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

  @ApiPropertyOptional({ enum: ['alta', 'media', 'baja'] })
  @IsOptional()
  @IsIn(['alta', 'media', 'baja'], {
    message: 'prioridad debe ser alta, media o baja',
  })
  prioridad?: 'alta' | 'media' | 'baja';

  @ApiPropertyOptional({ enum: ['pendiente', 'en_proceso', 'resuelto', 'rechazado', 'cerrado'] })
  @IsOptional()
  @IsIn(['pendiente', 'en_proceso', 'resuelto', 'rechazado', 'cerrado'], {
    message: 'estado no valido',
  })
  estado?: 'pendiente' | 'en_proceso' | 'resuelto' | 'rechazado' | 'cerrado';

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observaciones?: string;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject({ message: 'metadata debe ser un objeto' })
  metadata?: Record<string, unknown>;
}
