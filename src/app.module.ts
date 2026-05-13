import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { NatsModule } from './nats/nats.module';
import { InboundModule } from './inbound/inbound.module';
import { RedisModule } from './redis/redis.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { WhatsappModule } from './whatsapp/whatsapp.module';
import { ReclamosModule } from './reclamos/reclamos.module';
import { AuthModule } from './auth/auth.module';
import { PermissionsModule } from './permissions/permissions.module';
import { RolesModule } from './roles/roles.module';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { RoutingModule } from './routing/routing.module';

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
    ReclamosModule,
    RoutingModule,
    AuthModule,
    PermissionsModule,
    RolesModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
  ],
})
export class AppModule {}
