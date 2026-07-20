import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class GetAssignedRouteDto {
  @ApiPropertyOptional({ description: 'Identificador legado de cuadrilla/agente (alias de userId)' })
  @IsOptional()
  @IsString()
  crewId?: string;

  @ApiPropertyOptional({ description: 'ID del usuario operativo asignado' })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({ description: 'Fecha de planificacion YYYY-MM-DD' })
  @IsOptional()
  @IsString()
  planningDate?: string;
}
