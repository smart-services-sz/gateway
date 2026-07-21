import { Logger } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';
import { WebhookContext } from './webhook-context';
import { WebhookHandler } from './webhook-handler.interface';

// Handler 3 de la cadena.
// Implementa rate limiting por ventana fija sobre el account ID de WhatsApp Business.
// Usa Redis INCR + EXPIRE; si la cuenta supera maxRequests en windowSeconds detiene el flujo.
// El header de respuesta indica al remitente cuántos requests le quedan (para debug).
export class RateLimitHandler implements WebhookHandler {
  private readonly logger = new Logger(RateLimitHandler.name);
  private next?: WebhookHandler;

  constructor(
    private readonly redisService: RedisService,
    private readonly keyPrefix: string,
    private readonly maxRequests: number,
    private readonly windowSeconds: number,
  ) {}

  setNext(handler: WebhookHandler): WebhookHandler {
    this.next = handler;
    return handler;
  }

  async handle(
    payload: Record<string, unknown>,
    context: WebhookContext,
  ): Promise<void> {
    if (context.stopped) return;

    const accountIds = this.extractAccountIds(payload);

    if (accountIds.length === 0) {
      if (this.next) await this.next.handle(payload, context);
      return;
    }

    for (const accountId of accountIds) {
      const { isLimited, current } = await this.checkRateLimit(accountId);

      if (isLimited) {
        this.logger.warn(
          `Rate limit excedido para la cuenta ${accountId}: ${current}/${this.maxRequests} en ${this.windowSeconds}s`,
        );
        context.stopped = true;
        context.result = {
          status: 'rate_limited',
          message: `Tasa de webhooks excedida para la cuenta ${accountId}. Reintentar después de ${this.windowSeconds}s.`,
          data: {
            accountId,
            current,
            max: this.maxRequests,
            windowSeconds: this.windowSeconds,
          },
        };
        return;
      }
    }

    if (this.next) await this.next.handle(payload, context);
  }

  private async checkRateLimit(
    accountId: string,
  ): Promise<{ isLimited: boolean; current: number }> {
    const key = `${this.keyPrefix}:webhook:ratelimit:${accountId}`;
    const client = this.redisService.getClient();

    const current = await client.incr(key);

    // Establece TTL solo la primera vez para no reiniciar la ventana en cada request.
    if (current === 1) {
      await client.expire(key, this.windowSeconds);
    }

    return { isLimited: current > this.maxRequests, current };
  }

  // Extrae los entry IDs (WABA account IDs) del payload de Meta.
  private extractAccountIds(payload: Record<string, unknown>): string[] {
    const entries = (payload.entry as Array<Record<string, unknown>>) ?? [];
    return entries
      .map((e) => (typeof e.id === 'string' ? e.id : ''))
      .filter(Boolean);
  }
}
