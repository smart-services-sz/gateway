import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CloseReclamoDto {
  @ApiProperty({ description: 'UUID del reclamo' })
  @IsUUID('4')
  reclamoId!: string;

  @ApiProperty({ maxLength: 2000 })
  @IsString()
  @MaxLength(2000)
  motivo!: string;

  @IsOptional()
  @IsUUID('4')
  actorId?: string;
}
