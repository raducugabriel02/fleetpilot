import { Router } from 'express';
import * as clientController from '../controllers/client.controller';
import { requireAuth, requireRole } from '../middleware/auth';

export const clientsRouter = Router();

clientsRouter.use(requireAuth);

// citirea e permisă oricui e logat (șoferul vede pentru cine duce marfa);
// scrierea doar dispecerat/admin, ștergerea doar admin
clientsRouter.get('/', clientController.list);
clientsRouter.get('/:id', clientController.getById);
clientsRouter.post('/', requireRole('ADMIN', 'DISPATCHER'), clientController.create);
clientsRouter.patch('/:id', requireRole('ADMIN', 'DISPATCHER'), clientController.update);
clientsRouter.delete('/:id', requireRole('ADMIN'), clientController.remove);
