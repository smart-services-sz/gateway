import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { ConfigService } from '@nestjs/config';
import {
  ChannelIdentityType,
  ChannelType,
  CreateInboundMessageDto,
} from '../inbound/dto/create-inbound-message.dto';
import { InboundService } from '../inbound/inbound.service';

type MetaWhatsappWebhookPayload = {
  object?: string;
  entry?: MetaEntry[];
};

type MetaEntry = {
  id?: string;
  changes?: MetaChange[];
};

type MetaChange = {
  field?: string;
  value?: MetaChangeValue;
};

type MetaChangeValue = {
  messaging_product?: string;
  metadata?: {
    display_phone_number?: string;
    phone_number_id?: string;
  };
  contacts?: Array<{
    wa_id?: string;
    profile?: {
      name?: string;
    };
  }>;
  messages?: MetaMessage[];
};

type MetaMessage = {
  id?: string;
  from?: string;
  timestamp?: string;
  type?: string;
  text?: {
    body?: string;
  };
};

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly inboundService: InboundService,
  ) {}

  verifyMetaWhatsappWebhook(
    mode?: string,
    verifyToken?: string,
    challenge?: string,
  ): string {
    const configuredToken = this.getMetaWhatsappVerifyToken();

    if (!mode || !verifyToken || !challenge) {
      throw new BadRequestException(
        'Faltan parámetros hub.mode, hub.verify_token o hub.challenge',
      );
    }

    if (mode !== 'subscribe') {
      throw new ForbiddenException('Modo de verificación inválido');
    }

    if (!configuredToken) {
      throw new ForbiddenException(
        'META_WHATSAPP_WEBHOOK_VERIFY_TOKEN no está configurado',
      );
    }

    if (verifyToken !== configuredToken) {
      throw new ForbiddenException('Verify token inválido');
    }

    return challenge;
  }

  async receiveMetaWhatsappWebhook(
    payload: Record<string, unknown>,
    rawBody?: Buffer,
    signatureHeader?: string,
  ) {
    this.validateMetaWhatsappSignature(rawBody, signatureHeader);

    const webhookPayload = payload as MetaWhatsappWebhookPayload;
    const inboundMessages = this.extractInboundMessages(webhookPayload);

    if (inboundMessages.length === 0) {
      this.logger.log('Webhook de Meta WhatsApp recibido sin mensajes procesables');

      return {
        status: 'accepted_ignored',
        message: 'Webhook recibido sin mensajes de texto entrantes para derivar',
        data: {
          object: webhookPayload.object ?? null,
          acceptedMessages: 0,
        },
      };
    }

    const results = await Promise.all(
      inboundMessages.map((message) => this.inboundService.receiveMessage(message)),
    );

    return {
      status: 'accepted',
      message: 'Webhook recibido y derivado al inbound interno',
      data: {
        object: webhookPayload.object ?? null,
        acceptedMessages: inboundMessages.length,
        results,
      },
    };
  }

  private extractInboundMessages(
    payload: MetaWhatsappWebhookPayload,
  ): CreateInboundMessageDto[] {
    const inboundMessages: CreateInboundMessageDto[] = [];

    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        for (const message of change.value?.messages ?? []) {
          const normalized = this.mapMetaMessageToInbound(entry, change, message);

          if (normalized) {
            inboundMessages.push(normalized);
          }
        }
      }
    }

    return inboundMessages;
  }

  private mapMetaMessageToInbound(
    entry: MetaEntry,
    change: MetaChange,
    message: MetaMessage,
  ): CreateInboundMessageDto | null {
    const messageText = message.text?.body?.trim();
    const from = message.from?.trim();

    if (!messageText || !from) {
      return null;
    }

    if (message.type && message.type !== 'text') {
      return null;
    }

    const matchingContact = change.value?.contacts?.find(
      (contact) => contact.wa_id === from,
    );

    return {
      channel: ChannelType.WHATSAPP,
      channelIdentity: {
        type: ChannelIdentityType.PHONE,
        value: from,
        normalizedValue: this.normalizePhone(from),
      },
      externalMessageId: message.id,
      messageText,
      receivedAt: this.parseMetaTimestamp(message.timestamp),
      responseWindow: {
        debounceMs: this.intFromConfig(
          'META_WHATSAPP_RESPONSE_DEBOUNCE_MS',
          2500,
        ),
        delayMs: this.intFromConfig('META_WHATSAPP_RESPONSE_DELAY_MS', 300),
        maxAccumulationMs: this.intFromConfig(
          'META_WHATSAPP_RESPONSE_MAX_ACCUMULATION_MS',
          8000,
        ),
      },
      metadata: {
        webhookProvider: 'meta',
        webhookChannel: 'whatsapp',
        webhookObject: 'whatsapp_business_account',
        whatsappBusinessAccountId: entry.id,
        changeField: change.field,
        contactName: matchingContact?.profile?.name,
        phoneNumberId: change.value?.metadata?.phone_number_id,
        displayPhoneNumber: change.value?.metadata?.display_phone_number,
        messagingProduct: change.value?.messaging_product,
        rawMessageType: message.type,
      },
    };
  }

  private getMetaWhatsappVerifyToken(): string {
    return (
      this.configService.get<string>('META_WHATSAPP_WEBHOOK_VERIFY_TOKEN') ||
      this.configService.get<string>('WHATSAPP_WEBHOOK_VERIFY_TOKEN') ||
      ''
    );
  }

  private getMetaWhatsappAppSecret(): string {
    return (
      this.configService.get<string>('META_WHATSAPP_APP_SECRET') ||
      this.configService.get<string>('META_APP_SECRET') ||
      ''
    );
  }

  private validateMetaWhatsappSignature(
    rawBody?: Buffer,
    signatureHeader?: string,
  ): void {
    const appSecret = this.getMetaWhatsappAppSecret();

    if (!appSecret) {
      this.logger.warn(
        'META_WHATSAPP_APP_SECRET no está configurado; se omite validación X-Hub-Signature-256',
      );
      return;
    }

    if (!rawBody?.length) {
      throw new ForbiddenException(
        'No se pudo validar la firma del webhook: raw body ausente',
      );
    }

    if (!signatureHeader) {
      throw new ForbiddenException(
        'No se pudo validar la firma del webhook: header X-Hub-Signature-256 ausente',
      );
    }

    const expectedSignature = `sha256=${createHmac('sha256', appSecret)
      .update(rawBody)
      .digest('hex')}`;

    const providedSignatureBuffer = Buffer.from(signatureHeader, 'utf8');
    const expectedSignatureBuffer = Buffer.from(expectedSignature, 'utf8');

    if (
      providedSignatureBuffer.length !== expectedSignatureBuffer.length ||
      !timingSafeEqual(providedSignatureBuffer, expectedSignatureBuffer)
    ) {
      throw new ForbiddenException('Firma X-Hub-Signature-256 inválida');
    }
  }

  private parseMetaTimestamp(timestamp?: string): string | undefined {
    if (!timestamp) {
      return undefined;
    }

    const parsedTimestamp = Number(timestamp);
    if (!Number.isFinite(parsedTimestamp)) {
      return undefined;
    }

    return new Date(parsedTimestamp * 1000).toISOString();
  }

  private normalizePhone(value: string): string {
    return value.replace(/\D/g, '');
  }

  private intFromConfig(key: string, fallback: number): number {
    const rawValue = this.configService.get<string>(key);
    const parsedValue = Number(rawValue);

    return Number.isInteger(parsedValue) ? parsedValue : fallback;
  }
}