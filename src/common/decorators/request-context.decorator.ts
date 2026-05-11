import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface RequestContextData {
  ip: string;
  userAgent?: string;
  userId?: string;
}

export const RequestContext = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): RequestContextData => {
    const request = ctx.switchToHttp().getRequest();

    const forwarded = request.headers['x-forwarded-for'];
    const ip =
      typeof forwarded === 'string'
        ? forwarded.split(',')[0].trim()
        : request.socket?.remoteAddress || '';

    return {
      ip,
      userAgent: request.headers['user-agent'],
      userId: request.user?.sub, // si tienes JWT guard
    };
  },
);