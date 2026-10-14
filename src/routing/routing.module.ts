import { Module } from '@nestjs/common';
import { NatsModule } from '../nats/nats.module';
import { RoutingController } from './routing.controller';
import { RoutingService } from './routing.service';
import { EvidenceStorageModule } from '../storage/evidence-storage.module';

@Module({
  imports: [NatsModule, EvidenceStorageModule],
  controllers: [RoutingController],
  providers: [RoutingService],
})
export class RoutingModule {}
