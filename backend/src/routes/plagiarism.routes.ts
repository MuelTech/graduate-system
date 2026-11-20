import { Router } from 'express';
import { PlagiarismController } from '../controllers/plagiarism.controller';
import { authenticateJWT, requireRole } from '../middlewares/auth.middleware';

const router = Router();
const controller = new PlagiarismController();

// Connectivity diagnostic / health check (Admin, Faculty, Student)
router.get(
  '/health',
  authenticateJWT,
  controller.testConnection
);

// Student portal current status
router.get(
  '/my-status',
  authenticateJWT,
  requireRole(['STUDENT']),
  controller.getMyStatus
);

// Submit manuscript to StrikePlagiarism
router.post(
  '/:thesisId/submit',
  authenticateJWT,
  requireRole(['STUDENT', 'FACULTY', 'PANELIST', 'ADMIN']),
  controller.submitForCheck
);

// Check document status from StrikePlagiarism
router.get(
  '/status/:documentId',
  authenticateJWT,
  controller.getDocumentStatus
);

// Sync and finalize completed result into system database
router.post(
  '/:thesisId/sync/:documentId',
  authenticateJWT,
  requireRole(['STUDENT', 'FACULTY', 'PANELIST', 'ADMIN']),
  controller.syncResult
);

// StrikePlagiarism automated webhook callback
router.post(
  '/callback',
  controller.handleWebhookCallback
);

export default router;
