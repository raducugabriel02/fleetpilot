import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(4000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET trebuie să aibă minim 32 de caractere'),
  ACCESS_TOKEN_TTL_MIN: z.coerce.number().int().positive().default(15),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  CLIENT_ORIGIN: z.url().default('http://localhost:5173'),
  // servicii publice gratuite; suprascriibile pentru self-hosting sau teste.
  // trebuie să fie URL-uri root (fără path) — new URL('/cale', base) ar șterge path-ul
  OSRM_BASE_URL: z.url().default('https://router.project-osrm.org'),
  NOMINATIM_BASE_URL: z.url().default('https://nominatim.openstreetmap.org'),
});

export const env = envSchema.parse(process.env);
