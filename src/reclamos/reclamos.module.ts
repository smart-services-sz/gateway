import { Module } from '@nestjs/common';
import { ReclamosController } from './reclamos.controller';
import { ReclamosService } from './reclamos.service';
import { NatsModule } from '../nats/nats.module';

@Module({
  imports: [NatsModule],
  controllers: [ReclamosController],
  providers: [ReclamosService],
})
export class ReclamosModule {}
