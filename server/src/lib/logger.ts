import pino from 'pino';
import { env } from './env';

// JSON simplu în producție (agregabil de Docker/host log driver), pretty-print doar local —
// pino-pretty rulează pe un worker thread separat, nu costă în producție fiindcă nici nu se încarcă.
// `NODE_ENV=test` cade pe ramura non-producție (debug + pretty) — decizie conștientă, nu
// scăpare: proiectul n-are încă suite de teste automate, deci nu există azi un pipeline CI
// care să pornească serverul cu NODE_ENV=test și `npm ci --omit=dev` (fără pino-pretty).
// De revizuit dacă apare un asemenea pipeline.
export const logger = pino({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  transport:
    env.NODE_ENV === 'production'
      ? undefined
      : {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
        },
});
