import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { NatsModule } from './nats/nats.module';
import { InboundModule } from './inbound/inbound.module';
import { RedisModule } from './redis/redis.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { WhatsappModule } from './whatsapp/whatsapp.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    RedisModule,
    NatsModule,
    InboundModule,
    WebhooksModule,
    WhatsappModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
