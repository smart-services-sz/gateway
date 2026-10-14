import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ReclamosService } from './reclamos.service';
import { CreateReclamoDto } from './dto/create-reclamo.dto';
import { FindReclamosDto } from './dto/find-reclamos.dto';
import { UpdateReclamoDto } from './dto/update-reclamo.dto';
import { ReviewResolutionDto } from './dto/review-resolution.dto';
import { RequestNewVisitDto } from './dto/request-new-visit.dto';
import { CloseReclamoDto } from './dto/close-reclamo.dto';
import { PublicTrackingDto } from './dto/public-tracking.dto';
import { PublicClaimSubmissionDto } from './dto/public-claim-submission.dto';
import type { EvidenceUploadFile } from './evidence-storage.service';
import { JwtUser } from '../common/decorators/current-user.dto';

type ReclamoTerritorialScope = Pick<JwtUser, 'municipalityId' | 'areaId'>;

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

  @Public()
  @Post('public')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FilesInterceptor('evidencias', 3, {
      limits: { files: 3, fileSize: 5 * 1024 * 1024 },
    }),
  )
  @ApiOperation({
    summary: 'Registra un reclamo ciudadano con geolocalizacion validada',
  })
  createPublic(
    @Body() payload: PublicClaimSubmissionDto,
    @Req() request: Request,
    @UploadedFiles() evidencias?: EvidenceUploadFile[],
  ) {
    return this.reclamosService.createPublic(
      payload,
      request.ip || request.socket.remoteAddress || 'unknown',
      evidencias ?? [],
    );
  }

  @Public()
  @Post('seguimiento')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Consulta publica de estado validando codigo y dato de contacto',
  })
  getPublicTracking(
    @Body() payload: PublicTrackingDto,
    @Req() request: Request,
  ) {
    return this.reclamosService.getPublicTracking(
      payload,
      request.ip || request.socket.remoteAddress || 'unknown',
    );
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
  findAll(
    @Query() query: FindReclamosDto,
    @Req() request: Request & { user: JwtUser },
  ) {
    return this.reclamosService.findAll(
      this.applyTerritorialScope(query, request.user),
    );
  }

  @Roles('ADMIN', 'AGENT')
  @Permissions('VIEW_RECLAMOS')
  @Get(':id/history')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Obtiene el historial integral de un reclamo' })
  @ApiParam({ name: 'id', description: 'UUID v4 del reclamo' })
  getHistory(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() request: Request & { user: JwtUser },
  ) {
    return this.reclamosService.getHistory(
      id,
      this.getTerritorialScope(request.user),
    );
  }

  @Roles('ADMIN', 'AGENT')
  @Permissions('MANAGE_RECLAMOS')
  @Post(':id/resolution-review')
  reviewResolution(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() data: Omit<ReviewResolutionDto, 'reclamoId' | 'actorId'>,
    @Req() request: Request & { user: JwtUser },
  ) {
    return this.reclamosService.reviewResolution({
      ...data,
      reclamoId: id,
      actorId: request.user.userId,
    }, this.getTerritorialScope(request.user));
  }

  @Roles('ADMIN', 'AGENT')
  @Permissions('MANAGE_RECLAMOS')
  @Post(':id/new-visit')
  requestNewVisit(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() data: Omit<RequestNewVisitDto, 'reclamoId' | 'actorId'>,
    @Req() request: Request & { user: JwtUser },
  ) {
    return this.reclamosService.requestNewVisit({
      ...data,
      reclamoId: id,
      actorId: request.user.userId,
    }, this.getTerritorialScope(request.user));
  }

  @Roles('ADMIN', 'AGENT')
  @Permissions('MANAGE_RECLAMOS')
  @Post(':id/close')
  close(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() data: Omit<CloseReclamoDto, 'reclamoId' | 'actorId'>,
    @Req() request: Request & { user: JwtUser },
  ) {
    return this.reclamosService.close({
      ...data,
      reclamoId: id,
      actorId: request.user.userId,
    }, this.getTerritorialScope(request.user));
  }

  @Roles('ADMIN', 'AGENT')
  @Permissions('VIEW_RECLAMOS')
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Obtiene un reclamo por id' })
  @ApiParam({ name: 'id', description: 'UUID v4 del reclamo' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Reclamo encontrado' })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Reclamo no encontrado',
  })
  findOne(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() request: Request & { user: JwtUser },
  ) {
    return this.reclamosService.findOne(
      id,
      this.getTerritorialScope(request.user),
    );
  }

  @Roles('ADMIN', 'AGENT')
  @Permissions('MANAGE_RECLAMOS')
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Actualiza un reclamo existente por id' })
  @ApiParam({ name: 'id', description: 'UUID v4 del reclamo' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Reclamo actualizado' })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Reclamo no encontrado',
  })
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() data: UpdateReclamoDto,
    @Req() request: Request & { user: JwtUser },
  ) {
    return this.reclamosService.update(
      id,
      data,
      this.getTerritorialScope(request.user),
    );
  }

  @Roles('ADMIN')
  @Permissions('DELETE_RECLAMOS')
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Elimina un reclamo por id' })
  @ApiParam({ name: 'id', description: 'UUID v4 del reclamo' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Reclamo eliminado' })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Reclamo no encontrado',
  })
  remove(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() request: Request & { user: JwtUser },
  ) {
    return this.reclamosService.remove(
      id,
      this.getTerritorialScope(request.user),
    );
  }

  private applyTerritorialScope<T extends ReclamoTerritorialScope>(
    query: T,
    user: JwtUser,
  ): T {
    return { ...query, ...this.getTerritorialScope(user) };
  }

  private getTerritorialScope(user: JwtUser): ReclamoTerritorialScope {
    if (user.roles.includes('ADMIN') && !user.municipalityId) {
      return {};
    }

    if (!user.municipalityId) {
      throw new ForbiddenException(
        'El usuario no tiene un municipio configurado',
      );
    }

    if (user.roles.includes('AGENT') && !user.areaId) {
      throw new ForbiddenException(
        'El usuario no tiene un area operativa configurada',
      );
    }

    return {
      municipalityId: user.municipalityId,
      ...(user.areaId ? { areaId: user.areaId } : {}),
    };
  }
}
