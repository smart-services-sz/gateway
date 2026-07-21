import {
  BadGatewayException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';
import { CreateReclamoDto } from './dto/create-reclamo.dto';
import { FindReclamosDto } from './dto/find-reclamos.dto';
import { UpdateReclamoDto } from './dto/update-reclamo.dto';

@Injectable()
export class ReclamosService {
  private readonly logger = new Logger(ReclamosService.name);

  constructor(
    @Inject('NATS_CLIENT') private readonly natsClient: ClientProxy,
  ) {}

  create(payload: CreateReclamoDto) {
    return this.request('reclamos.create', payload);
  }

  findAll(query: FindReclamosDto) {
    return this.request('reclamos.find-all', query);
  }

  findOne(id: string) {
    return this.request('reclamos.find-one', { id });
  }

  update(id: string, data: UpdateReclamoDto) {
    return this.request('reclamos.update', { id, data });
  }

  remove(id: string) {
    return this.request('reclamos.remove', { id });
  }

  private async request<T = unknown>(
    pattern: string,
    payload: unknown,
  ): Promise<T> {
    try {
      return await firstValueFrom(
        this.natsClient.send<T>(pattern, payload).pipe(timeout(10000)),
      );
    } catch (error: unknown) {
      this.logger.error(
        `Error RPC en patron ${pattern}: ${this.stringifyError(error)}`,
      );
      throw this.mapRpcError(error);
    }
  }

  private mapRpcError(error: unknown): HttpException {
    if (error instanceof HttpException) {
      return error;
    }

    if (this.isRecord(error)) {
      const statusCode = this.extractStatusCode(error);
      const message = this.extractMessage(error);

      if (statusCode) {
        return new HttpException(message, statusCode);
      }

      if (message.toLowerCase().includes('no se encontr')) {
        return new HttpException(message, HttpStatus.NOT_FOUND);
      }

      return new BadGatewayException(message);
    }

    if (error instanceof Error) {
      if (error.message.toLowerCase().includes('no se encontr')) {
        return new HttpException(error.message, HttpStatus.NOT_FOUND);
      }

      return new BadGatewayException(error.message);
    }

    return new BadGatewayException(
      'Error inesperado al comunicarse con ms-reclamos',
    );
  }

  private extractStatusCode(
    error: Record<string, unknown>,
  ): number | undefined {
    const direct = error.statusCode;
    if (typeof direct === 'number') {
      return direct;
    }

    const nested = this.isRecord(error.error)
      ? error.error.statusCode
      : undefined;
    if (typeof nested === 'number') {
      return nested;
    }

    return undefined;
  }

  private extractMessage(error: Record<string, unknown>): string {
    const candidates = [
      error.message,
      this.isRecord(error.error) ? error.error.message : undefined,
      this.isRecord(error.response) ? error.response.message : undefined,
    ];

    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate;
      }

      if (Array.isArray(candidate) && candidate.length > 0) {
        return candidate.map(String).join(', ');
      }
    }

    return 'Error desconocido en ms-reclamos';
  }

  private stringifyError(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    if (this.isRecord(error)) {
      return JSON.stringify(error);
    }

    return String(error);
  }

  private isRecord(value: unknown): value is Record<string, any> {
    return typeof value === 'object' && value !== null;
  }
}
