import { Module } from '@nestjs/common';
import { NatsModule } from '../nats/nats.module';
import { AuditController } from './audit.controller';
import { AuditGatewayService } from './audit.service';

@Module({
  imports: [NatsModule],
  controllers: [AuditController],
  providers: [AuditGatewayService],
})
export class AuditModule {}