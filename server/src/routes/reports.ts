import { Router } from 'express';
import * as reportController from '../controllers/report.controller';
import { requireAuth, requireRole } from '../middleware/auth';

export const reportsRouter = Router();

reportsRouter.use(requireAuth, requireRole('ADMIN', 'DISPATCHER'));
reportsRouter.get('/monthly', reportController.monthly);
