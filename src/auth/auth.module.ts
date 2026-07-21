import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PassportModule } from '@nestjs/passport';
import { NatsModule } from '../nats/nats.module';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [PassportModule, NatsModule],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
})
export class AuthModule {}
