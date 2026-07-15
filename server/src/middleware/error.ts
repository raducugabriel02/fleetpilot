import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import type { ApiError } from '@fleetpilot/shared';

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
  ) {
    super(message);
  }
}

export function notFoundHandler(req: Request, res: Response<ApiError>): void {
  res.status(404).json({
    error: { message: `Ruta ${req.method} ${req.path} nu există`, code: 'NOT_FOUND' },
  });
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response<ApiError>,
  _next: NextFunction,
): void {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: { message: err.message, code: err.code } });
    return;
  }
  // P2002 = unique constraint: transformăm eroarea criptică Prisma într-un 409 clar
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    res.status(409).json({
      error: { message: 'Există deja o înregistrare cu aceste date', code: 'DUPLICATE' },
    });
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json({
      error: { message: 'Date invalide', code: 'VALIDATION_ERROR', details: err.issues },
    });
    return;
  }
  console.error(err);
  res.status(500).json({ error: { message: 'Eroare internă', code: 'INTERNAL' } });
}
