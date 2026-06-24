import {
  ChannelIdentityType,
  ChannelType,
  CreateInboundMessageDto,
} from '../dto/create-inbound-message.dto';
import { AbstractWebhookHandler } from './abstract-webhook.handler';
import {
  SanitizedInboundMessage,
  WebhookProcessingContext,
} from './webhook-processing-context';

// Handler 1 de la cadena.
// Normaliza el DTO crudo del canal en un SanitizedInboundMessage:
// - Elimina espacios extra en todos los strings.
// - Aplica el debounce mínimo según canal (WhatsApp tiene un mínimo más alto).
// - Construye el contactKey canónico (channel:identityType:normalizedValue).
// - Aplica sanitización recursiva al campo metadata.
export class SanitizeWebhookHandler extends AbstractWebhookHandler {
  constructor(
    private readonly minDebounceMsDefault: number,
    private readonly minDebounceMsWhatsapp: number,
  ) {
    super();
  }

  protected async process(ctx: WebhookProcessingContext): Promise<void> {
    ctx.sanitized = this.sanitizePayload(ctx.raw);
  }

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
    return channel === ChannelType.WHATSAPP
      ? this.minDebounceMsWhatsapp
      : this.minDebounceMsDefault;
  }

  // PHONE → solo dígitos; EMAIL → minúsculas; otros → normalización de espacios.
  private normalizeIdentity(type: ChannelIdentityType, value: string): string {
    if (type === ChannelIdentityType.PHONE) return value.replace(/\D/g, '');
    if (type === ChannelIdentityType.EMAIL) return value.trim().toLowerCase();
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
    if (!metadata) return undefined;

    return Object.entries(metadata).reduce<Record<string, unknown>>(
      (acc, [key, value]) => {
        const sanitizedKey = this.normalizeWhitespace(key);

        if (typeof value === 'string') {
          acc[sanitizedKey] = this.normalizeWhitespace(value);
        } else if (Array.isArray(value)) {
          acc[sanitizedKey] = value.map((item) =>
            typeof item === 'string' ? this.normalizeWhitespace(item) : item,
          );
        } else {
          acc[sanitizedKey] = value;
        }

        return acc;
      },
      {},
    );
  }
}
