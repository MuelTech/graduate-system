import { Router } from 'express';
import { CorController } from '../controllers/cor.controller';
import { authenticateJWT, requireRole } from '../middlewares/auth.middleware';
import { upload } from '../middlewares/upload.middleware';

const router = Router();
const corController = new CorController();

// Applicant Routes
router.post('/upload', authenticateJWT, requireRole(['APPLICANT']), upload.single('file'), corController.uploadCor);
router.get('/my-upload', authenticateJWT, requireRole(['APPLICANT']), corController.getMyUpload);

// Admin Routes
router.get('/pending', authenticateJWT, requireRole(['ADMIN']), corController.getPendingUploads);
router.post('/verify/:id', authenticateJWT, requireRole(['ADMIN']), corController.verifyCor);

export default router;
