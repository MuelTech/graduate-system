// backend/src/routes/evaluation.routes.ts
import { Router } from 'express';
import { EvaluationController } from '../controllers/evaluation.controller';
import { authenticateJWT, requireRole } from '../middlewares/auth.middleware';
import { upload } from '../middlewares/upload.middleware';

const router = Router();
const evalController = new EvaluationController();

// STUDENT ONLY: Upload instrument (expecting a file field named 'instrument')
router.post(
  '/request', 
  authenticateJWT, 
  requireRole(['STUDENT']), 
  upload.single('instrument'), 
  evalController.submitRequest
);

// ADMIN ONLY: Assign an expert to a request
router.post(
  '/:id/assign', 
  authenticateJWT, 
  requireRole(['ADMIN']), 
  evalController.assignExpert
);

export default router;
