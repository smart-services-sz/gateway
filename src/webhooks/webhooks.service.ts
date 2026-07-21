import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InboundService } from '../inbound/inbound.service';
import { RedisService } from '../redis/redis.service';
import { DispatchHandler } from './handlers/dispatch.handler';
import { DuplicateMessageHandler } from './handlers/duplicate-message.handler';
import { RateLimitHandler } from './handlers/rate-limit.handler';
import { SignatureValidationHandler } from './handlers/signature-validation.handler';
import { WebhookContext } from './handlers/webhook-context';
import { WebhookHandler } from './handlers/webhook-handler.interface';

// Prefijo de clave Redis compartido entre todos los handlers del webhook.
const WEBHOOK_KEY_PREFIX = 'gateway:webhook';

@Injectable()
export class WebhooksService {
  private readonly webhookChain: WebhookHandler;

  constructor(
    private readonly configService: ConfigService,
    private readonly inboundService: InboundService,
    private readonly redisService: RedisService,
  ) {
    // Construcción de la cadena de responsabilidad según el diagrama de clases:
    // SignatureValidationHandler → DuplicateMessageHandler → RateLimitHandler → DispatchHandler
    const signatureHandler = new SignatureValidationHandler(configService);
    const duplicateHandler = new DuplicateMessageHandler(
      redisService,
      WEBHOOK_KEY_PREFIX,
      this.intFromConfig('WEBHOOK_DEDUP_TTL_SECONDS', 3600),
    );
    const rateLimitHandler = new RateLimitHandler(
      redisService,
      WEBHOOK_KEY_PREFIX,
      this.intFromConfig('WEBHOOK_RATE_LIMIT_MAX', 120),
      this.intFromConfig('WEBHOOK_RATE_LIMIT_WINDOW_SECONDS', 60),
    );
    const dispatchHandler = new DispatchHandler(inboundService, configService);

    signatureHandler
      .setNext(duplicateHandler)
      .setNext(rateLimitHandler)
      .setNext(dispatchHandler);

    this.webhookChain = signatureHandler;
  }

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
    const context: WebhookContext = {
      rawBody,
      signatureHeader,
      stopped: false,
      extractedMessages: [],
    };

    await this.webhookChain.handle(payload, context);

    return context.result;
  }

  private getMetaWhatsappVerifyToken(): string {
    return (
      this.configService.get<string>('META_WHATSAPP_WEBHOOK_VERIFY_TOKEN') ||
      this.configService.get<string>('WHATSAPP_WEBHOOK_VERIFY_TOKEN') ||
      ''
    );
  }

  private intFromConfig(key: string, fallback: number): number {
    const raw = this.configService.get<string>(key);
    const parsed = Number(raw);
    return Number.isInteger(parsed) ? parsed : fallback;
  }
}
