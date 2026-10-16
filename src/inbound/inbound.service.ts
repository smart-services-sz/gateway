import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom, timeout } from 'rxjs';
import {
  ChannelType,
  CreateInboundMessageDto,
} from './dto/create-inbound-message.dto';
import { RedisService } from '../redis/redis.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { AbstractWebhookHandler } from './handlers/abstract-webhook.handler';
import { SanitizeWebhookHandler } from './handlers/sanitize-webhook.handler';
import { IdempotencyWebhookHandler } from './handlers/idempotency-webhook.handler';
import { PersistContextWebhookHandler } from './handlers/persist-context-webhook.handler';
import { DebounceDispatchWebhookHandler } from './handlers/debounce-dispatch-webhook.handler';
import {
  InboundContext,
  MessageRecord,
  SanitizedInboundMessage,
  WebhookProcessingContext,
} from './handlers/webhook-processing-context';

// Resultado del request/reply a ms-ai; se persiste en Redis para consulta de diagnóstico.
type AiDispatchResult = {
  correlationId: string;
  contactKey: string;
  status: 'success' | 'error';
  response?: unknown;
  error?: string;
  dispatchedAt: string;
};

// Mensaje de respuesta emitido hacia el canal del ciudadano (WhatsApp, Web, etc.).
type OutboundChannelMessage = {
  correlationId: string;
  contactKey: string;
  channel: ChannelType;
  status?: string;
  assistantMessage: string;
  emittedAt: string;
};

// Payload consolidado que se envía a ms-ai via NATS (tópico: ai.process-inbound-message).
// Agrupa todos los mensajes acumulados durante el debounce en un único lote.
export type AiInboundPayload = {
  correlationId: string;
  contactKey: string;
  channel: ChannelType;
  channelIdentity: SanitizedInboundMessage['channelIdentity'];
  consolidatedText: string;
  messageCount: number;
  messages: MessageRecord[];
  firstReceivedAt: string;
  lastReceivedAt: string;
  metadata?: Record<string, unknown>;
};

@Injectable()
export class InboundService implements OnModuleDestroy {
  private readonly logger = new Logger(InboundService.name);
  private readonly keyPrefix = 'gateway:inbound'; // Prefijo de todas las claves Redis de este servicio.
  private readonly contextTtlSeconds: number; // TTL para contexto y buffer de mensajes (default: 24h).

  // Cabeza de la cadena de responsabilidad: Sanitize → Idempotency → PersistContext → DebounceDispatch.
  private readonly processingChain: AbstractWebhookHandler;
  // Referencia directa al último handler para poder llamar destroy() en onModuleDestroy.
  private readonly debounceHandler: DebounceDispatchWebhookHandler;

  constructor(
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
    private readonly whatsappService: WhatsappService,
    @Inject('NATS_CLIENT') private readonly natsClient: ClientProxy,
  ) {
    this.contextTtlSeconds = this.intFromConfig(
      'INBOUND_CONTEXT_TTL_SECONDS',
      86400,
    );

    // Construye la cadena de responsabilidad una sola vez en el constructor.
    const sanitize = new SanitizeWebhookHandler(
      this.intFromConfig('INBOUND_MIN_DEBOUNCE_MS', 800),
      this.intFromConfig('INBOUND_MIN_DEBOUNCE_WHATSAPP_MS', 2000),
    );
    const idempotency = new IdempotencyWebhookHandler(
      redisService,
      this.intFromConfig('INBOUND_IDEMPOTENCY_TTL_SECONDS', 86400),
      this.keyPrefix,
    );
    const persistCtx = new PersistContextWebhookHandler(
      redisService,
      this.contextTtlSeconds,
      this.intFromConfig('INBOUND_MESSAGE_HISTORY_LIMIT', 20),
      this.keyPrefix,
    );
    this.debounceHandler = new DebounceDispatchWebhookHandler(
      (contactKey, payload) => this.consolidateAndDispatch(contactKey, payload),
    );

    // Encadena los handlers con fluent API: setNext retorna el handler recibido.
    sanitize
      .setNext(idempotency)
      .setNext(persistCtx)
      .setNext(this.debounceHandler);
    this.processingChain = sanitize;
  }

  // Al destruir el módulo, cancela todos los timers pendientes para evitar callbacks huérfanos.
  onModuleDestroy(): void {
    this.debounceHandler.destroy();
  }

  // Punto de entrada principal. Crea el WebhookProcessingContext y lo pasa al inicio de la cadena.
  // El contexto se enriquece en cada handler; el resultado final está en ctx.result.
  async receiveMessage(payload: CreateInboundMessageDto) {
    const ctx: WebhookProcessingContext = {
      raw: payload,
      isDuplicate: false,
      stopProcessing: false,
    };
    const result = await this.processingChain.handle(ctx);
    return result.result;
  }

  async getContext(contactKey: string) {
    const client = this.redisService.getClient();
    const [
      contextRaw,
      messagesRaw,
      dispatchRaw,
      dispatchResultRaw,
      outboundRaw,
    ] = await Promise.all([
      client.get(this.contextKey(contactKey)),
      client.lRange(this.messagesKey(contactKey), 0, -1),
      client.get(this.dispatchKey(contactKey)),
      client.get(this.dispatchResultKey(contactKey)),
      client.get(this.outboundMessageKey(contactKey)),
    ]);

    if (!contextRaw) {
      return null;
    }

    const messages = messagesRaw
      .map((m) => JSON.parse(m) as MessageRecord)
      .reverse()
      .sort((a, b) => a.receivedAt.localeCompare(b.receivedAt));

    return {
      context: JSON.parse(contextRaw) as InboundContext,
      bufferedMessages: messages,
      pendingDispatch: dispatchRaw
        ? (JSON.parse(dispatchRaw) as AiInboundPayload)
        : null,
      lastDispatchResult: dispatchResultRaw
        ? (JSON.parse(dispatchResultRaw) as AiDispatchResult)
        : null,
      lastOutboundMessage: outboundRaw
        ? (JSON.parse(outboundRaw) as OutboundChannelMessage)
        : null,
    };
  }

  // Lee todos los mensajes acumulados en Redis, los ordena cronológicamente y
  // construye un único payload que se envía a ms-ai vía NATS (request/reply).
  // Limpia el buffer de mensajes atómicamente antes del envío.
  private async consolidateAndDispatch(
    contactKey: string,
    lastPayload: SanitizedInboundMessage,
  ): Promise<void> {
    const client = this.redisService.getClient();
    const [messagesRaw, contextRaw] = await Promise.all([
      client.lRange(this.messagesKey(contactKey), 0, -1),
      client.get(this.contextKey(contactKey)),
    ]);

    if (!messagesRaw.length) {
      return; // Buffer vacío: no hay nada que despachar.
    }

    const messages = messagesRaw
      .map((m) => JSON.parse(m) as MessageRecord)
      .reverse()
      .sort((a, b) => a.receivedAt.localeCompare(b.receivedAt));

    const context = contextRaw
      ? (JSON.parse(contextRaw) as InboundContext)
      : null;

    const aiPayload: AiInboundPayload = {
      correlationId: crypto.randomUUID(),
      contactKey,
      channel: context?.channel ?? lastPayload.channel,
      channelIdentity: context?.channelIdentity ?? lastPayload.channelIdentity,
      consolidatedText: messages.map((m) => m.messageText).join('\n'),
      messageCount: messages.length,
      messages,
      firstReceivedAt: messages[0].receivedAt,
      lastReceivedAt: messages[messages.length - 1].receivedAt,
      metadata: lastPayload.metadata,
    };

    // Transacción atómica: guarda el payload y limpia el buffer en un solo comando.
    await client
      .multi()
      .set(this.dispatchKey(contactKey), JSON.stringify(aiPayload), {
        EX: this.contextTtlSeconds,
      })
      .del(this.messagesKey(contactKey))
      .exec();

    let dispatchStatus: 'success' | 'error' = 'success';

    try {
      // Envía el lote a ms-ai y espera la respuesta (timeout: 10s).
      const response = await firstValueFrom(
        this.natsClient
          .send('ai.process-inbound-message', aiPayload)
          .pipe(timeout(10000)),
      );

      const dispatchResult: AiDispatchResult = {
        correlationId: aiPayload.correlationId,
        contactKey,
        status: 'success',
        response,
        dispatchedAt: new Date().toISOString(),
      };

      await client.set(
        this.dispatchResultKey(contactKey),
        JSON.stringify(dispatchResult),
        { EX: this.contextTtlSeconds },
      );

      this.logger.log(
        `[${aiPayload.correlationId}] Respuesta de ms-ai recibida | status=${this.extractStatus(response) || 'n/a'}`,
      );

      await this.emitChannelResponse(aiPayload, response);
    } catch (error: unknown) {
      dispatchStatus = 'error';
      const message = this.stringifyError(error);

      const dispatchResult: AiDispatchResult = {
        correlationId: aiPayload.correlationId,
        contactKey,
        status: 'error',
        error: message,
        dispatchedAt: new Date().toISOString(),
      };

      await client.set(
        this.dispatchResultKey(contactKey),
        JSON.stringify(dispatchResult),
        { EX: this.contextTtlSeconds },
      );

      this.logger.error(
        `[${aiPayload.correlationId}] Error al enviar a ms-ai | error=${error instanceof Error ? error.name : 'UnknownError'}`,
      );
    }

    if (dispatchStatus === 'success') {
      this.logger.log(
        `[${aiPayload.correlationId}] Lote consolidado despachado a ms-ai | channel=${aiPayload.channel} | mensajes=${messages.length}`,
      );
    } else {
      this.logger.warn(
        `[${aiPayload.correlationId}] Lote consolidado con error en ms-ai | channel=${aiPayload.channel} | mensajes=${messages.length}`,
      );
    }
  }

  private stringifyError(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    if (typeof error === 'string') {
      return error;
    }

    if (error && typeof error === 'object') {
      const asRecord = error as Record<string, unknown>;

      const response = asRecord.response;
      if (typeof response === 'string') {
        return response;
      }

      if (response && typeof response === 'object') {
        const responseRecord = response as Record<string, unknown>;
        const nestedMessage = responseRecord.message;

        if (typeof nestedMessage === 'string') {
          return nestedMessage;
        }

        if (Array.isArray(nestedMessage)) {
          return nestedMessage.map((item) => String(item)).join(', ');
        }
      }

      const topMessage = asRecord.message;
      if (typeof topMessage === 'string') {
        return topMessage;
      }

      try {
        return JSON.stringify(error);
      } catch {
        return String(error);
      }
    }

    return String(error);
  }

  private dispatchKey(contactKey: string): string {
    return `${this.keyPrefix}:dispatch:${contactKey}`;
  }

  private dispatchResultKey(contactKey: string): string {
    return `${this.keyPrefix}:dispatch-result:${contactKey}`;
  }

  private outboundMessageKey(contactKey: string): string {
    return `${this.keyPrefix}:outbound:${contactKey}`;
  }

  private contextKey(contactKey: string): string {
    return `${this.keyPrefix}:context:${contactKey}`;
  }

  private messagesKey(contactKey: string): string {
    return `${this.keyPrefix}:messages:${contactKey}`;
  }

  private intFromConfig(key: string, fallback: number): number {
    const raw = this.configService.get<string>(key);
    const parsed = raw ? Number(raw) : NaN;

    if (Number.isNaN(parsed)) {
      return fallback;
    }

    return Math.max(Math.trunc(parsed), 1);
  }

  // Procesa la respuesta de ms-ai y la "emite" al canal de origen del ciudadano.
  // Para WhatsApp: envía vía API de Meta WhatsApp Business.
  // Persiste en Redis para trazabilidad y diagnóstico.
  private async emitChannelResponse(
    payload: AiInboundPayload,
    response: unknown,
  ): Promise<void> {
    const assistantMessage = this.extractAssistantMessage(response);

    if (!assistantMessage) {
      this.logger.warn(
        `[${payload.correlationId}] ms-ai respondio sin assistantMessage, no se emite salida de canal`,
      );
      return;
    }

    const status = this.extractStatus(response);
    const outboundMessage: OutboundChannelMessage = {
      correlationId: payload.correlationId,
      contactKey: payload.contactKey,
      channel: payload.channel,
      status,
      assistantMessage,
      emittedAt: new Date().toISOString(),
    };

    // Persiste el último mensaje saliente en Redis para trazabilidad / consulta de diagnóstico.
    await this.redisService
      .getClient()
      .set(
        this.outboundMessageKey(payload.contactKey),
        JSON.stringify(outboundMessage),
        { EX: this.contextTtlSeconds },
      );

    // Envía el mensaje según el canal.
    if (payload.channel === ChannelType.WHATSAPP) {
      await this.sendWhatsappMessage(
        payload.correlationId,
        payload.contactKey,
        assistantMessage,
        payload.metadata,
      );
    } else {
      // Para otros canales, solo loguea.
      this.logger.log(
        `[${payload.correlationId}] [CHANNEL-OUT] | channel=${payload.channel} | status=${status || 'n/a'} | recipient=[REDACTED] | content=[REDACTED]`,
      );
    }
  }

  // Envía un mensaje por WhatsApp usando la API de Meta.
  // Extrae el phone del contactKey y obtiene phoneNumberId del metadata.
  private async sendWhatsappMessage(
    correlationId: string,
    contactKey: string,
    assistantMessage: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    // Extrae el phone del contactKey (formato: whatsapp:phone:5493413538664)
    const parts = contactKey.split(':');
    const recipientPhone = parts[2];

    if (!recipientPhone) {
      this.logger.error(
        `[${correlationId}] No se pudo resolver el destinatario | channel=whatsapp`,
      );
      return;
    }

    // Obtiene phoneNumberId del metadata (viene del webhook de Meta)
    const phoneNumberId = metadata?.phoneNumberId;

    if (!phoneNumberId || typeof phoneNumberId !== 'string') {
      this.logger.error(
        `[${correlationId}] No hay phoneNumberId en metadata | channel=whatsapp`,
      );
      return;
    }

    const messageId = await this.whatsappService.sendTextMessage({
      phoneNumberId,
      recipientPhone,
      message: assistantMessage,
    });

    if (messageId) {
      this.logger.log(
        `[${correlationId}] [CHANNEL-OUT] | channel=whatsapp | providerMessageId=${Boolean(messageId)} | SUCCESS`,
      );
    } else {
      this.logger.error(
        `[${correlationId}] [CHANNEL-OUT] | channel=whatsapp | FAILED`,
      );
    }
  }

  private extractAssistantMessage(response: unknown): string | undefined {
    if (!response || typeof response !== 'object') {
      return undefined;
    }

    const value = (response as Record<string, unknown>).assistantMessage;
    return typeof value === 'string' ? value : undefined;
  }

  private extractStatus(response: unknown): string | undefined {
    if (!response || typeof response !== 'object') {
      return undefined;
    }

    const value = (response as Record<string, unknown>).status;
    return typeof value === 'string' ? value : undefined;
  }
}
