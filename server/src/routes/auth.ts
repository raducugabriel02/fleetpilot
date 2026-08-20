import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import { requireAuth } from '../middleware/auth';
import { loginRateLimit, registerRateLimit } from '../middleware/rate-limit';

export const authRouter = Router();

authRouter.post('/register', registerRateLimit, authController.register);
authRouter.post('/login', loginRateLimit, authController.login);
authRouter.post('/refresh', authController.refresh);
authRouter.post('/logout', authController.logout);
authRouter.get('/me', requireAuth, authController.me);
