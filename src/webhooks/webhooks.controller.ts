import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBody,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { WebhooksService } from './webhooks.service';

import { Public } from '../auth/decorators/public.decorator';

@ApiTags('Webhooks')
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Public()
  @Get('meta/whatsapp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verifica el webhook de Meta WhatsApp' })
  @ApiQuery({ name: 'hub.mode', required: false, example: 'subscribe' })
  @ApiQuery({
    name: 'hub.verify_token',
    required: false,
    example: 'szsmartservice_meta_verify_2026_9f3c7d2b',
  })
  @ApiQuery({ name: 'hub.challenge', required: false, example: '123456789' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Retorna el challenge cuando la verificación es válida',
  })
  verifyMetaWhatsappWebhook(
    @Query('hub.mode') mode?: string,
    @Query('hub.verify_token') verifyToken?: string,
    @Query('hub.challenge') challenge?: string,
  ) {
    return this.webhooksService.verifyMetaWhatsappWebhook(
      mode,
      verifyToken,
      challenge,
    );
  }

  @Public()
  @Post('meta/whatsapp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Recibe eventos de Meta WhatsApp y los deriva al inbound interno',
  })
  @ApiBody({
    schema: {
      type: 'object',
      additionalProperties: true,
      example: {
        object: 'whatsapp_business_account',
        entry: [],
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Webhook recibido y normalizado para el pipeline interno',
  })
  receiveMetaWhatsappWebhook(
    @Req() request: Request & { rawBody?: Buffer },
    @Body() payload: Record<string, unknown>,
  ) {
    return this.webhooksService.receiveMetaWhatsappWebhook(
      payload,
      request.rawBody,
      request.header('x-hub-signature-256'),
    );
  }
}