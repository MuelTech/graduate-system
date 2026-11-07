import { requireExamAdministrationCapability } from "../middlewares/exam-administration-capability.middleware";
import { Router } from "express";
import { ExamEngineController } from "../controllers/exam-engine.controller";
import { ExamMediaController } from "../controllers/exam-media.controller";
import { authenticateJWT, requireRole } from '../middlewares/auth.middleware';
import { secureUpload } from '../storage/secure-upload';
import { AppError } from '../utils/AppError';
import type { ErrorRequestHandler } from 'express';
import { ExamConfigurationController } from '../controllers/exam-configuration.controller';
import { ExamQuestionSetController } from '../controllers/exam-question-set.controller';
import { ExamExecutionController } from '../controllers/exam-execution.controller';

const router = Router();
const controller = new ExamEngineController();
const mediaController = new ExamMediaController();
const configurationController = new ExamConfigurationController();
const questionSetController = new ExamQuestionSetController();
const executionController = new ExamExecutionController();
router.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Pragma', 'no-cache');
    next();
});

router.get('/media/:mediaId', (_req, res, next) => {
    // Apply to successful bytes and authorization/error responses alike.
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    next();
}, authenticateJWT, requireRole(['ADMIN', 'APPLICANT']), requireExamAdministrationCapability("exam.questions.view", true), mediaController.getContent);

// APPLICANT ROUTES
const retired = (_req: unknown, res: import('express').Response) => { res.status(409).json({ error: 'Reload the examination page to use the exact application and server-owned start.' }); };
router.get('/questions', authenticateJWT, requireRole(['APPLICANT']), retired);
router.patch('/autosave', authenticateJWT, requireRole(['APPLICANT']), retired);
router.post('/submit', authenticateJWT, requireRole(['APPLICANT']), retired);
router.get('/execution', authenticateJWT, requireRole(['APPLICANT']), executionController.current);
router.get('/applications/:applicationId/execution', authenticateJWT, requireRole(['APPLICANT']), executionController.read);
router.post('/applications/:applicationId/start', authenticateJWT, requireRole(['APPLICANT']), executionController.start);
router.get('/applications/:applicationId/questions', authenticateJWT, requireRole(['APPLICANT']), controller.getQuestionsForApplicant);
router.get('/applications/:applicationId/drafts', authenticateJWT, requireRole(['APPLICANT']), controller.readDrafts);
router.patch('/applications/:applicationId/drafts', authenticateJWT, requireRole(['APPLICANT']), controller.autoSaveAnswer);
router.patch('/applications/:applicationId/autosave', authenticateJWT, requireRole(['APPLICANT']), controller.autoSaveAnswer);
router.get('/applications/:applicationId/finalization', authenticateJWT, requireRole(['APPLICANT']), controller.readFinalization);
router.post('/applications/:applicationId/submit', authenticateJWT, requireRole(['APPLICANT']), controller.submitAnswers);

// ADMIN ROUTES
router.get('/admin/applications/:applicationId/execution', authenticateJWT, requireRole(['ADMIN']), requireExamAdministrationCapability("exam.records.view"), executionController.adminRead);
router.post('/admin/applications/:applicationId/start-authorization', authenticateJWT, requireRole(['ADMIN']), requireExamAdministrationCapability("exam.starts.authorize"), executionController.authorize);
router.get('/admin/question-set', authenticateJWT, requireRole(['ADMIN']), requireExamAdministrationCapability("exam.questions.view"), questionSetController.getCurrent);
router.put('/admin/question-set', authenticateJWT, requireRole(['ADMIN']), requireExamAdministrationCapability("exam.questions.manage"), questionSetController.replaceSelection);
router.post('/admin/question-set/publish', authenticateJWT, requireRole(['ADMIN']), requireExamAdministrationCapability("exam.questions.manage"), questionSetController.publish);
router.get('/admin/configuration', authenticateJWT, requireRole(['ADMIN']), requireExamAdministrationCapability("exam.configuration.manage"), configurationController.getCurrent);
router.put('/admin/configuration', authenticateJWT, requireRole(['ADMIN']), requireExamAdministrationCapability("exam.configuration.manage"), configurationController.replaceCurrent);
const mediaUploadError: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
    const status = error instanceof AppError && error.statusCode === 413 ? 413 : 400;
    res.setHeader('Cache-Control', 'private, no-store');
    res.status(status).json({ error: status === 413 ? 'Image exceeds the allowed size.' : 'Upload one valid PNG or JPEG image.' });
};
router.post('/admin/media', authenticateJWT, requireRole(['ADMIN']), requireExamAdministrationCapability("exam.questions.manage"), secureUpload('exam-media').single('file'), mediaController.upload, mediaUploadError);
router.get('/admin/questions', authenticateJWT, requireRole(['ADMIN']), requireExamAdministrationCapability("exam.questions.view"), controller.getAllQuestionsForAdmin);
router.post('/admin/questions', authenticateJWT, requireRole(['ADMIN']), requireExamAdministrationCapability("exam.questions.manage"), controller.createQuestion);
router.put('/admin/questions/:id', authenticateJWT, requireRole(['ADMIN']), requireExamAdministrationCapability("exam.questions.manage"), controller.updateQuestion);
router.delete('/admin/questions/:id', authenticateJWT, requireRole(['ADMIN']), requireExamAdministrationCapability("exam.questions.manage"), controller.deleteQuestion);

export default router;
