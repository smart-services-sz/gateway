import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

export class MensajeHistorialDto {
  @ApiProperty({ enum: ['usuario', 'asistente'] })
  @IsIn(['usuario', 'asistente'], {
    message: 'origen debe ser usuario o asistente',
  })
  origen!: 'usuario' | 'asistente';

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  texto!: string;

  @ApiPropertyOptional({ description: 'Timestamp ISO 8601 del mensaje' })
  @IsOptional()
  @IsString()
  creadoEn?: string;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
