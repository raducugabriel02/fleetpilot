import type { NextFunction, Request, Response } from 'express';
import type { Role } from '@fleetpilot/shared';
import { verifyAccessToken } from '../lib/jwt';
import { HttpError } from './error';

export interface AuthContext {
  userId: string;
  companyId: string;
  role: Role;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;
  const payload = token ? verifyAccessToken(token) : null;
  if (!payload) {
    throw new HttpError(401, 'Neautentificat', 'UNAUTHENTICATED');
  }
  req.auth = { userId: payload.sub, companyId: payload.companyId, role: payload.role };
  next();
}

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.auth) {
      throw new HttpError(401, 'Neautentificat', 'UNAUTHENTICATED');
    }
    if (!roles.includes(req.auth.role)) {
      throw new HttpError(403, 'Nu ai permisiunea necesară', 'FORBIDDEN');
    }
    next();
  };
}
