import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsOptional, IsString, Matches } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class FindReclamosDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString({ message: 'contactKey debe ser una cadena de texto' })
  contactKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString({ message: 'codigoSeguimiento debe ser una cadena de texto' })
  codigoSeguimiento?: string;

  @ApiPropertyOptional({
    enum: ['pendiente', 'en_proceso', 'resuelto', 'rechazado', 'cerrado'],
  })
  @IsOptional()
  @IsIn(['pendiente', 'en_proceso', 'resuelto', 'rechazado', 'cerrado'], {
    message: 'estado no valido',
  })
  estado?: 'pendiente' | 'en_proceso' | 'resuelto' | 'rechazado' | 'cerrado';

  @ApiPropertyOptional({
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
  @IsOptional()
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
  categoria?:
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

  @ApiPropertyOptional({ enum: ['alta', 'media', 'baja'] })
  @IsOptional()
  @IsIn(['alta', 'media', 'baja'], {
    message: 'prioridad no valida',
  })
  prioridad?: 'alta' | 'media' | 'baja';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9]+(?:_[a-z0-9]+)*$/)
  municipalityId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9]+(?:_[a-z0-9]+)*$/)
  areaId?: string;

  @ApiPropertyOptional({ enum: [1, -1], default: -1 })
  @IsOptional()
  @Type(() => Number)
  @IsIn([1, -1], {
    message: 'sortDirection debe ser 1 (asc) o -1 (desc)',
  })
  sortDirection: 1 | -1 = -1;
}
