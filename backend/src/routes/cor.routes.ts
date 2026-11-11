import { Router } from 'express';
import { CorController } from '../controllers/cor.controller';
import { authenticateJWT, requireRole, requireAdminCapability } from '../middlewares/auth.middleware';
import { secureUpload } from '../middlewares/upload.middleware';

const router = Router();
const corController = new CorController();

// Applicant Routes
router.post('/upload', authenticateJWT, requireRole(['APPLICANT']), secureUpload('applicant-cor').single('file'), corController.uploadCor);
router.get('/my-upload', authenticateJWT, requireRole(['APPLICANT']), corController.getMyUpload);

// Admin Routes
router.get('/pending', authenticateJWT, requireRole(['ADMIN']), requireAdminCapability('cor.verify'), corController.getPendingUploads);
router.post('/verify/:id', authenticateJWT, requireRole(['ADMIN']), requireAdminCapability('cor.verify'), corController.verifyCor);
router.post('/reject/:id', authenticateJWT, requireRole(['ADMIN']), requireAdminCapability('cor.verify'), corController.rejectCor);

export default router;
