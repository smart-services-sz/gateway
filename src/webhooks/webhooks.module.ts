import { Module } from '@nestjs/common';
import { InboundModule } from '../inbound/inbound.module';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';

@Module({
  imports: [InboundModule],
  controllers: [WebhooksController],
  providers: [WebhooksService],
})
export class WebhooksModule {}