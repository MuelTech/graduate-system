import { Router } from "express";
import { SettingsController } from "../controllers/settings.controller";
import { authenticateJWT, requireRole } from '../middlewares/auth.middleware';

const router = Router();
const controller = new SettingsController();

// Protect ALL routes below this line
router.use(authenticateJWT);
router.use(requireRole(["ADMIN"]));

// System Settings Routes
router.get("/", controller.getAllSettings.bind(controller));
router.put("/:key", controller.updateSetting.bind(controller));

// Email Templates Routes
router.get("/email-templates", controller.getAllEmailTemplates.bind(controller));
router.put("/email-templates/:key", controller.updateEmailTemplate.bind(controller));

// Audit Logs Route (Read-Only)
router.get("/audit-logs", controller.getAuditLogs.bind(controller));

export default router;