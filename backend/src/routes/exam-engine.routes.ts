import { Router } from "express";
import { ExamEngineController } from "../controllers/exam-engine.controller";
import { ExamMediaController } from "../controllers/exam-media.controller";
import { authenticateJWT, requireRole } from '../middlewares/auth.middleware';
import { secureUpload } from '../storage/secure-upload';
import { AppError } from '../utils/AppError';
import type { ErrorRequestHandler } from 'express';

const router = Router();
const controller = new ExamEngineController();
const mediaController = new ExamMediaController();

router.get('/media/:mediaId', (_req, res, next) => {
    // Apply to successful bytes and authorization/error responses alike.
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    next();
}, authenticateJWT, requireRole(['ADMIN', 'APPLICANT']), mediaController.getContent);

// APPLICANT ROUTES
router.get('/questions', authenticateJWT, requireRole(['APPLICANT']), controller.getQuestionsForApplicant);
router.patch('/autosave', authenticateJWT, requireRole(['APPLICANT']), controller.autoSaveAnswer);
router.post('/submit', authenticateJWT, requireRole(['APPLICANT']), controller.submitAnswers);

// ADMIN ROUTES
const mediaUploadError: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
    const status = error instanceof AppError && error.statusCode === 413 ? 413 : 400;
    res.setHeader('Cache-Control', 'private, no-store');
    res.status(status).json({ error: status === 413 ? 'Image exceeds the allowed size.' : 'Upload one valid PNG or JPEG image.' });
};
router.post('/admin/media', authenticateJWT, requireRole(['ADMIN']), secureUpload('exam-media').single('file'), mediaController.upload, mediaUploadError);
router.get('/admin/questions', authenticateJWT, requireRole(['ADMIN']), controller.getAllQuestionsForAdmin);
router.post('/admin/questions', authenticateJWT, requireRole(['ADMIN']), controller.createQuestion);
router.put('/admin/questions/:id', authenticateJWT, requireRole(['ADMIN']), controller.updateQuestion);
router.delete('/admin/questions/:id', authenticateJWT, requireRole(['ADMIN']), controller.deleteQuestion);

export default router;
