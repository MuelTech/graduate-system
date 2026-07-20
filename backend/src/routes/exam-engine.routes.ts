import { Router } from "express";
import { ExamEngineController } from "../controllers/exam-engine.controller";
import { authenticateJWT, requireRole } from '../middlewares/auth.middleware';

const router = Router();
const controller = new ExamEngineController();

// APPLICANT ROUTES
router.get('/questions', authenticateJWT, requireRole(['APPLICANT']), controller.getQuestionsForApplicant);
router.patch('/autosave', authenticateJWT, requireRole(['APPLICANT']), controller.autoSaveAnswer);
router.post('/submit', authenticateJWT, requireRole(['APPLICANT']), controller.submitAnswers);

// ADMIN ROUTES
router.get('/admin/questions', authenticateJWT, requireRole(['ADMIN']), controller.getAllQuestionsForAdmin);
router.post('/admin/questions', authenticateJWT, requireRole(['ADMIN']), controller.createQuestion);
router.put('/admin/questions/:id', authenticateJWT, requireRole(['ADMIN']), controller.updateQuestion);
router.delete('/admin/questions/:id', authenticateJWT, requireRole(['ADMIN']), controller.deleteQuestion);

export default router;