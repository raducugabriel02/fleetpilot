import { Router } from 'express';
import * as agentController from '../controllers/agent.controller';
import { requireAuth, requireRole } from '../middleware/auth';

export const agentRouter = Router();

agentRouter.use(requireAuth);
// dispecerul AI e unealtă de dispecerat — șoferii nu au acces la el
agentRouter.use(requireRole('ADMIN', 'DISPATCHER'));

agentRouter.post('/message', agentController.sendMessage);
agentRouter.get('/actions', agentController.list);
agentRouter.post('/actions/:id/approve', agentController.approve);
agentRouter.post('/actions/:id/reject', agentController.reject);
