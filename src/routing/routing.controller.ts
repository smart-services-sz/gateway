import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
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

@ApiTags('Routing')
@Controller('routing')
export class RoutingController {
  constructor(private readonly routingService: RoutingService) {}

  @Roles('ADMIN', 'AGENT')
  @Permissions('MANAGE_RECLAMOS')
  @Post('simulate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Simula asignacion de rutas por categoria, cupos, zonas y cuadrillas',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Simulacion ejecutada correctamente' })
  simulate(@Body() payload: SimulateRoutingDto) {
    return this.routingService.simulate(payload);
  }

  @Roles('ADMIN', 'AGENT')
  @Permissions('MANAGE_RECLAMOS')
  @Post('generate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Genera y persiste un plan de rutas en ms-routing',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Plan generado correctamente' })
  generate(@Body() payload: SimulateRoutingDto) {
    return this.routingService.generate(payload);
  }

  @Roles('ADMIN', 'AGENT')
  @Permissions('MANAGE_RECLAMOS')
  @Put('rules')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Crea o actualiza reglas de categoria, cuadrilla y zona para ruteo',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Reglas actualizadas' })
  upsertRules(@Body() payload: UpsertRoutingRulesDto) {
    return this.routingService.upsertRules(payload);
  }

  @Roles('ADMIN', 'AGENT')
  @Permissions('VIEW_RECLAMOS')
  @Get('rules')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Obtiene reglas de ruteo vigentes desde ms-routing',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Reglas obtenidas' })
  getRules() {
    return this.routingService.getRules();
  }

  @Roles('ADMIN', 'AGENT')
  @Permissions('VIEW_RECLAMOS')
  @Get('plans/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Obtiene un plan de rutas persistido por id',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Plan obtenido' })
  getPlan(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.routingService.getPlan(id);
  }

  @Roles('ADMIN', 'AGENT')
  @Permissions('MANAGE_RECLAMOS')
  @Post('plans/:id/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Confirma un plan de rutas persistido',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Plan confirmado' })
  confirmPlan(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.routingService.confirmPlan(id);
  }

  @Roles('ADMIN', 'AGENT', 'OFFICIAL')
  @Permissions('VIEW_RECLAMOS')
  @Post('assigned-route')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Obtiene la ruta actualmente asignada para una cuadrilla o agente operativo',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Ruta asignada obtenida' })
  getAssignedRoute(@Body() payload: GetAssignedRouteDto) {
    return this.routingService.getAssignedRoute(payload);
  }

  @Roles('ADMIN', 'AGENT', 'OFFICIAL')
  @Permissions('MANAGE_RECLAMOS')
  @Put('routes/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Actualiza el estado operativo de una ruta',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Estado de ruta actualizado' })
  updateRouteStatus(@Body() payload: UpdateRouteStatusDto) {
    return this.routingService.updateRouteStatus(payload);
  }

  @Roles('ADMIN', 'AGENT', 'OFFICIAL')
  @Permissions('MANAGE_RECLAMOS')
  @Post('interventions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Registra una intervencion operativa en un punto de ruta y sincroniza estado del reclamo',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Intervencion registrada' })
  registerIntervention(@Body() payload: RegisterInterventionDto) {
    return this.routingService.registerIntervention(payload);
  }

  @Roles('ADMIN', 'AGENT', 'OFFICIAL')
  @Permissions('MANAGE_RECLAMOS')
  @Post('interventions/evidence')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Adjunta evidencia multimedia a una intervencion de ruta',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Evidencia adjuntada' })
  attachInterventionEvidence(@Body() payload: AttachInterventionEvidenceDto) {
    return this.routingService.attachInterventionEvidence(payload);
  }
}
