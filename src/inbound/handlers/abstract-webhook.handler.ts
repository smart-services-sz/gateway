import { WebhookProcessingContext } from './webhook-processing-context';

// Clase base de la cadena de responsabilidad para el procesamiento de webhooks.
// Cada handler concreto implementa `process()` y puede detener el flujo seteando
// ctx.stopProcessing = true antes de retornar.
export abstract class AbstractWebhookHandler {
  private next?: AbstractWebhookHandler;

  // Encadena el siguiente handler y lo retorna para fluent chaining:
  //   sanitize.setNext(idempotency).setNext(persist).setNext(debounce)
  setNext(handler: AbstractWebhookHandler): AbstractWebhookHandler {
    this.next = handler;
    return handler;
  }

  // Ejecuta este handler y, si el flujo no fue detenido, pasa el contexto al siguiente.
  async handle(ctx: WebhookProcessingContext): Promise<WebhookProcessingContext> {
    if (ctx.stopProcessing) return ctx;
    await this.process(ctx);
    if (!ctx.stopProcessing && this.next) {
      return this.next.handle(ctx);
    }
    return ctx;
  }

  protected abstract process(ctx: WebhookProcessingContext): Promise<void>;
}
