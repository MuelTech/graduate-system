import { Router } from 'express';
import authRoutes from './auth.routes';
import programRoutes from './program.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/programs', programRoutes);

export default router;