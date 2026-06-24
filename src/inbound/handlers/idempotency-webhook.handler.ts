import { RedisService } from '../../redis/redis.service';
import { AbstractWebhookHandler } from './abstract-webhook.handler';
import { WebhookProcessingContext } from './webhook-processing-context';

// Handler 2 de la cadena.
// Verifica idempotencia usando SET NX (solo-si-no-existe) en Redis.
// Si el externalMessageId ya fue procesado → detiene el flujo y retorna
// accepted_duplicate sin reenviar nada a ms-ai.
// La clave incluye canal + externalMessageId para evitar colisiones entre canales.
export class IdempotencyWebhookHandler extends AbstractWebhookHandler {
  constructor(
    private readonly redisService: RedisService,
    private readonly idempotencyTtlSeconds: number,
    private readonly keyPrefix: string,
  ) {
    super();
  }

  protected async process(ctx: WebhookProcessingContext): Promise<void> {
    const sanitized = ctx.sanitized!;
    const isDuplicate = await this.checkIdempotency(
      sanitized.channel,
      sanitized.externalMessageId,
      sanitized.receivedAt,
    );

    ctx.isDuplicate = isDuplicate;

    if (isDuplicate) {
      ctx.stopProcessing = true;
      ctx.result = {
        status: 'accepted_duplicate',
        message: 'Mensaje duplicado detectado, no se reprocesa',
        data: {
          contactKey: sanitized.contactKey,
          externalMessageId: sanitized.externalMessageId,
        },
      };
    }
  }

  // Escribe la clave con NX + TTL. Si ya existe (null), es duplicado.
  // 'OK' = primera vez procesado; null = ya existía.
  private async checkIdempotency(
    channel: string,
    externalMessageId: string | undefined,
    receivedAt: string,
  ): Promise<boolean> {
    if (!externalMessageId) {
      // Sin ID externo no podemos garantizar idempotencia; se procesa igual.
      return false;
    }

    const key = `${this.keyPrefix}:idempotency:${channel}:${externalMessageId}`;
    const client = this.redisService.getClient();
    const wasSet = await client.set(key, receivedAt, {
      NX: true,
      EX: this.idempotencyTtlSeconds,
    });

    return wasSet !== 'OK';
  }
}
