import { Router } from 'express';
import authRoutes from './auth.routes';
import programRoutes from './program.routes';
import applicantRoutes from './applicant.routes';
import examRoutes from './exam.routes';
import corRoutes from './cor.routes'
import studentRoutes from './student.routes';
import evaluationRoutes from './evaluation.routes';
import thesisRoutes from './thesis.routes';
import panelistRoutes from "./panelist.routes";
import settingsRoutes from "./settings.routes";

const router = Router();

router.use('/auth', authRoutes);
router.use('/programs', programRoutes);
router.use('/applicant', applicantRoutes);
router.use('/exam', examRoutes);
router.use('/cor', corRoutes);
router.use('/student', studentRoutes);
router.use('/evaluation', evaluationRoutes);
router.use('/thesis', thesisRoutes);
router.use('/panelists', panelistRoutes);
router.use('/settings', settingsRoutes);

export default router;