import { Module } from '@nestjs/common';
import { InboundController } from './inbound.controller';
import { InboundService } from './inbound.service';
import { NatsModule } from '../nats/nats.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';

@Module({
  imports: [NatsModule, WhatsappModule],
  controllers: [InboundController],
  providers: [InboundService],
  exports: [InboundService],
})
export class InboundModule {}