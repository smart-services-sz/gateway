import {
  Body,
  Controller,
  Delete,
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
import { SaveRoutingAreaPlanDto } from './dto/save-routing-area-plan.dto';

@ApiTags('Routing')
@Controller('routing')
export class RoutingController {
  constructor(private readonly routingService: RoutingService) {}

  @Roles('ADMIN', 'AGENT')
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
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Plan generado correctamente',
  })
  generate(@Body() payload: SimulateRoutingDto) {
    return this.routingService.generate(payload);
  }

  @Roles('ADMIN', 'AGENT')
  @Permissions('MANAGE_RECLAMOS')
  @Put('rules')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Crea o actualiza reglas de categoria, cuadrilla y zona para ruteo',
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
  @Get('area-plans')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Obtiene planes por area persistidos',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Planes por area obtenidos',
  })
  listAreaPlans() {
    return this.routingService.listAreaPlans();
  }

  @Roles('ADMIN', 'AGENT')
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
  listPlans() {
    return this.routingService.listPlans();
  }

  @Roles('ADMIN', 'AGENT')
  @Permissions('MANAGE_RECLAMOS')
  @Post('area-plans')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Crea o actualiza un plan por area',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Plan por area guardado' })
  saveAreaPlan(@Body() payload: SaveRoutingAreaPlanDto) {
    return this.routingService.saveAreaPlan(payload);
  }

  @Roles('ADMIN', 'AGENT')
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
  deleteAreaPlan(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.routingService.deleteAreaPlan(id);
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

  @Roles('ADMIN', 'AGENT')
  @Permissions('MANAGE_RECLAMOS')
  @Delete('plans/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Elimina un plan de rutas persistido',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Plan eliminado' })
  deletePlan(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.routingService.deletePlan(id);
  }

  @Roles('ADMIN', 'AGENT', 'OFFICIAL')
  @Permissions('VIEW_RECLAMOS')
  @Post('assigned-route')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Obtiene la ruta actualmente asignada para un usuario operativo',
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
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Estado de ruta actualizado',
  })
  updateRouteStatus(@Body() payload: UpdateRouteStatusDto) {
    return this.routingService.updateRouteStatus(payload);
  }

  @Roles('ADMIN', 'AGENT', 'OFFICIAL')
  @Permissions('MANAGE_RECLAMOS')
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
