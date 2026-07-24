import { apiErrorSchema } from '@fleetpilot/shared';
import type { AuthResponse } from '@fleetpilot/shared';

/*
 * Access token-ul stă DOAR în memorie (nu în localStorage — XSS-ul nu are de unde
 * să-l fure persistent); sesiunea supraviețuiește refresh-ului de pagină prin
 * cookie-ul httpOnly de refresh, scoped pe /api/auth.
 */
let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

/** setat de AuthProvider: apelat când sesiunea nu mai poate fi reînnoită */
let onSessionExpired: (() => void) | null = null;

export function setOnSessionExpired(handler: (() => void) | null): void {
  onSessionExpired = handler;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function toApiError(res: Response): Promise<ApiError> {
  try {
    const body = apiErrorSchema.parse(await res.json());
    return new ApiError(res.status, body.error.message, body.error.code, body.error.details);
  } catch {
    return new ApiError(res.status, 'Serverul a răspuns neașteptat. Încearcă din nou.');
  }
}

// un singur refresh în zbor, oricâte request-uri primesc 401 simultan
let refreshInFlight: Promise<AuthResponse | null> | null = null;

export function refreshSession(): Promise<AuthResponse | null> {
  refreshInFlight ??= (async () => {
    try {
      const res = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' });
      if (!res.ok) return null;
      const data = (await res.json()) as AuthResponse;
      accessToken = data.accessToken;
      return data;
    } catch {
      return null;
    }
  })().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

interface ApiFetchOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
}

async function rawFetch(path: string, options: ApiFetchOptions): Promise<Response> {
  return fetch(path, {
    method: options.method ?? 'GET',
    credentials: 'include',
    headers: {
      ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  let res = await rawFetch(path, options);

  // access token expirat: reînnoim din cookie și reîncercăm o singură dată
  if (res.status === 401 && !path.startsWith('/api/auth/')) {
    const refreshed = await refreshSession();
    if (refreshed) {
      res = await rawFetch(path, options);
    } else {
      onSessionExpired?.();
    }
  }

  if (!res.ok) {
    throw await toApiError(res);
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}
