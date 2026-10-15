import {
  Body,
  Controller,
  Delete,
  BadRequestException,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Req,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { SimulateRoutingDto } from './dto/simulate-routing.dto';
import { RoutingService } from './routing.service';
import { UpsertRoutingRulesDto } from './dto/upsert-routing-rules.dto';
import { GetAssignedRouteDto } from './dto/get-assigned-route.dto';
import { UpdateRouteStatusDto } from './dto/update-route-status.dto';
import { RegisterInterventionDto } from './dto/register-intervention.dto';
import { AttachInterventionEvidenceDto } from './dto/attach-intervention-evidence.dto';
import { SaveRoutingAreaPlanDto } from './dto/save-routing-area-plan.dto';
import { JwtUser } from '../common/decorators/current-user.dto';
import type { EvidenceUploadFile } from '../reclamos/evidence-storage.service';

@ApiTags('Routing')
@Controller('routing')
export class RoutingController {
  constructor(private readonly routingService: RoutingService) {}

  @Roles('ADMIN')
  @Permissions('MANAGE_RECLAMOS')
  @Post('simulate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Simula asignacion de rutas por categoria, cupos, zonas y cuadrillas',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Simulacion ejecutada correctamente',
  })
  simulate(
    @Body() payload: SimulateRoutingDto,
    @Req() request: Request & { user: JwtUser },
  ) {
    return this.routingService.simulate(
      this.applyTerritorialScope(payload, request.user),
    );
  }

  @Roles('ADMIN')
  @Permissions('MANAGE_RECLAMOS')
  @Post('generate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Genera y persiste un plan de rutas en ms-routing',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Plan generado correctamente',
  })
  generate(
    @Body() payload: SimulateRoutingDto,
    @Req() request: Request & { user: JwtUser },
  ) {
    return this.routingService.generate(
      this.applyTerritorialScope(payload, request.user),
    );
  }

  @Roles('ADMIN')
  @Permissions('MANAGE_RECLAMOS')
  @Put('rules')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Crea o actualiza reglas de categoria, cuadrilla y zona para ruteo',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Reglas actualizadas' })
  upsertRules(@Body() payload: UpsertRoutingRulesDto, @Req() request: Request & { user: JwtUser }) {
    return this.routingService.upsertRules(payload, this.municipalityFor(request.user));
  }

  @Roles('ADMIN')
  @Permissions('VIEW_RECLAMOS')
  @Get('rules')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Obtiene reglas de ruteo vigentes desde ms-routing',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Reglas obtenidas' })
  getRules(@Req() request: Request & { user: JwtUser }) {
    return this.routingService.getRules(this.municipalityFor(request.user));
  }

  @Roles('ADMIN')
  @Permissions('VIEW_RECLAMOS')
  @Get('area-plans')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Obtiene planes por area persistidos',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Planes por area obtenidos',
  })
  listAreaPlans(@Req() request: Request & { user: JwtUser }) {
    return this.routingService.listAreaPlans(this.municipalityFor(request.user));
  }

  @Roles('ADMIN')
  @Permissions('VIEW_RECLAMOS')
  @Get('plans')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Obtiene historial de planes de rutas persistidos',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Historial de planes obtenido',
  })
  listPlans(@Req() request: Request & { user: JwtUser }) {
    return this.routingService.listPlans(this.municipalityFor(request.user));
  }

  @Roles('ADMIN')
  @Permissions('MANAGE_RECLAMOS')
  @Post('area-plans')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Crea o actualiza un plan por area',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Plan por area guardado' })
  saveAreaPlan(@Body() payload: SaveRoutingAreaPlanDto, @Req() request: Request & { user: JwtUser }) {
    return this.routingService.saveAreaPlan(payload, this.municipalityFor(request.user));
  }

  @Roles('ADMIN')
  @Permissions('MANAGE_RECLAMOS')
  @Delete('area-plans/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Elimina un plan por area',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Plan por area eliminado',
  })
  deleteAreaPlan(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string, @Req() request: Request & { user: JwtUser }) {
    return this.routingService.deleteAreaPlan(id, this.municipalityFor(request.user));
  }

  @Roles('ADMIN')
  @Permissions('VIEW_RECLAMOS')
  @Get('plans/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Obtiene un plan de rutas persistido por id',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Plan obtenido' })
  getPlan(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string, @Req() request: Request & { user: JwtUser }) {
    return this.routingService.getPlan(id, this.municipalityFor(request.user));
  }

  @Roles('ADMIN')
  @Permissions('MANAGE_RECLAMOS')
  @Post('plans/:id/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Confirma un plan de rutas persistido',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Plan confirmado' })
  confirmPlan(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string, @Req() request: Request & { user: JwtUser }) {
    return this.routingService.confirmPlan(id, this.municipalityFor(request.user));
  }

  @Roles('ADMIN')
  @Permissions('MANAGE_RECLAMOS')
  @Delete('plans/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Elimina un plan de rutas persistido',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Plan eliminado' })
  deletePlan(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string, @Req() request: Request & { user: JwtUser }) {
    return this.routingService.deletePlan(id, this.municipalityFor(request.user));
  }

  @Roles('ADMIN', 'AGENT', 'OFFICIAL')
  @Get('assigned-routes')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Obtiene las rutas confirmadas del usuario autenticado' })
  getAssignedRoutes(@Req() request: Request & { user: JwtUser }) {
    return this.routingService.getAssignedRoutes({ userId: request.user.userId, municipalityId: this.municipalityFor(request.user) });
  }

  @Roles('ADMIN', 'AGENT', 'OFFICIAL')
  @Post('assigned-route')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Obtiene la ruta actualmente asignada para un usuario operativo',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Ruta asignada obtenida' })
  getAssignedRoute(
    @Body() payload: GetAssignedRouteDto,
    @Req() request: Request & { user: JwtUser },
  ) {
    const isAdmin = request.user.roles.includes('ADMIN');
    return this.routingService.getAssignedRoute(
      { ...(isAdmin
        ? payload
        : { ...payload, userId: request.user.userId, crewId: undefined }),
        municipalityId: this.municipalityFor(request.user) },
    );
  }

  @Roles('ADMIN', 'AGENT', 'OFFICIAL')
  @Put('routes/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Actualiza el estado operativo de una ruta',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Estado de ruta actualizado',
  })
  updateRouteStatus(
    @Body() payload: UpdateRouteStatusDto,
    @Req() request: Request & { user: JwtUser },
  ) {
    return this.routingService.updateRouteStatus({
      ...payload,
      municipalityId: this.municipalityFor(request.user),
      actorId: request.user.userId,
      actorIsAdmin: request.user.roles.includes('ADMIN'),
    });
  }

  @Roles('ADMIN', 'AGENT', 'OFFICIAL')
  @Post('interventions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Registra una intervencion operativa en un punto de ruta y sincroniza estado del reclamo',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Intervencion registrada',
  })
  registerIntervention(
    @Body() payload: RegisterInterventionDto,
    @Req() request: Request & { user: JwtUser },
  ) {
    return this.routingService.registerIntervention({
      ...payload,
      municipalityId: this.municipalityFor(request.user),
      performedBy: request.user.userId,
      actorId: request.user.userId,
      actorIsAdmin: request.user.roles.includes('ADMIN'),
    });
  }

  @Roles('ADMIN', 'AGENT', 'OFFICIAL')
  @Post('interventions/evidence')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FilesInterceptor('evidencia', 1, {
      limits: { files: 1, fileSize: 5 * 1024 * 1024 },
    }),
  )
  @ApiOperation({
    summary: 'Adjunta evidencia multimedia a una intervencion de ruta',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Evidencia adjuntada' })
  attachInterventionEvidence(
    @Body() payload: AttachInterventionEvidenceDto,
    @Req() request: Request & { user: JwtUser },
    @UploadedFiles() files?: EvidenceUploadFile[],
  ) {
    const file = files?.[0];
    if (!file) {
      throw new BadRequestException('Debe adjuntar un archivo de evidencia.');
    }
    return this.routingService.attachInterventionEvidence(payload, file, {
      actorId: request.user.userId,
      actorIsAdmin: request.user.roles.includes('ADMIN'),
      municipalityId: this.municipalityFor(request.user),
    });
  }

  private municipalityFor(user: JwtUser): string {
    const id = user.municipalityId?.trim();
    if (!id || !/^[a-z0-9]+(?:_[a-z0-9]+)*$/.test(id)) {
      throw new ForbiddenException('El usuario debe tener un municipio configurado para operar rutas');
    }
    return id;
  }

  private applyTerritorialScope(
    payload: SimulateRoutingDto,
    user: JwtUser,
  ): SimulateRoutingDto {
    const municipalityId = this.municipalityFor(user);
    if (!user.roles.includes('ADMIN') && !user.areaId) {
      throw new ForbiddenException(
        'El usuario no tiene municipio y area operativa configurados',
      );
    }

    return {
      ...payload,
      municipalityId,
      ...(!user.roles.includes('ADMIN') ? { areaId: user.areaId } : {}),
    };
  }
}
