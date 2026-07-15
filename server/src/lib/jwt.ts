import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { roleSchema } from '@fleetpilot/shared';
import { env } from './env';

const accessTokenPayloadSchema = z.object({
  sub: z.string(),
  companyId: z.string(),
  role: roleSchema,
});

export type AccessTokenPayload = z.infer<typeof accessTokenPayloadSchema>;

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.ACCESS_TOKEN_TTL_MIN * 60 });
}

export function verifyAccessToken(token: string): AccessTokenPayload | null {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    const parsed = accessTokenPayloadSchema.safeParse(decoded);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
