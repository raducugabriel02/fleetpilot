import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import { env } from './lib/env';
import { errorHandler, notFoundHandler } from './middleware/error';
import { agentRouter } from './routes/agent';
import { authRouter } from './routes/auth';
import { clientsRouter } from './routes/clients';
import { driversRouter } from './routes/drivers';
import { healthRouter } from './routes/health';
import { tripsRouter } from './routes/trips';
import { vehiclesRouter } from './routes/vehicles';

export function createApp(): express.Express {
  const app = express();

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

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
