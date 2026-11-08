import { Router } from "express";
import { AuthController } from "../controllers/auth.controller";
import { authenticateJWT } from "../middlewares/auth.middleware";

const router = Router();
const authController = new AuthController();

router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/me', (_req, res, next) => {
    // Include authentication/read failures in the self-access no-store contract.
    res.setHeader("Cache-Control", "no-store");
    next();
}, authenticateJWT, authController.currentAccount);
router.post('/change-password', authenticateJWT, authController.changePassword);

export default router;
