import { Router } from "express";
import { AuthController } from "../controllers/auth.controller";
import { authenticateJWT } from "../middlewares/auth.middleware";

const router = Router();
const authController = new AuthController();

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/change-password', authenticateJWT, authController.changePassword);
router.get('/me', authenticateJWT, authController.getMe);

export default router;