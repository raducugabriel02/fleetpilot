import { ApiError } from './api';

function isZodIssueLike(value: unknown): value is { message: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Record<string, unknown>).message === 'string'
  );
}

/** "Date invalide" e umbrela generică pentru orice eșec Zod pe server — issue-ul concret
 * (ce câmp, de ce) stă în details, altfel utilizatorul nu află niciodată motivul real */
export function errorMessage(err: unknown): string {
  if (!(err instanceof ApiError)) return 'Ceva n-a mers. Încearcă din nou.';
  if (
    err.code === 'VALIDATION_ERROR' &&
    Array.isArray(err.details) &&
    isZodIssueLike(err.details[0])
  ) {
    return err.details[0].message;
  }
  return err.message;
}
