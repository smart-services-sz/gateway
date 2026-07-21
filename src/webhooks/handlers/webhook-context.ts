import { CreateInboundMessageDto } from '../../inbound/dto/create-inbound-message.dto';

// Contexto mutable que fluye a través de la cadena de responsabilidad del webhook.
// Cada handler lo lee y/o enriquece; si alguno setea stopped = true el flujo se corta.
export type WebhookContext = {
  rawBody?: Buffer; // Cuerpo HTTP crudo para validación de firma HMAC (X-Hub-Signature-256).
  signatureHeader?: string; // Valor del header X-Hub-Signature-256 enviado por Meta.
  stopped: boolean; // true si un handler cortó el flujo (duplicado, rate limit, etc.).
  extractedMessages: CreateInboundMessageDto[]; // Mensajes construidos por DispatchHandler.
  result?: object; // Respuesta final que se retorna al controller.
};
