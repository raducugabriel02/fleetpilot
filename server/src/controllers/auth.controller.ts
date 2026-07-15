import type { CookieOptions, Request, Response } from 'express';
import { loginSchema, registerSchema } from '@fleetpilot/shared';
import type { AuthResponse, AuthUser } from '@fleetpilot/shared';
import { env } from '../lib/env';
import { HttpError } from '../middleware/error';
import * as authService from '../services/auth.service';

const REFRESH_COOKIE = 'refresh_token';

// path restrâns: browserul trimite cookie-ul doar către rutele de auth, nu la fiecare request
function refreshCookieOptions(expires: Date): CookieOptions {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/auth',
    expires,
  };
}

function getRefreshCookie(req: Request): string | undefined {
  const value: unknown = req.cookies?.[REFRESH_COOKIE];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function sendAuthResult(
  res: Response<AuthResponse>,
  result: authService.AuthResult,
  status: number,
): void {
  res.cookie(
    REFRESH_COOKIE,
    result.tokens.refreshToken,
    refreshCookieOptions(result.tokens.refreshExpiresAt),
  );
  res.status(status).json({ accessToken: result.tokens.accessToken, user: result.user });
}

export async function register(req: Request, res: Response<AuthResponse>): Promise<void> {
  const input = registerSchema.parse(req.body);
  sendAuthResult(res, await authService.register(input), 201);
}

export async function login(req: Request, res: Response<AuthResponse>): Promise<void> {
  const input = loginSchema.parse(req.body);
  sendAuthResult(res, await authService.login(input), 200);
}

export async function refresh(req: Request, res: Response<AuthResponse>): Promise<void> {
  const rawToken = getRefreshCookie(req);
  if (!rawToken) {
    throw new HttpError(401, 'Sesiune inexistentă', 'INVALID_SESSION');
  }
  sendAuthResult(res, await authService.refresh(rawToken), 200);
}

export async function logout(req: Request, res: Response): Promise<void> {
  const rawToken = getRefreshCookie(req);
  if (rawToken) {
    await authService.logout(rawToken);
  }
  res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
  res.status(204).end();
}

export async function me(req: Request, res: Response<AuthUser>): Promise<void> {
  if (!req.auth) {
    throw new HttpError(401, 'Neautentificat', 'UNAUTHENTICATED');
  }
  res.json(await authService.getMe(req.auth.userId));
}
