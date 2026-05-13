import { Module } from '@nestjs/common';
import { NatsModule } from '../nats/nats.module';
import { RoutingController } from './routing.controller';
import { RoutingService } from './routing.service';

@Module({
  imports: [NatsModule],
  controllers: [RoutingController],
  providers: [RoutingService],
})
export class RoutingModule {}
