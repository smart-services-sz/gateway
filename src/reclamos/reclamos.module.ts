import { Module } from '@nestjs/common';
import { ReclamosController } from './reclamos.controller';
import { ReclamosService } from './reclamos.service';
import { NatsModule } from '../nats/nats.module';
import { EvidenceStorageModule } from '../storage/evidence-storage.module';

@Module({
  imports: [NatsModule, EvidenceStorageModule],
  controllers: [ReclamosController],
  providers: [ReclamosService],
})
export class ReclamosModule {}
