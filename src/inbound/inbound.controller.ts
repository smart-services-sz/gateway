import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CreateInboundMessageDto } from './dto/create-inbound-message.dto';
import { InboundService } from './inbound.service';

@ApiTags('Inbound')
@Controller('inbound')
export class InboundController {
  constructor(private readonly inboundService: InboundService) {}

  // POST /api/inbound/messages
  // Punto de entrada HTTP para mensajes de cualquier canal.
  // Responde con 202 Accepted: el mensaje fue recibido y encolado, pero aún no procesado por IA.
  @Post('messages')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Recibe mensajes inbound desde distintos canales' })
  @ApiResponse({
    status: HttpStatus.ACCEPTED,
    description: 'Mensaje aceptado y validado por gateway',
  })
  receiveMessage(@Body() payload: CreateInboundMessageDto) {
    return this.inboundService.receiveMessage(payload);
  }

  // GET /api/inbound/messages/context?contactKey=whatsapp:phone:5491166660000
  // Endpoint de diagnóstico: devuelve el estado actual del contacto en Redis
  // (contexto, buffer de mensajes, último dispatch a ms-ai y último mensaje saliente).
  @Get('messages/context')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Consulta contexto, buffer de mensajes y lote pendiente de envío a ms-ai por contactKey',
  })
  @ApiQuery({
    name: 'contactKey',
    required: true,
    example: 'whatsapp:phone:5491166660000',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Contexto, mensajes en buffer y payload listo para ms-ai',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'No existe contexto para el contactKey indicado',
  })
  async getContext(@Query('contactKey') contactKey: string) {
    const result = await this.inboundService.getContext(contactKey?.trim());

    if (!result) {
      throw new NotFoundException(
        `No se encontró contexto para contactKey: ${contactKey}`,
      );
    }

    return result;
  }
}