import { requireOperationalCapability } from "../middlewares/operational-capability.middleware";
import { Router } from "express";
import { emailController } from "../controllers/email.controller";
import { authenticateJWT, requireRole } from "../middlewares/auth.middleware";

const router = Router();

// ADMIN: Fetch email history
router.get("/logs", authenticateJWT, requireRole(["ADMIN"]), requireOperationalCapability("email.logs.view"), emailController.getEmailLogs);

export default router;