import { Router } from 'express';
import { ThesisController } from '../controllers/thesis.controller';
import { authenticateJWT, requireRole } from '../middlewares/auth.middleware';
import { upload } from '../middlewares/upload.middleware';

const router = Router();
const thesisController = new ThesisController();

// 🔒 STUDENT ONLY: Title Defense (Expects file 'document' and fields 'title1', 'title2', 'title3')
router.post(
  '/defense/title', 
  authenticateJWT, 
  requireRole(['STUDENT']), 
  upload.single('document'), 
  thesisController.applyTitle
);

// 🔒 STUDENT ONLY: Proposal Defense (Expects file 'document')
router.post(
  '/defense/proposal', 
  authenticateJWT, 
  requireRole(['STUDENT']), 
  upload.single('document'), 
  thesisController.applyProposal
);

// 🔒 STUDENT ONLY: Final Defense (Expects file 'document')
router.post(
  '/defense/final', 
  authenticateJWT, 
  requireRole(['STUDENT']), 
  upload.single('document'), 
  thesisController.applyFinal
);

export default router;
