import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import pinoHttp from 'pino-http';
import { env } from './lib/env';
import { logger } from './lib/logger';
import { errorHandler, notFoundHandler } from './middleware/error';
import { agentRouter } from './routes/agent';
import { authRouter } from './routes/auth';
import { clientsRouter } from './routes/clients';
import { driversRouter } from './routes/drivers';
import { healthRouter } from './routes/health';
import { reportsRouter } from './routes/reports';
import { tripsRouter } from './routes/trips';
import { vehiclesRouter } from './routes/vehicles';

export function createApp(): express.Express {
  const app = express();

  // în producție stă mereu în spatele reverse-proxy-ului Caddy (docker-compose.prod.yml) —
  // exact 1 hop de încredere, ca IP-ul folosit la rate limiting să fie al clientului real,
  // nu al proxy-ului; fără asta, express-rate-limit refuză să pornească pe un X-Forwarded-For
  // nesigur, iar în dev (fără proxy) header-ul oricum nu există
  if (env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
  }

  // fără redact, serializerele implicite pino-http/pino-std-serializers loghează
  // req.headers ȘI res.headers COMPLET la fiecare request, la nivel info — asta ar scurge
  // Authorization (Bearer access token) și cookie-ul refreshToken (httpOnly, dar nu și
  // față de propriile log-uri) în clar, în producție, pe fiecare linie de log
  app.use(
    pinoHttp({
      logger,
      redact: {
        paths: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
        remove: true,
      },
    }),
  );

  // credentials: true — altfel browserul refuză cookie-ul de refresh cross-origin
  app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true }));
  app.use(express.json());
  app.use(cookieParser());

  app.use('/api/health', healthRouter);
  app.use('/api/agent', agentRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/clients', clientsRouter);
  app.use('/api/drivers', driversRouter);
  app.use('/api/vehicles', vehiclesRouter);
  app.use('/api/trips', tripsRouter);
  app.use('/api/reports', reportsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
