import { Module } from '@nestjs/common';
import { NatsModule } from '../nats/nats.module';
import { MunicipalConfigController } from './municipal-config.controller';
import { MunicipalConfigService } from './municipal-config.service';

@Module({
  imports: [NatsModule],
  controllers: [MunicipalConfigController],
  providers: [MunicipalConfigService],
})
export class MunicipalConfigModule {}