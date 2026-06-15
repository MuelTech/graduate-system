import { Router } from 'express';
import authRoutes from './auth.routes';
import programRoutes from './program.routes';
import applicantRoutes from './applicant.routes';
import examRoutes from './exam.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/programs', programRoutes);
router.use('/applicant', applicantRoutes);
router.use('/exam', examRoutes);

export default router;