import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom, timeout } from 'rxjs';
import {
  ChannelIdentityType,
  ChannelType,
  CreateInboundMessageDto,
} from './dto/create-inbound-message.dto';
import { RedisService } from '../redis/redis.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';

// Mensaje ya validado y normalizado, listo para ser procesado internamente.
type SanitizedInboundMessage = {
  channel: ChannelType;
  contactKey: string;
  channelIdentity: {
    type: ChannelIdentityType;
    value: string;
    normalizedValue: string;
  };
  externalMessageId?: string;
  messageText: string;
  receivedAt: string;
  responseWindow: {
    debounceMs: number;
    delayMs: number;
    maxAccumulationMs?: number;
  };
  metadata?: Record<string, unknown>;
};

// Registro individual de un mensaje almacenado en el buffer Redis antes del dispatch.
type MessageRecord = {
  messageText: string;
  receivedAt: string;
  externalMessageId?: string;
  metadata?: Record<string, unknown>;
};

// Estado de conversación del contacto en Redis: cuántos mensajes lleva y cuándo fue el último.
type InboundContext = {
  contactKey: string;
  channel: ChannelType;
  channelIdentity: SanitizedInboundMessage['channelIdentity'];
  messageCount: number;
  lastReceivedAt: string;
  updatedAt: string;
};

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
  private readonly idempotencyTtlSeconds: number;  // TTL para claves de idempotencia (default: 24h).
  private readonly contextTtlSeconds: number;       // TTL para contexto y buffer de mensajes (default: 24h).
  private readonly messageHistoryLimit: number;     // Máximo de mensajes a mantener en el buffer Redis.
  private readonly minDebounceMsDefault: number;    // Debounce mínimo para canales genéricos.
  private readonly minDebounceMsWhatsapp: number;   // Debounce mínimo específico para WhatsApp (más largo).
  private readonly timers = new Map<string, NodeJS.Timeout>(); // Timers de debounce activos por contactKey.
  private readonly windowStartMs = new Map<string, number>();  // Timestamp de inicio de ventana de acumulación.

  constructor(
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
    private readonly whatsappService: WhatsappService,
    @Inject('NATS_CLIENT') private readonly natsClient: ClientProxy,
  ) {
    this.idempotencyTtlSeconds = this.intFromConfig(
      'INBOUND_IDEMPOTENCY_TTL_SECONDS',
      86400,
    );
    this.contextTtlSeconds = this.intFromConfig(
      'INBOUND_CONTEXT_TTL_SECONDS',
      86400,
    );
    this.messageHistoryLimit = this.intFromConfig(
      'INBOUND_MESSAGE_HISTORY_LIMIT',
      20,
    );
    this.minDebounceMsDefault = this.intFromConfig('INBOUND_MIN_DEBOUNCE_MS', 800);
    this.minDebounceMsWhatsapp = this.intFromConfig(
      'INBOUND_MIN_DEBOUNCE_WHATSAPP_MS',
      2000,
    );
  }

  // Al destruir el módulo, cancela todos los timers pendientes para evitar callbacks huérfanos.
  onModuleDestroy(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
    this.windowStartMs.clear();
  }

  // Punto de entrada principal. Recibe el DTO del controller, normaliza el payload,
  // verifica idempotencia, persiste en el buffer y programa el debounce.
  async receiveMessage(payload: CreateInboundMessageDto) {
    const sanitized = this.sanitizePayload(payload);
    const isDuplicate = await this.isDuplicateMessage(sanitized);

    // Si el externalMessageId ya fue procesado, se descarta sin reenviar a ms-ai.
    if (isDuplicate) {
      return {
        status: 'accepted_duplicate',
        message: 'Mensaje duplicado detectado, no se reprocesa',
        data: {
          contactKey: sanitized.contactKey,
          externalMessageId: sanitized.externalMessageId,
        },
      };
    }

    const context = await this.persistConversationContext(sanitized);
    this.scheduleDebounce(sanitized); // Inicia o reinicia el timer de debounce.

    return {
      status: 'accepted_buffered',
      message: 'Mensaje recibido, sanitizado y bufferizado en gateway',
      data: {
        contactKey: sanitized.contactKey,
        channel: sanitized.channel,
        channelIdentity: sanitized.channelIdentity,
        messageText: sanitized.messageText,
        receivedAt: sanitized.receivedAt,
        responseWindow: sanitized.responseWindow,
        context,
      },
    };
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

  // Gestiona el debounce por contactKey.
  // Cada mensaje nuevo reinicia el timer. Si se supera maxAccumulationMs, despacha inmediatamente
  // sin esperar más mensajes (evita que una conversación muy activa nunca se envíe).
  private scheduleDebounce(payload: SanitizedInboundMessage): void {
    const { contactKey, responseWindow } = payload;
    const { debounceMs, maxAccumulationMs } = responseWindow;
    const now = Date.now();

    if (!this.windowStartMs.has(contactKey)) {
      this.windowStartMs.set(contactKey, now); // Primer mensaje: inicia la ventana.
    }

    const windowStart = this.windowStartMs.get(contactKey)!;
    const elapsed = now - windowStart;

    // Si ya se consumió toda la ventana de acumulación, despacha de inmediato.
    if (maxAccumulationMs !== undefined && elapsed >= maxAccumulationMs) {
      this.clearTimer(contactKey);
      this.windowStartMs.delete(contactKey);
      void this.consolidateAndDispatch(contactKey, payload);
      return;
    }

    // El delay efectivo es el mínimo entre debounceMs y el tiempo restante de la ventana.
    let delay = debounceMs;
    if (maxAccumulationMs !== undefined) {
      const remaining = maxAccumulationMs - elapsed;
      delay = Math.min(debounceMs, remaining);
    }

    // Cancela el timer anterior y crea uno nuevo (patrón debounce clásico).
    this.clearTimer(contactKey);
    const timer = setTimeout(() => {
      this.timers.delete(contactKey);
      this.windowStartMs.delete(contactKey);
      void this.consolidateAndDispatch(contactKey, payload);
    }, delay);
    this.timers.set(contactKey, timer);
  }

  private clearTimer(contactKey: string): void {
    const existing = this.timers.get(contactKey);
    if (existing) {
      clearTimeout(existing);
      this.timers.delete(contactKey);
    }
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
        `[${aiPayload.correlationId}] Respuesta de ms-ai recibida | contactKey=${contactKey}`,
      );
      this.logger.debug(
        `[${aiPayload.correlationId}] ms-ai response: ${JSON.stringify(response)}`,
      );

      await this.emitChannelResponse(aiPayload, response);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);

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
        `[${aiPayload.correlationId}] Error al enviar a ms-ai | contactKey=${contactKey} | error=${message}`,
      );
    }

    this.logger.log(
      `[${aiPayload.correlationId}] Lote consolidado despachado a ms-ai | contactKey=${contactKey} | mensajes=${messages.length}`,
    );
  }

  // Verifica idempotencia usando SET NX (solo si no existe).
  // Si la clave ya existe en Redis, el mensaje ya fue procesado → es duplicado.
  // La clave incluye canal + externalMessageId para evitar colisiones entre canales.
  private async isDuplicateMessage(
    payload: SanitizedInboundMessage,
  ): Promise<boolean> {
    if (!payload.externalMessageId) {
      return false; // Sin ID externo no podemos garantizar idempotencia; se procesa igual.
    }

    const key = this.idempotencyKey(payload.channel, payload.externalMessageId);
    const client = this.redisService.getClient();
    const wasSet = await client.set(key, payload.receivedAt, {
      NX: true,          // Solo escribe si la clave no existe.
      EX: this.idempotencyTtlSeconds,
    });

    return wasSet !== 'OK'; // 'OK' = se escribió ahora (primer vez); null = ya existía (duplicado).
  }

  // Actualiza el contexto del contacto y agrega el mensaje al buffer Redis.
  // Usa lPush + lTrim para mantener el buffer acotado a messageHistoryLimit.
  // Todo en una transacción atómica para consistencia.
  private async persistConversationContext(
    payload: SanitizedInboundMessage,
  ): Promise<InboundContext> {
    const client = this.redisService.getClient();
    const contextKey = this.contextKey(payload.contactKey);
    const messagesKey = this.messagesKey(payload.contactKey);

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
      .set(contextKey, JSON.stringify(context), {
        EX: this.contextTtlSeconds,
      })
      .lPush(messagesKey, JSON.stringify(messageRecord))    // Agrega al inicio de la lista.
      .lTrim(messagesKey, 0, this.messageHistoryLimit - 1)  // Mantiene solo los N más recientes.
      .expire(messagesKey, this.contextTtlSeconds)
      .exec();

    return context;
  }

  // Normaliza y valida el payload crudo del canal:
  // - Elimina espacios extra en textos
  // - Aplica el debounce mínimo según canal
  // - Construye el contactKey canónico (channel:identityType:normalizedValue)
  private sanitizePayload(payload: CreateInboundMessageDto): SanitizedInboundMessage {
    const identityValue = this.normalizeWhitespace(payload.channelIdentity.value);

    const identityNormalized =
      payload.channelIdentity.normalizedValue?.trim() ||
      this.normalizeIdentity(payload.channelIdentity.type, identityValue);

    const sanitizedIdentity = {
      type: payload.channelIdentity.type,
      value: identityValue,
      normalizedValue: identityNormalized,
    };

    const responseWindow = {
      debounceMs: Math.max(
        this.clampInt(payload.responseWindow.debounceMs, 0, 60000),
        this.getMinDebounceMsByChannel(payload.channel),
      ),
      delayMs: this.clampInt(payload.responseWindow.delayMs, 0, 60000),
      maxAccumulationMs:
        payload.responseWindow.maxAccumulationMs === undefined
          ? undefined
          : this.clampInt(payload.responseWindow.maxAccumulationMs, 0, 120000),
    };

    return {
      channel: payload.channel,
      contactKey: this.buildContactKey(
        payload.channel,
        payload.channelIdentity.type,
        sanitizedIdentity.normalizedValue,
      ),
      channelIdentity: sanitizedIdentity,
      externalMessageId: payload.externalMessageId
        ? this.normalizeWhitespace(payload.externalMessageId)
        : undefined,
      messageText: this.normalizeWhitespace(payload.messageText),
      receivedAt: payload.receivedAt || new Date().toISOString(),
      responseWindow,
      metadata: this.sanitizeMetadata(payload.metadata),
    };
  }

  // WhatsApp tiene debounce más largo porque los usuarios suelen enviar varios mensajes cortos seguidos.
  private getMinDebounceMsByChannel(channel: ChannelType): number {
    if (channel === ChannelType.WHATSAPP) {
      return this.minDebounceMsWhatsapp;
    }

    return this.minDebounceMsDefault;
  }

  // Normaliza el identificador según su tipo:
  // PHONE → solo dígitos (elimina +, espacios, guiones)
  // EMAIL → minúsculas sin espacios
  // Otros → normalización de espacios
  private normalizeIdentity(type: ChannelIdentityType, value: string): string {
    if (type === ChannelIdentityType.PHONE) {
      return value.replace(/\D/g, '');
    }

    if (type === ChannelIdentityType.EMAIL) {
      return value.trim().toLowerCase();
    }

    return this.normalizeWhitespace(value);
  }

  private buildContactKey(
    channel: ChannelType,
    identityType: ChannelIdentityType,
    normalizedValue: string,
  ): string {
    return `${channel}:${identityType}:${normalizedValue}`;
  }

  private normalizeWhitespace(value: string): string {
    return value.trim().replace(/\s+/g, ' ');
  }

  private clampInt(value: number, min: number, max: number): number {
    return Math.min(Math.max(Math.trunc(value), min), max);
  }

  private sanitizeMetadata(
    metadata?: Record<string, unknown>,
  ): Record<string, unknown> | undefined {
    if (!metadata) {
      return undefined;
    }

    return Object.entries(metadata).reduce<Record<string, unknown>>(
      (acc, [key, value]) => {
        const sanitizedKey = this.normalizeWhitespace(key);

        if (typeof value === 'string') {
          acc[sanitizedKey] = this.normalizeWhitespace(value);
          return acc;
        }

        if (Array.isArray(value)) {
          acc[sanitizedKey] = value.map((item) =>
            typeof item === 'string' ? this.normalizeWhitespace(item) : item,
          );
          return acc;
        }

        acc[sanitizedKey] = value;
        return acc;
      },
      {},
    );
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

  private idempotencyKey(channel: string, externalMessageId: string): string {
    return `${this.keyPrefix}:idempotency:${channel}:${externalMessageId}`;
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
        `[CHANNEL-OUT][${payload.channel}] to=${payload.contactKey} status=${status || 'n/a'} message="${assistantMessage}"`,
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
        `[${correlationId}] No se pudo extraer el phone del contactKey=${contactKey}`,
      );
      return;
    }

    // Obtiene phoneNumberId del metadata (viene del webhook de Meta)
    const phoneNumberId = metadata?.phoneNumberId;

    if (!phoneNumberId || typeof phoneNumberId !== 'string') {
      this.logger.error(
        `[${correlationId}] No hay phoneNumberId en metadata para contactKey=${contactKey}`,
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
        `[${correlationId}] [CHANNEL-OUT][whatsapp] to=${contactKey} messageId=${messageId} | SUCCESS`,
      );
    } else {
      this.logger.error(
        `[${correlationId}] [CHANNEL-OUT][whatsapp] to=${contactKey} | FAILED`,
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