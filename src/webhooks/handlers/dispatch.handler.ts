import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ChannelIdentityType,
  ChannelType,
  CreateInboundMessageDto,
} from '../../inbound/dto/create-inbound-message.dto';
import { InboundService } from '../../inbound/inbound.service';
import { WebhookContext } from './webhook-context';
import { WebhookHandler } from './webhook-handler.interface';

// Tipos internos del payload de Meta WhatsApp Business.
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

// Handler 4 de la cadena (terminal).
// Parsea el payload de Meta, construye un CreateInboundMessageDto por cada mensaje de texto
// válido y delega al InboundService para su procesamiento downstream.
// Es el único punto donde se instancian CreateInboundMessageDto (flecha "crea" del diagrama).
export class DispatchHandler implements WebhookHandler {
  private readonly logger = new Logger(DispatchHandler.name);

  constructor(
    private readonly inboundService: InboundService,
    private readonly configService: ConfigService,
  ) {}

  // DispatchHandler es el último de la cadena; no necesita encadenar un siguiente.
  setNext(handler: WebhookHandler): WebhookHandler {
    return handler;
  }

  async handle(
    payload: Record<string, unknown>,
    context: WebhookContext,
  ): Promise<void> {
    if (context.stopped) return;

    const webhookPayload = payload as MetaWhatsappWebhookPayload;
    const inboundMessages = this.extractInboundMessages(webhookPayload);

    if (inboundMessages.length === 0) {
      this.logger.log(
        'Webhook de Meta WhatsApp recibido sin mensajes procesables',
      );
      context.result = {
        status: 'accepted_ignored',
        message:
          'Webhook recibido sin mensajes de texto entrantes para derivar',
        data: {
          object: webhookPayload.object ?? null,
          acceptedMessages: 0,
        },
      };
      return;
    }

    // Persiste los mensajes extraídos en el contexto para trazabilidad.
    context.extractedMessages = inboundMessages;

    const results = await Promise.all(
      inboundMessages.map((message) =>
        this.inboundService.receiveMessage(message),
      ),
    );

    context.result = {
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
          const normalized = this.mapMetaMessageToInbound(
            entry,
            change,
            message,
          );
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

  private parseMetaTimestamp(timestamp?: string): string | undefined {
    if (!timestamp) return undefined;
    const parsed = Number(timestamp);
    if (!Number.isFinite(parsed)) return undefined;
    return new Date(parsed * 1000).toISOString();
  }

  private normalizePhone(value: string): string {
    return value.replace(/\D/g, '');
  }

  private intFromConfig(key: string, fallback: number): number {
    const raw = this.configService.get<string>(key);
    const parsed = Number(raw);
    return Number.isInteger(parsed) ? parsed : fallback;
  }
}
