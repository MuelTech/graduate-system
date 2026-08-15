import { Router } from "express";
import { emailController } from "../controllers/email.controller";
import { authenticateJWT, requireRole } from "../middlewares/auth.middleware";

const router = Router();

// ADMIN: Fetch email history
router.get("/logs", authenticateJWT, requireRole(["ADMIN"]), emailController.getEmailLogs);

export default router;