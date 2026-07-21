import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Canales de comunicación soportados por el sistema.
export enum ChannelType {
  WHATSAPP = 'whatsapp',
  WEB = 'web',
  EMAIL = 'email',
  INSTAGRAM = 'instagram',
  FACEBOOK = 'facebook',
  MANUAL = 'manual',
  OTHER = 'other',
}

// Tipo de identificador del contacto dentro del canal.
export enum ChannelIdentityType {
  PHONE = 'phone',
  EMAIL = 'email',
  SESSION = 'session',
  PLATFORM_USER_ID = 'platform_user_id',
  CUSTOM = 'custom',
}

export class ChannelIdentityDto {
  @ApiProperty({
    enum: ChannelIdentityType,
    example: ChannelIdentityType.PHONE,
  })
  @IsEnum(ChannelIdentityType, {
    message:
      'channelIdentity.type debe ser uno de los siguientes valores: phone, email, session, platform_user_id, custom',
  })
  type!: ChannelIdentityType;

  @ApiProperty({ example: '+5491166660000' })
  @IsString({ message: 'channelIdentity.value debe ser una cadena de texto' })
  @IsNotEmpty({
    message: 'channelIdentity.value no debe estar vacío',
  })
  value!: string;

  @ApiPropertyOptional({ example: '5491166660000' })
  @IsOptional()
  @IsString({
    message: 'channelIdentity.normalizedValue debe ser una cadena de texto',
  })
  @IsNotEmpty({
    message: 'channelIdentity.normalizedValue no debe estar vacío',
  })
  normalizedValue?: string;
}

// Configuración de la ventana de acumulación de mensajes.
// Permite que varios mensajes enviados en rápida sucesión se agrupen en un solo lote
// antes de ser despachados a ms-ai, reduciendo llamadas redundantes a OpenAI.
export class ResponseWindowDto {
  @ApiProperty({
    description:
      'Tiempo de espera sin nuevos mensajes antes de procesar el lote.',
    // debounceMs: si no llega otro mensaje en este tiempo, se despacha el lote.
    example: 1200,
    minimum: 0,
    maximum: 60000,
  })
  @IsInt({ message: 'responseWindow.debounceMs debe ser un número entero' })
  @Min(0, {
    message: 'responseWindow.debounceMs debe ser mayor o igual a 0',
  })
  @Max(60000, {
    message: 'responseWindow.debounceMs debe ser menor o igual a 60000',
  })
  debounceMs!: number;

  @ApiProperty({
    description:
      'Delay extra previo a responder, luego de cumplir el debounce.',
    example: 300,
    minimum: 0,
    maximum: 60000,
  })
  @IsInt({ message: 'responseWindow.delayMs debe ser un número entero' })
  @Min(0, {
    message: 'responseWindow.delayMs debe ser mayor o igual a 0',
  })
  @Max(60000, {
    message: 'responseWindow.delayMs debe ser menor o igual a 60000',
  })
  delayMs!: number;

  @ApiPropertyOptional({
    description: 'Ventana máxima de acumulación de mensajes en milisegundos.',
    example: 8000,
    minimum: 0,
    maximum: 120000,
  })
  @IsOptional()
  @IsInt({
    message: 'responseWindow.maxAccumulationMs debe ser un número entero',
  })
  @Min(0, {
    message: 'responseWindow.maxAccumulationMs debe ser mayor o igual a 0',
  })
  @Max(120000, {
    message: 'responseWindow.maxAccumulationMs debe ser menor o igual a 120000',
  })
  maxAccumulationMs?: number;
}

// DTO principal que recibe el gateway por HTTP.
// Representa un mensaje entrante de cualquier canal, con su identidad de contacto
// y la configuración de ventana de respuesta.
export class CreateInboundMessageDto {
  @ApiProperty({ enum: ChannelType, example: ChannelType.WHATSAPP })
  @IsEnum(ChannelType, {
    message:
      'channel debe ser uno de los siguientes valores: whatsapp, web, email, instagram, facebook, manual, other',
  })
  channel!: ChannelType;

  @ApiProperty({
    description: 'Identificador único de usuario dentro del canal.',
    type: ChannelIdentityDto,
  })
  @ValidateNested({
    message: 'channelIdentity debe ser un objeto válido',
  })
  @Type(() => ChannelIdentityDto)
  channelIdentity!: ChannelIdentityDto;

  @ApiPropertyOptional({
    description: 'Id de mensaje externo para idempotencia futura.',
    example: 'wamid.HBgL...',
  })
  @IsOptional()
  @IsString({ message: 'externalMessageId debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'externalMessageId no debe estar vacío' })
  externalMessageId?: string;

  @ApiProperty({
    description: 'Texto recibido del usuario.',
    example: 'Tengo una fuga de agua en Av. Siempre Viva 123',
  })
  @IsString({ message: 'messageText debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'messageText no debe estar vacío' })
  messageText!: string;

  @ApiPropertyOptional({
    description: 'Timestamp de recepción del mensaje en canal origen.',
    example: '2026-05-05T18:00:00.000Z',
  })
  @IsOptional()
  @IsDateString({}, { message: 'receivedAt debe ser una fecha ISO válida' })
  receivedAt?: string;

  @ApiProperty({
    description:
      'Configuración de ventana para juntar múltiples mensajes antes de responder.',
    type: ResponseWindowDto,
  })
  @ValidateNested({
    message: 'responseWindow debe ser un objeto válido',
  })
  @Type(() => ResponseWindowDto)
  responseWindow!: ResponseWindowDto;

  @ApiPropertyOptional({
    description: 'Metadatos adicionales dependientes del canal.',
    example: { locale: 'es-AR', source: 'postman' },
  })
  @IsOptional()
  @IsObject({ message: 'metadata debe ser un objeto' })
  metadata?: Record<string, unknown>;
}
