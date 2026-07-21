import { RedisService } from '../../redis/redis.service';
import { WebhookContext } from './webhook-context';
import { WebhookHandler } from './webhook-handler.interface';

// Handler 2 de la cadena.
// Detecta reenvíos del mismo webhook usando los message IDs del payload de Meta.
// Marca cada ID como procesado con SET NX; si TODOS los mensajes del evento ya fueron
// vistos anteriormente, detiene el flujo y responde accepted_duplicate.
// Esto evita el doble-procesamiento ante reintentos de la plataforma Meta.
export class DuplicateMessageHandler implements WebhookHandler {
  private next?: WebhookHandler;

  constructor(
    private readonly redisService: RedisService,
    private readonly keyPrefix: string,
    private readonly dedupTtlSeconds: number,
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

    const messageIds = this.extractMessageIds(payload);

    if (messageIds.length === 0) {
      // Sin IDs no se puede garantizar idempotencia; continúa hacia el siguiente handler.
      if (this.next) await this.next.handle(payload, context);
      return;
    }

    const client = this.redisService.getClient();
    let allDuplicates = true;

    // Intenta marcar cada ID con SET NX; si al menos uno es nuevo, no es duplicado completo.
    for (const id of messageIds) {
      const key = `${this.keyPrefix}:webhook:dedup:${id}`;
      const wasSet = await client.set(key, '1', {
        NX: true,
        EX: this.dedupTtlSeconds,
      });
      if (wasSet === 'OK') {
        allDuplicates = false;
      }
    }

    if (allDuplicates) {
      context.stopped = true;
      context.result = {
        status: 'accepted_duplicate',
        message:
          'Webhook duplicado detectado, todos los mensajes ya fueron procesados',
        data: { messageIds },
      };
      return;
    }

    if (this.next) await this.next.handle(payload, context);
  }

  // Extrae los IDs de mensajes del payload de Meta WhatsApp Business.
  private extractMessageIds(payload: Record<string, unknown>): string[] {
    const ids: string[] = [];
    const entries = (payload.entry as Array<Record<string, unknown>>) ?? [];

    for (const entry of entries) {
      const changes = (entry.changes as Array<Record<string, unknown>>) ?? [];
      for (const change of changes) {
        const value = change.value as Record<string, unknown> | undefined;
        const messages =
          (value?.messages as Array<Record<string, unknown>>) ?? [];
        for (const message of messages) {
          if (message.id && typeof message.id === 'string') {
            ids.push(message.id);
          }
        }
      }
    }

    return ids;
  }
}
