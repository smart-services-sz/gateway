import {
  CallHandler,
  ExecutionContext,
  Inject,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import { catchError, tap, throwError } from 'rxjs';

export const AUDIT_NATS_CLIENT = 'AUDIT_NATS_CLIENT';
export const AUDIT_SERVICE_NAME = 'AUDIT_SERVICE_NAME';

type AuditRequest = Request & {
  correlationId?: string;
  params?: Record<string, string>;
  user?: {
    userId?: string;
    municipalityId?: string;
  };
};

@Injectable()
export class AuditLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditLoggingInterceptor.name);

  constructor(
    @Inject(AUDIT_NATS_CLIENT) private readonly natsClient: ClientProxy,
    @Inject(AUDIT_SERVICE_NAME) private readonly serviceName: string,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    if (context.getType() !== 'http') return next.handle();

    const request = context.switchToHttp().getRequest<AuditRequest>();
    const response = context.switchToHttp().getResponse<Response>();
    const correlationId = this.correlationId(request.headers['x-correlation-id']);
    const startedAt = Date.now();
    const route = this.routeName(request);
    const actionPrefix = `HTTP.${request.method}.${route}`.slice(0, 96);
    const entityId = request.params?.id ?? request.params?.reclamoId ?? request.params?.planId;

    request.correlationId = correlationId;
    response.setHeader('x-correlation-id', correlationId);

    return next.handle().pipe(
      tap(() => this.publish({
        correlationId,
        actorId: request.user?.userId,
        municipalityId: request.user?.municipalityId,
        entity: this.entityName(route),
        entityId,
        action: `${actionPrefix}.SUCCESS`,
        outcome: 'success',
        statusCode: response.statusCode,
        durationMs: Date.now() - startedAt,
      })),
      catchError((error: unknown) => {
        const statusCode = this.statusCode(error);
        this.publish({
          correlationId,
          actorId: request.user?.userId,
          municipalityId: request.user?.municipalityId,
          entity: this.entityName(route),
          entityId,
          action: `${actionPrefix}.ERROR`,
          outcome: 'error',
          statusCode,
          errorCode: error instanceof Error ? error.name : 'UnknownError',
          durationMs: Date.now() - startedAt,
        });
        return throwError(() => error);
      }),
    );
  }

  private publish(input: {
    correlationId: string;
    actorId?: string;
    municipalityId?: string;
    entity: string;
    entityId?: string;
    action: string;
    outcome: 'success' | 'error';
    statusCode: number;
    errorCode?: string;
    durationMs: number;
  }) {
    const eventId = randomUUID();
    this.natsClient.emit('audit.log', {
      eventId,
      service: this.serviceName,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      performedBy: input.actorId,
      municipalityId: input.municipalityId,
      correlationId: input.correlationId,
      level: input.outcome === 'error'
        ? input.statusCode >= 500 ? 'ERROR' : 'WARNING'
        : 'INFO',
      metadata: {
        transport: 'http',
        outcome: input.outcome,
        statusCode: input.statusCode,
        durationMs: input.durationMs,
        ...(input.errorCode ? { errorCode: input.errorCode } : {}),
      },
      timestamp: new Date().toISOString(),
    }).subscribe({
      error: () => this.logger.warn(`[${input.correlationId}] audit event publish failed | eventId=${eventId}`),
    });
  }

  private correlationId(value: string | string[] | undefined): string {
    const candidate = Array.isArray(value) ? value[0] : value;
    return candidate && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(candidate)
      ? candidate
      : randomUUID();
  }

  private routeName(request: AuditRequest): string {
    const path = request.route?.path ?? 'unmatched';
    return path.replace(/[^a-zA-Z0-9_/:.-]/g, '_').slice(0, 64);
  }

  private entityName(route: string): string {
    if (/reclamos|claims/i.test(route)) return 'Reclamo';
    if (/routing|plans|routes|interventions/i.test(route)) return 'Routing';
    if (/users/i.test(route)) return 'User';
    if (/roles/i.test(route)) return 'Role';
    if (/permissions/i.test(route)) return 'Permission';
    if (/municipal/i.test(route)) return 'Municipality';
    if (/audit/i.test(route)) return 'AuditLog';
    return 'HttpRequest';
  }

  private statusCode(error: unknown): number {
    if (typeof error === 'object' && error !== null && 'getStatus' in error &&
        typeof error.getStatus === 'function') {
      return error.getStatus();
    }
    return 500;
  }
}