import { Router } from 'express';
import authRoutes from './auth.routes';
import programRoutes from './program.routes';
import applicantRoutes from './applicant.routes';
import examRoutes from './exam.routes';
import corRoutes from './cor.routes'
import studentRoutes from './student.routes';
import evaluationRoutes from './evaluation.routes';
import thesisRoutes from './thesis.routes';
import panelistRoutes from './panelist.routes';
import settingsRoutes from './settings.routes';
import databankRoutes from './databank.routes';
import memoRoutes from './memo.routes';
import notificationRoutes from './notification.routes';
import waiverRoutes from './waiver.routes';
import adminApplicantRoutes from './admin-applicant.routes';
import examEngineRoutes from './exam-engine.routes';

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
router.use('/databank', databankRoutes);
router.use('/memos', memoRoutes);
router.use('/notifications', notificationRoutes);
router.use('/waivers', waiverRoutes);
router.use('/admin/applicants', adminApplicantRoutes);
router.use('/exam-engine', examEngineRoutes);

export default router;