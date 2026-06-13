import { Router } from 'express';
import authRoutes from './auth.routes';
import programRoutes from './program.routes';
import applicantRoutes from './applicant.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/programs', programRoutes);
router.use('/applicant', applicantRoutes);

export default router;