import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  MaxLength,
} from 'class-validator';

export class AttachInterventionEvidenceDto {
  @ApiProperty({ description: 'ID de la intervencion' })
  @IsUUID('4')
  interventionId!: string;

  @ApiProperty({ enum: ['imagen', 'video', 'documento'] })
  @IsIn(['imagen', 'video', 'documento'])
  tipo!: 'imagen' | 'video' | 'documento';

  @ApiProperty({ description: 'Nombre del archivo de evidencia' })
  @IsString()
  @MaxLength(255)
  nombreArchivo!: string;

  @ApiProperty({ description: 'URL del archivo de evidencia' })
  @IsUrl()
  urlArchivo!: string;

  @ApiPropertyOptional({ description: 'Descripcion de la evidencia' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  descripcion?: string;

  @ApiPropertyOptional({ description: 'Actor autenticado de la operacion' })
  @IsOptional()
  @IsUUID('4')
  actorId?: string;

  @ApiPropertyOptional({ description: 'Indica si el actor es ADMIN' })
  @IsOptional()
  @IsBoolean()
  actorIsAdmin?: boolean;
}
