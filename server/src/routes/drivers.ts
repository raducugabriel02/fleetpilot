import { Router } from 'express';
import * as driverController from '../controllers/driver.controller';
import { requireAuth, requireRole } from '../middleware/auth';

export const driversRouter = Router();

driversRouter.use(requireAuth);

// citirea e permisă oricui e logat; scrierea doar dispecerat/admin.
// crearea rămâne la dispecer (onboarding-ul șoferilor e treabă operațională, zilnică),
// dar închiderea/redeschiderea contului doar admin — taie accesul unui om la platformă
driversRouter.get('/', driverController.list);
driversRouter.get('/:id', driverController.getById);
driversRouter.post('/', requireRole('ADMIN', 'DISPATCHER'), driverController.create);
driversRouter.patch('/:id', requireRole('ADMIN', 'DISPATCHER'), driverController.update);
driversRouter.delete('/:id', requireRole('ADMIN'), driverController.deactivate);
driversRouter.post('/:id/activate', requireRole('ADMIN'), driverController.activate);
driversRouter.post(
  '/:id/absences',
  requireRole('ADMIN', 'DISPATCHER'),
  driverController.addAbsence,
);
driversRouter.delete(
  '/:id/absences/:absenceId',
  requireRole('ADMIN', 'DISPATCHER'),
  driverController.removeAbsence,
);
