import { Router } from 'express';
import * as vehicleController from '../controllers/vehicle.controller';
import { requireAuth, requireRole } from '../middleware/auth';

export const vehiclesRouter = Router();

vehiclesRouter.use(requireAuth);

// citirea e permisă oricui e logat (șoferul își vede camionul); scrierea doar dispecerat/admin
vehiclesRouter.get('/', vehicleController.list);
vehiclesRouter.get('/:id', vehicleController.getById);
vehiclesRouter.post('/', requireRole('ADMIN', 'DISPATCHER'), vehicleController.create);
vehiclesRouter.patch('/:id', requireRole('ADMIN', 'DISPATCHER'), vehicleController.update);
vehiclesRouter.delete('/:id', requireRole('ADMIN'), vehicleController.remove);
