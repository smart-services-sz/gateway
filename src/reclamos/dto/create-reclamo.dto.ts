import {
  IsArray,
  IsEmail,
  IsIn,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MensajeHistorialDto } from './mensaje-historial.dto';

export class CreateReclamoDto {
  @ApiProperty({ description: 'UUID v4 de correlacion del flujo' })
  @IsUUID('4', { message: 'correlationId debe ser un UUID v4 valido' })
  correlationId!: string;

  @ApiProperty({ description: 'Identificador unico del contacto' })
  @IsString()
  @IsNotEmpty({ message: 'contactKey no debe estar vacio' })
  contactKey!: string;

  @ApiProperty({
    enum: ['whatsapp', 'web', 'email', 'instagram', 'facebook', 'manual', 'other'],
  })
  @IsIn(['whatsapp', 'web', 'email', 'instagram', 'facebook', 'manual', 'other'], {
    message: 'canal no valido',
  })
  canal!: 'whatsapp' | 'web' | 'email' | 'instagram' | 'facebook' | 'manual' | 'other';

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail({}, { message: 'correo debe tener formato valido' })
  correo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10, { message: 'dni no puede superar 10 caracteres' })
  dni?: string;

  @ApiProperty({ maxLength: 1000 })
  @IsString()
  @IsNotEmpty({ message: 'problema no debe estar vacio' })
  @MaxLength(1000, { message: 'problema no puede superar 1000 caracteres' })
  problema!: string;

  @ApiProperty({ maxLength: 500 })
  @IsString()
  @IsNotEmpty({ message: 'direccion no debe estar vacia' })
  @MaxLength(500, { message: 'direccion no puede superar 500 caracteres' })
  direccion!: string;

  @ApiProperty()
  @IsLatitude({ message: 'lat debe ser una latitud valida' })
  lat!: number;

  @ApiProperty()
  @IsLongitude({ message: 'lng debe ser una longitud valida' })
  lng!: number;

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

  @ApiProperty({ enum: ['alta', 'media', 'baja'] })
  @IsIn(['alta', 'media', 'baja'], { message: 'prioridad debe ser alta, media o baja' })
  prioridad!: 'alta' | 'media' | 'baja';

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observaciones?: string;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject({ message: 'metadata debe ser un objeto' })
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional({ type: () => [MensajeHistorialDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MensajeHistorialDto)
  mensajes?: MensajeHistorialDto[];
}
