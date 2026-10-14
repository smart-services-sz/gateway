import {
  BadGatewayException,
  HttpException,
  HttpStatus,
  ForbiddenException,
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
import {
  EvidenceStorageService,
  EvidenceUploadFile,
  StoredEvidence,
} from '../reclamos/evidence-storage.service';

@Injectable()
export class RoutingService {
  private readonly logger = new Logger(RoutingService.name);

  constructor(
    @Inject('NATS_CLIENT') private readonly natsClient: ClientProxy,
    private readonly evidenceStorage: EvidenceStorageService,
  ) {}

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

  async getPlan(id: string) {
    return this.signEvidenceResponse(await this.request('routing.plan.get', { id }));
  }

  confirmPlan(id: string) {
    return this.request('routing.plan.confirm', { id });
  }

  deletePlan(id: string) {
    return this.request('routing.plan.delete', { id });
  }

  async getAssignedRoute(payload: GetAssignedRouteDto) {
    return this.signEvidenceResponse(
      await this.request('routing.assigned-route.get', payload),
    );
  }

  async getAssignedRoutes(payload: GetAssignedRouteDto) {
    return this.signEvidenceResponse(
      await this.request('routing.assigned-routes.list', payload),
    );
  }

  updateRouteStatus(payload: UpdateRouteStatusDto) {
    return this.request('routing.route.status.update', payload);
  }

  registerIntervention(payload: RegisterInterventionDto) {
    return this.request('routing.intervention.register', payload);
  }

  async attachInterventionEvidence(
    payload: AttachInterventionEvidenceDto,
    file: EvidenceUploadFile,
    actor: { actorId: string; actorIsAdmin: boolean; municipalityId?: string },
  ) {
    const municipalityId = actor.municipalityId?.trim() || 'platform';
    if (!actor.actorIsAdmin) {
      if (!actor.municipalityId) {
        throw new ForbiddenException(
          'El usuario no tiene un municipio configurado para adjuntar evidencia.',
        );
      }
      const assigned = await this.request<{
        data?: Array<{
          stops?: Array<{
            intervention?: { id: string } | null;
          }>;
        }>;
      }>('routing.assigned-routes.list', { userId: actor.actorId });
      const ownsIntervention = (assigned.data ?? []).some((route) =>
        (route.stops ?? []).some(
          (stop) => stop.intervention?.id === payload.interventionId,
        ),
      );
      if (!ownsIntervention) {
        throw new ForbiddenException(
          'La intervencion no pertenece a una ruta asignada al usuario.',
        );
      }
    }

    const [stored] = await this.evidenceStorage.storeEvidence(
      municipalityId,
      payload.interventionId,
      [file],
    );
    const tipo = this.evidenceType(stored.contentType);
    try {
      const response = await this.request<unknown>(
        'routing.intervention.evidence.attach',
        {
          interventionId: payload.interventionId,
          tipo,
          nombreArchivo: stored.nombreArchivo,
          objectKey: stored.objectKey,
          descripcion: payload.descripcion,
          actorId: actor.actorId,
          actorIsAdmin: actor.actorIsAdmin,
        },
      );
      return this.signEvidenceResponse(response);
    } catch (error: unknown) {
      await this.evidenceStorage.deleteEvidence([stored]);
      throw error;
    }
  }

  private evidenceType(
    contentType: string,
  ): 'imagen' | 'video' | 'documento' {
    if (contentType.startsWith('image/')) return 'imagen';
    if (contentType.startsWith('video/')) return 'video';
    return 'documento';
  }

  private async signEvidenceResponse<T>(value: T): Promise<T> {
    if (Array.isArray(value)) {
      return (await Promise.all(
        value.map((item) => this.signEvidenceResponse(item)),
      )) as T;
    }
    if (!this.isRecord(value)) return value;
    if (typeof value.urlArchivo === 'string') {
      return (await this.signEvidenceItem(value)) as T;
    }

    const entries = await Promise.all(
      Object.entries(value).map(async ([key, child]) => {
        if (key === 'evidences' && Array.isArray(child)) {
          return [
            key,
            await Promise.all(
              child.map((evidence) => this.signEvidenceItem(evidence)),
            ),
          ] as const;
        }
        return [key, await this.signEvidenceResponse(child)] as const;
      }),
    );
    return Object.fromEntries(entries) as T;
  }

  private async signEvidenceItem(value: unknown): Promise<unknown> {
    if (!this.isRecord(value) || typeof value.urlArchivo !== 'string') {
      return value;
    }
    if (!value.urlArchivo.startsWith('evidencias/')) {
      return value;
    }

    const signedUrl = await this.evidenceStorage.createDownloadUrl({
      objectKey: value.urlArchivo,
      nombreArchivo:
        typeof value.nombreArchivo === 'string'
          ? value.nombreArchivo
          : 'evidencia',
    });
    return { ...value, urlArchivo: signedUrl };
  }

  private async request<T = unknown>(
    pattern: string,
    payload: unknown,
  ): Promise<T> {
    try {
      return await firstValueFrom(
        this.natsClient.send<T>(pattern, payload).pipe(timeout(15000)),
      );
    } catch (error: unknown) {
      this.logger.error(
        `Error RPC en patron ${pattern}: ${this.stringifyError(error)}`,
      );
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

      if (
        message.toLowerCase().includes('no existe') ||
        message.toLowerCase().includes('no hay')
      ) {
        return new HttpException(message, HttpStatus.NOT_FOUND);
      }

      return new BadGatewayException(message);
    }

    if (error instanceof Error) {
      return new BadGatewayException(error.message);
    }

    return new BadGatewayException(
      'Error inesperado al comunicarse con ms-routing',
    );
  }

  private extractStatusCode(
    error: Record<string, unknown>,
  ): number | undefined {
    const direct = error.statusCode;
    if (typeof direct === 'number') {
      return direct;
    }

    const nested = this.isRecord(error.error)
      ? error.error.statusCode
      : undefined;
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

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }
}
