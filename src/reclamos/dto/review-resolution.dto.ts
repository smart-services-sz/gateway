import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class ReviewResolutionDto {
  @ApiProperty({ description: 'UUID del reclamo' })
  @IsUUID('4')
  reclamoId!: string;

  @ApiProperty({ enum: ['aprobada', 'rechazada'] })
  @IsIn(['aprobada', 'rechazada'])
  resultado!: 'aprobada' | 'rechazada';

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comentario?: string;

  @IsOptional()
  @IsUUID('4')
  actorId?: string;
}
