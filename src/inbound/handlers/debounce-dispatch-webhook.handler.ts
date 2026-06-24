import { AbstractWebhookHandler } from './abstract-webhook.handler';
import {
  SanitizedInboundMessage,
  WebhookProcessingContext,
} from './webhook-processing-context';

// Handler 4 (último) de la cadena.
// Gestiona el debounce por contactKey y programa el dispatch consolidado a ms-ai.
// Cada mensaje nuevo reinicia el timer. Si se supera maxAccumulationMs, despacha
// de inmediato para evitar que una conversación muy activa nunca se envíe.
// El dispatch real se delega a un callback (consolidateAndDispatch en InboundService)
// para mantener la lógica de NATS y Redis separada de este handler.
export class DebounceDispatchWebhookHandler extends AbstractWebhookHandler {
  private readonly timers = new Map<string, NodeJS.Timeout>();
  private readonly windowStartMs = new Map<string, number>();

  constructor(
    // Callback invocado cuando el debounce vence; realiza la consolidación y el envío a ms-ai.
    private readonly onDispatch: (
      contactKey: string,
      payload: SanitizedInboundMessage,
    ) => Promise<void>,
  ) {
    super();
  }

  protected async process(ctx: WebhookProcessingContext): Promise<void> {
    const sanitized = ctx.sanitized!;
    this.scheduleDebounce(sanitized);

    ctx.result = {
      status: 'accepted_buffered',
      message: 'Mensaje recibido, sanitizado y bufferizado en gateway',
      data: {
        contactKey: sanitized.contactKey,
        channel: sanitized.channel,
        channelIdentity: sanitized.channelIdentity,
        messageText: sanitized.messageText,
        receivedAt: sanitized.receivedAt,
        responseWindow: sanitized.responseWindow,
        context: ctx.persistedContext,
      },
    };
  }

  // Inicia o reinicia el timer de debounce para el contactKey dado.
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
      void this.onDispatch(contactKey, payload);
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
      void this.onDispatch(contactKey, payload);
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

  // Cancela todos los timers pendientes. Llamar desde InboundService.onModuleDestroy().
  destroy(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
    this.windowStartMs.clear();
  }
}
