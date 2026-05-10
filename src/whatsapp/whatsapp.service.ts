import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError } from 'axios';

export interface WhatsappSendMessagePayload {
  phoneNumberId: string;
  recipientPhone: string;
  message: string;
}

export interface WhatsappApiResponse {
  messages: Array<{
    id: string;
  }>;
}

@Injectable()
export class WhatsappService implements OnModuleInit {
  private readonly logger = new Logger(WhatsappService.name);
  private readonly metaApiVersion: string;
  private readonly metaAccessToken: string;

  constructor(private readonly configService: ConfigService) {
    this.metaApiVersion =
      this.configService.get<string>('META_API_VERSION') || 'v25.0';
    this.metaAccessToken = this.normalizeAccessToken(
      this.configService.get<string>('META_WHATSAPP_ACCESS_TOKEN') || '',
    );
  }

  async onModuleInit(): Promise<void> {
    await this.validateAccessTokenOnStartup();
  }

  /**
   * Envía un mensaje de texto a través de la API de WhatsApp Business de Meta.
   * @param payload Contiene phoneNumberId, recipientPhone y el mensaje
   * @returns messageId si es exitoso
   */
  async sendTextMessage(
    payload: WhatsappSendMessagePayload,
  ): Promise<string | null> {
    const { phoneNumberId, recipientPhone, message } = payload;

    if (!this.metaAccessToken) {
      this.logger.warn(
        'META_WHATSAPP_ACCESS_TOKEN no está configurado; no se puede enviar mensaje',
      );
      return null;
    }

    if (!phoneNumberId) {
      this.logger.warn(
        'phoneNumberId no especificado; no se puede enviar mensaje',
      );
      return null;
    }

    const url = `https://graph.facebook.com/${this.metaApiVersion}/${phoneNumberId}/messages`;

    const payload_meta = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: recipientPhone,
      type: 'text',
      text: {
        body: message,
      },
    };

    try {
      const response = await axios.post<WhatsappApiResponse>(url, payload_meta, {
        headers: {
          Authorization: `Bearer ${this.metaAccessToken}`,
          'Content-Type': 'application/json',
        },
      });

      const messageId = response.data?.messages?.[0]?.id;

      this.logger.log(
        `[WHATSAPP-SEND] messageId=${messageId} to=${recipientPhone} | SUCCESS`,
      );

      return messageId || null;
    } catch (error: unknown) {
      const axiosError = error as AxiosError;
      const errorMessage =
        axiosError?.response?.data ||
        (error instanceof Error ? error.message : String(error));

      this.logger.error(
        `[WHATSAPP-SEND] to=${recipientPhone} | ERROR: ${JSON.stringify(errorMessage)}`,
      );

      return null;
    }
  }

  private normalizeAccessToken(token: string): string {
    // Avoid subtle token parse errors caused by accidental wrapping quotes/whitespace.
    return token.trim().replace(/^['\"]|['\"]$/g, '');
  }

  private async validateAccessTokenOnStartup(): Promise<void> {
    if (!this.metaAccessToken) {
      this.logger.warn(
        '[WHATSAPP-TOKEN-CHECK] META_WHATSAPP_ACCESS_TOKEN no configurado',
      );
      return;
    }

    const url = `https://graph.facebook.com/${this.metaApiVersion}/me`;

    try {
      const response = await axios.get<{ id?: string; name?: string }>(url, {
        params: {
          fields: 'id,name',
          access_token: this.metaAccessToken,
        },
        timeout: 8000,
      });

      this.logger.log(
        `[WHATSAPP-TOKEN-CHECK] OK id=${response.data?.id || 'n/a'} name=${response.data?.name || 'n/a'}`,
      );
    } catch (error: unknown) {
      const axiosError = error as AxiosError;
      const errorMessage =
        axiosError?.response?.data ||
        (error instanceof Error ? error.message : String(error));

      this.logger.error(
        `[WHATSAPP-TOKEN-CHECK] ERROR ${JSON.stringify(errorMessage)}`,
      );
    }
  }
}
