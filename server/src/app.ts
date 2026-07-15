import express from 'express';
import { errorHandler, notFoundHandler } from './middleware/error';
import { healthRouter } from './routes/health';

export function createApp(): express.Express {
  const app = express();

  app.use(express.json());
  app.use('/api/health', healthRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
