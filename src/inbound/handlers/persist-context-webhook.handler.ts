import { RedisService } from '../../redis/redis.service';
import { AbstractWebhookHandler } from './abstract-webhook.handler';
import {
  InboundContext,
  MessageRecord,
  SanitizedInboundMessage,
  WebhookProcessingContext,
} from './webhook-processing-context';

// Handler 3 de la cadena.
// Actualiza el contexto del contacto en Redis y agrega el mensaje al buffer.
// Usa lPush + lTrim para mantener el buffer acotado a messageHistoryLimit.
// Todo en una transacción atómica (MULTI/EXEC) para consistencia.
export class PersistContextWebhookHandler extends AbstractWebhookHandler {
  constructor(
    private readonly redisService: RedisService,
    private readonly contextTtlSeconds: number,
    private readonly messageHistoryLimit: number,
    private readonly keyPrefix: string,
  ) {
    super();
  }

  protected async process(ctx: WebhookProcessingContext): Promise<void> {
    ctx.persistedContext = await this.persistConversationContext(
      ctx.sanitized!,
    );
  }

  private async persistConversationContext(
    payload: SanitizedInboundMessage,
  ): Promise<InboundContext> {
    const client = this.redisService.getClient();
    const contextKey = `${this.keyPrefix}:context:${payload.contactKey}`;
    const messagesKey = `${this.keyPrefix}:messages:${payload.contactKey}`;

    const existing = await client.get(contextKey);
    const parsedExisting: InboundContext | null = existing
      ? (JSON.parse(existing) as InboundContext)
      : null;

    const context: InboundContext = {
      contactKey: payload.contactKey,
      channel: payload.channel,
      channelIdentity: payload.channelIdentity,
      messageCount: (parsedExisting?.messageCount || 0) + 1, // Incrementa contador acumulado.
      lastReceivedAt: payload.receivedAt,
      updatedAt: new Date().toISOString(),
    };

    const messageRecord: MessageRecord = {
      messageText: payload.messageText,
      receivedAt: payload.receivedAt,
      externalMessageId: payload.externalMessageId,
      metadata: payload.metadata,
    };

    await client
      .multi()
      .set(contextKey, JSON.stringify(context), { EX: this.contextTtlSeconds })
      .lPush(messagesKey, JSON.stringify(messageRecord)) // Agrega al inicio de la lista.
      .lTrim(messagesKey, 0, this.messageHistoryLimit - 1) // Mantiene solo los N más recientes.
      .expire(messagesKey, this.contextTtlSeconds)
      .exec();

    return context;
  }
}
