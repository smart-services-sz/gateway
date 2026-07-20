import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class RegisterInterventionDto {
  @ApiProperty({ description: 'ID de la ruta' })
  @IsUUID('4')
  routeId!: string;

  @ApiProperty({ description: 'ID del punto/parada' })
  @IsUUID('4')
  stopId!: string;

  @ApiProperty({ enum: ['resuelto', 'no_resuelto', 'requiere_nueva_visita', 'no_corresponde'] })
  @IsIn(['resuelto', 'no_resuelto', 'requiere_nueva_visita', 'no_corresponde'])
  result!: 'resuelto' | 'no_resuelto' | 'requiere_nueva_visita' | 'no_corresponde';

  @ApiPropertyOptional({ description: 'Observacion de la intervencion' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observation?: string;

  @ApiPropertyOptional({ description: 'Usuario/agente que ejecuta la intervencion' })
  @IsOptional()
  @IsString()
  performedBy?: string;
}
