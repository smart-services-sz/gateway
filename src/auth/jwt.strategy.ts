import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AUTH_COOKIES } from './constants/auth-cookies';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    const accessSecret = process.env.JWT_ACCESS_SECRET;

    if (!accessSecret) {
      throw new Error('JWT_ACCESS_SECRET is not defined');
    }

    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        // 🔥 MOBILE (Authorization header)
        ExtractJwt.fromAuthHeaderAsBearerToken(),

        // 🔥 WEB (httpOnly cookie)
        (req: any) => req?.cookies?.[AUTH_COOKIES.access],
      ]),
      ignoreExpiration: false,
      secretOrKey: accessSecret,
    });
  }

  validate(payload: any) {
    return {
      userId: payload.sub,
      name: payload.name,
      email: payload.email,
      roles: Array.isArray(payload.roles)
        ? payload.roles
        : [payload.roles],
      permissions: Array.isArray(payload.permissions) ? payload.permissions : [],
      cargo: payload.cargo,
      legajo: payload.legajo,
      area: payload.area,
    };
  }
}