import { requireOperationalCapability, excludeOperationalAction } from "../middlewares/operational-capability.middleware";
import { Router } from "express";
import { SettingsController } from "../controllers/settings.controller";
import { authenticateJWT, requireRole } from '../middlewares/auth.middleware';

const router = Router();
const controller = new SettingsController();

// Protect ALL routes below this line
router.use(authenticateJWT);
router.use(requireRole(["ADMIN"]));

// System Settings Routes
router.get("/", requireOperationalCapability("settings.view"), controller.getAllSettings.bind(controller));
router.put("/:key", requireOperationalCapability("settings.manage"), controller.updateSetting.bind(controller));

// Email Templates Routes
router.get("/email-templates", requireOperationalCapability("email.configuration.manage"), controller.getAllEmailTemplates.bind(controller));
router.put("/email-templates/:key", requireOperationalCapability("email.configuration.manage"), controller.updateEmailTemplate.bind(controller));

// Audit Logs Routes
router.get("/audit-logs", requireOperationalCapability("audit.view"), controller.getAuditLogs.bind(controller));
router.delete("/audit-logs/:id", excludeOperationalAction, controller.deleteAuditLog.bind(controller));
router.post("/audit-logs/delete", excludeOperationalAction, controller.deleteAuditLogs.bind(controller));

export default router;