import { Module } from '@nestjs/common';
import { RolesService } from './roles.service';
import { RolesController } from './roles.controller';
import { NatsModule } from '../nats/nats.module';

@Module({
  imports: [
    NatsModule,
  ],
  controllers: [RolesController],
  providers: [RolesService],
})
export class RolesModule {}
