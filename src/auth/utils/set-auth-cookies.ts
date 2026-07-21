import { Response } from 'express';
import { AUTH_COOKIES } from '../constants/auth-cookies';

export function setAuthCookies(
  res: Response,
  accessToken: string,
  refreshToken: string,
) {
  const isProd = process.env.NODE_ENV === 'production';

  const cookieOptions = {
    httpOnly: true,
    secure: isProd, // en Railway debe ser true
    sameSite: isProd ? 'none' : 'lax', // 👈 CLAVE
  } as const;

  // Access token
  res.cookie(AUTH_COOKIES.access, accessToken, {
    ...cookieOptions,
    path: '/',
    maxAge: 15 * 60 * 1000,
  });

  // Refresh token
  res.cookie(AUTH_COOKIES.refresh, refreshToken, {
    ...cookieOptions,
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

export function clearAuthCookies(res: Response) {
  const isProd = process.env.NODE_ENV === 'production';

  const cookieOptions = {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
  } as const;

  res.clearCookie(AUTH_COOKIES.access, {
    ...cookieOptions,
    path: '/',
  });

  res.clearCookie(AUTH_COOKIES.refresh, {
    ...cookieOptions,
    path: '/',
  });
}
