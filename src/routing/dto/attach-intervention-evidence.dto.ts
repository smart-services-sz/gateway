import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class AttachInterventionEvidenceDto {
  @ApiProperty({ description: 'ID de la intervencion' })
  @IsUUID('4')
  interventionId!: string;

  @ApiPropertyOptional({ description: 'Descripcion de la evidencia' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  descripcion?: string;
}
