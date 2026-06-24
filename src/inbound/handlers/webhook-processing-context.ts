import {
  ChannelIdentityType,
  ChannelType,
  CreateInboundMessageDto,
} from '../dto/create-inbound-message.dto';

// Mensaje ya validado y normalizado, listo para ser procesado internamente.
export type SanitizedInboundMessage = {
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

// Estado de conversación del contacto en Redis: cuántos mensajes lleva y cuándo fue el último.
export type InboundContext = {
  contactKey: string;
  channel: ChannelType;
  channelIdentity: SanitizedInboundMessage['channelIdentity'];
  messageCount: number;
  lastReceivedAt: string;
  updatedAt: string;
};

// Registro individual de un mensaje almacenado en el buffer Redis antes del dispatch.
export type MessageRecord = {
  messageText: string;
  receivedAt: string;
  externalMessageId?: string;
  metadata?: Record<string, unknown>;
};

// Contexto mutable que fluye por la cadena de responsabilidad.
// Cada handler lo enriquece o detiene el flujo seteando stopProcessing = true.
export type WebhookProcessingContext = {
  raw: CreateInboundMessageDto;
  sanitized?: SanitizedInboundMessage;
  isDuplicate: boolean;
  persistedContext?: InboundContext;
  stopProcessing: boolean;
  result?: object;
};
