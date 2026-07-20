import {
  BadGatewayException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';
import { SimulateRoutingDto } from './dto/simulate-routing.dto';
import { UpsertRoutingRulesDto } from './dto/upsert-routing-rules.dto';
import { GetAssignedRouteDto } from './dto/get-assigned-route.dto';
import { UpdateRouteStatusDto } from './dto/update-route-status.dto';
import { RegisterInterventionDto } from './dto/register-intervention.dto';
import { AttachInterventionEvidenceDto } from './dto/attach-intervention-evidence.dto';
import { SaveRoutingAreaPlanDto } from './dto/save-routing-area-plan.dto';

@Injectable()
export class RoutingService {
  private readonly logger = new Logger(RoutingService.name);

  constructor(@Inject('NATS_CLIENT') private readonly natsClient: ClientProxy) {}

  simulate(payload: SimulateRoutingDto) {
    return this.request('routing.simulate', payload);
  }

  generate(payload: SimulateRoutingDto) {
    return this.request('routing.generate', payload);
  }

  upsertRules(payload: UpsertRoutingRulesDto) {
    return this.request('routing.rules.upsert', payload);
  }

  getRules() {
    return this.request('routing.rules.get', {});
  }

  listPlans() {
    return this.request('routing.plans.list', {});
  }

  listAreaPlans() {
    return this.request('routing.area-plans.list', {});
  }

  saveAreaPlan(payload: SaveRoutingAreaPlanDto) {
    return this.request('routing.area-plans.save', payload);
  }

  deleteAreaPlan(id: string) {
    return this.request('routing.area-plans.delete', { id });
  }

  getPlan(id: string) {
    return this.request('routing.plan.get', { id });
  }

  confirmPlan(id: string) {
    return this.request('routing.plan.confirm', { id });
  }

  deletePlan(id: string) {
    return this.request('routing.plan.delete', { id });
  }

  getAssignedRoute(payload: GetAssignedRouteDto) {
    return this.request('routing.assigned-route.get', payload);
  }

  updateRouteStatus(payload: UpdateRouteStatusDto) {
    return this.request('routing.route.status.update', payload);
  }

  registerIntervention(payload: RegisterInterventionDto) {
    return this.request('routing.intervention.register', payload);
  }

  attachInterventionEvidence(payload: AttachInterventionEvidenceDto) {
    return this.request('routing.intervention.evidence.attach', payload);
  }

  private async request<T = unknown>(pattern: string, payload: unknown): Promise<T> {
    try {
      return await firstValueFrom(
        this.natsClient.send<T>(pattern, payload).pipe(timeout(15000)),
      );
    } catch (error: unknown) {
      this.logger.error(`Error RPC en patron ${pattern}: ${this.stringifyError(error)}`);
      throw this.mapRpcError(error);
    }
  }

  private mapRpcError(error: unknown): HttpException {
    if (error instanceof HttpException) {
      return error;
    }

    if (this.isRecord(error)) {
      const statusCode = this.extractStatusCode(error);
      const message = this.extractMessage(error);

      if (statusCode) {
        return new HttpException(message, statusCode);
      }

      if (message.toLowerCase().includes('no existe') || message.toLowerCase().includes('no hay')) {
        return new HttpException(message, HttpStatus.NOT_FOUND);
      }

      return new BadGatewayException(message);
    }

    if (error instanceof Error) {
      return new BadGatewayException(error.message);
    }

    return new BadGatewayException('Error inesperado al comunicarse con ms-routing');
  }

  private extractStatusCode(error: Record<string, unknown>): number | undefined {
    const direct = error.statusCode;
    if (typeof direct === 'number') {
      return direct;
    }

    const nested = this.isRecord(error.error) ? error.error.statusCode : undefined;
    if (typeof nested === 'number') {
      return nested;
    }

    return undefined;
  }

  private extractMessage(error: Record<string, unknown>): string {
    const candidates = [
      error.message,
      this.isRecord(error.error) ? error.error.message : undefined,
      this.isRecord(error.response) ? error.response.message : undefined,
    ];

    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate;
      }

      if (Array.isArray(candidate) && candidate.length > 0) {
        return candidate.map(String).join(', ');
      }
    }

    return 'Error desconocido en ms-routing';
  }

  private stringifyError(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    if (this.isRecord(error)) {
      return JSON.stringify(error);
    }

    return String(error);
  }

  private isRecord(value: unknown): value is Record<string, any> {
    return typeof value === 'object' && value !== null;
  }
}
