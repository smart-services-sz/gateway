import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ReclamosService } from './reclamos.service';
import { CreateReclamoDto } from './dto/create-reclamo.dto';
import { FindReclamosDto } from './dto/find-reclamos.dto';
import { UpdateReclamoDto } from './dto/update-reclamo.dto';

@ApiTags('Reclamos')
@Controller('reclamos')
export class ReclamosController {
  constructor(private readonly reclamosService: ReclamosService) {}

  @Public()
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crea un reclamo y lo persiste via ms-reclamos' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Reclamo creado correctamente',
  })
  create(@Body() payload: CreateReclamoDto) {
    return this.reclamosService.create(payload);
  }

  @Roles('ADMIN', 'AGENT')
  @Permissions('VIEW_RECLAMOS')
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Lista reclamos con paginacion y filtros' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Listado paginado de reclamos',
  })
  findAll(@Query() query: FindReclamosDto) {
    return this.reclamosService.findAll(query);
  }

  @Roles('ADMIN', 'AGENT')
  @Permissions('VIEW_RECLAMOS')
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Obtiene un reclamo por id' })
  @ApiParam({ name: 'id', description: 'UUID v4 del reclamo' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Reclamo encontrado' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Reclamo no encontrado' })
  findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.reclamosService.findOne(id);
  }

  @Roles('ADMIN', 'AGENT')
  @Permissions('MANAGE_RECLAMOS')
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Actualiza un reclamo existente por id' })
  @ApiParam({ name: 'id', description: 'UUID v4 del reclamo' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Reclamo actualizado' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Reclamo no encontrado' })
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() data: UpdateReclamoDto,
  ) {
    return this.reclamosService.update(id, data);
  }

  @Roles('ADMIN')
  @Permissions('DELETE_RECLAMOS')
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Elimina un reclamo por id' })
  @ApiParam({ name: 'id', description: 'UUID v4 del reclamo' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Reclamo eliminado' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Reclamo no encontrado' })
  remove(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.reclamosService.remove(id);
  }
}
