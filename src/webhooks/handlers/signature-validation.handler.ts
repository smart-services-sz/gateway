import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import { WebhookContext } from './webhook-context';
import { WebhookHandler } from './webhook-handler.interface';

// Handler 1 de la cadena.
// Valida la firma HMAC-SHA256 del header X-Hub-Signature-256 usando el app secret de Meta.
// Si la firma es inválida lanza ForbiddenException y el flujo se corta antes de procesar
// ningún dato del payload.
// Si META_WHATSAPP_APP_SECRET no está configurado, solo emite un warning y continúa.
export class SignatureValidationHandler implements WebhookHandler {
  private next?: WebhookHandler;

  constructor(private readonly configService: ConfigService) {}

  setNext(handler: WebhookHandler): WebhookHandler {
    this.next = handler;
    return handler;
  }

  async handle(payload: Record<string, unknown>, context: WebhookContext): Promise<void> {
    if (context.stopped) return;

    this.validateSignature(context.rawBody, context.signatureHeader);

    if (this.next) await this.next.handle(payload, context);
  }

  // Verifica que el hash HMAC-SHA256(rawBody, appSecret) coincida con el header.
  // Usa timingSafeEqual para prevenir timing attacks.
  private validateSignature(rawBody?: Buffer, signatureHeader?: string): void {
    const appSecret = this.getAppSecret();

    if (!appSecret) {
      // Sin secret configurado no se puede validar; se permite con warning.
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

    const provided = Buffer.from(signatureHeader, 'utf8');
    const expected = Buffer.from(expectedSignature, 'utf8');

    if (
      provided.length !== expected.length ||
      !timingSafeEqual(provided, expected)
    ) {
      throw new ForbiddenException('Firma X-Hub-Signature-256 inválida');
    }
  }

  private getAppSecret(): string {
    return (
      this.configService.get<string>('META_WHATSAPP_APP_SECRET') ||
      this.configService.get<string>('META_APP_SECRET') ||
      ''
    );
  }
}
