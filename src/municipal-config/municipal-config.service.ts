import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';
import type { RequestContextData } from '../common/decorators/request-context.decorator';
import type { JwtUser } from '../common/decorators/current-user.dto';
import { MunicipalityConfigurationDto } from './dto/municipality-configuration.dto';

@Injectable()
export class MunicipalConfigService {
  constructor(@Inject('NATS_CLIENT') private readonly natsClient: ClientProxy) {}

  list(includeInactive: boolean, context: RequestContextData) {
    return this.request('municipalities.config.list', {
      data: { includeInactive },
      context,
    });
  }

  getById(id: string, context: RequestContextData) {
    return this.get(id, context);
  }

  get(id: string, context: RequestContextData) {
    return this.request('municipalities.config.get', { data: { id }, context });
  }

  save(
    dto: MunicipalityConfigurationDto,
    user: JwtUser,
    context: RequestContextData,
  ) {
    return this.request('municipalities.config.upsert', {
      data: dto,
      context: { ...context, userId: user.userId },
    });
  }

  private async request<T>(pattern: string, payload: unknown): Promise<T> {
    return firstValueFrom(
      this.natsClient.send<T>(pattern, payload).pipe(timeout(10000)),
    );
  }
}