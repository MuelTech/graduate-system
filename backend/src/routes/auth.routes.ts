import { Router } from "express";
import { AuthController } from "../controllers/auth.controller";
import { authenticateJWT } from "../middlewares/auth.middleware";

const router = Router();
const authController = new AuthController();

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/forgot-password', authController.forgotPassword);
router.get('/reset-password/validate', authController.validateResetToken);
router.post('/reset-password', authController.resetPassword);
router.post('/change-password', authenticateJWT, authController.changePassword);
router.get('/me', authenticateJWT, authController.getMe);
router.get('/me/signature', authenticateJWT, authController.getMySignature);
router.put('/me/signature', authenticateJWT, authController.saveMySignature);
router.delete('/me/signature', authenticateJWT, authController.deleteMySignature);

export default router;