import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class GetAssignedRouteDto {
  @ApiPropertyOptional({ description: 'Identificador de cuadrilla/agente' })
  @IsString()
  crewId!: string;

  @ApiPropertyOptional({ description: 'Fecha de planificacion YYYY-MM-DD' })
  @IsOptional()
  @IsString()
  planningDate?: string;
}
