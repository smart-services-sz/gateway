import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';
import type { RequestContextData } from '../common/decorators/request-context.decorator';
import { GetAuditLogsDto } from './dto/get-audit-logs.dto';

@Injectable()
export class AuditGatewayService {
  constructor(@Inject('NATS_CLIENT') private readonly natsClient: ClientProxy) {}

  getLogs(query: GetAuditLogsDto, context: RequestContextData) {
    return firstValueFrom(
      this.natsClient
        .send('audit.get.logs', { data: query, context })
        .pipe(timeout(10000)),
    );
  }
}