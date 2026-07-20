import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsUUID } from 'class-validator';

export class UpdateRouteStatusDto {
  @ApiProperty({ description: 'ID de la ruta' })
  @IsUUID('4')
  routeId!: string;

  @ApiProperty({ enum: ['assigned', 'in_progress', 'completed', 'cancelled'] })
  @IsIn(['assigned', 'in_progress', 'completed', 'cancelled'])
  status!: 'assigned' | 'in_progress' | 'completed' | 'cancelled';
}
