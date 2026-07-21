import { WebhookContext } from './webhook-context';

// Interfaz de la cadena de responsabilidad para el procesamiento de webhooks entrantes.
// Cada implementación concreta puede detener el flujo seteando context.stopped = true.
export interface WebhookHandler {
  setNext(handler: WebhookHandler): WebhookHandler;
  handle(
    payload: Record<string, unknown>,
    context: WebhookContext,
  ): Promise<void>;
}
