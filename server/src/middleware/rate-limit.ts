import type { Response } from 'express';
import rateLimit from 'express-rate-limit';
import type { ApiError } from '@fleetpilot/shared';

// mesaj identic pt. limit atins pe /login și /register — un atacator nu trebuie
// să afle din răspuns care dintre cele două rute a declanșat limita
function tooManyRequests(_req: unknown, res: Response<ApiError>): void {
  res.status(429).json({
    error: { message: 'Prea multe încercări. Reîncearcă mai târziu.', code: 'RATE_LIMITED' },
  });
}

// brute-force pe parolă: limită strictă per IP, fereastră lungă
export const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: tooManyRequests,
});

// creare de conturi/firme la scară: limită și mai strictă, nu e o acțiune repetată legitim
export const registerRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: tooManyRequests,
});
