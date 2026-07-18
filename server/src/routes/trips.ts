import { Router } from 'express';
import * as tripController from '../controllers/trip.controller';
import { requireAuth, requireRole } from '../middleware/auth';

export const tripsRouter = Router();

tripsRouter.use(requireAuth);

// citirea e permisă oricui e logat — deocamdată șoferul vede toate cursele firmei;
// filtrarea „doar cursele mele" vine odată cu ecranul dedicat șoferului. Scrierea: dispecerat/admin
tripsRouter.get('/', tripController.list);
tripsRouter.get('/:id', tripController.getById);
tripsRouter.post('/', requireRole('ADMIN', 'DISPATCHER'), tripController.create);
tripsRouter.patch('/:id', requireRole('ADMIN', 'DISPATCHER'), tripController.update);
// tranzițiile de status sunt acțiuni dedicate, nu un PATCH pe status — mașina de stări stă în service
tripsRouter.post('/:id/assign', requireRole('ADMIN', 'DISPATCHER'), tripController.assign);
tripsRouter.post('/:id/route', requireRole('ADMIN', 'DISPATCHER'), tripController.recalcRoute);
tripsRouter.post('/:id/start', requireRole('ADMIN', 'DISPATCHER'), tripController.start);
tripsRouter.post('/:id/complete', requireRole('ADMIN', 'DISPATCHER'), tripController.complete);
tripsRouter.post('/:id/cancel', requireRole('ADMIN', 'DISPATCHER'), tripController.cancel);
tripsRouter.delete('/:id', requireRole('ADMIN'), tripController.remove);
