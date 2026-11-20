import { Router } from "express";
import { emailController } from "../controllers/email.controller";
import {
  authenticateJWT,
  requireAdminCapability,
  requireRole,
} from "../middlewares/auth.middleware";

const router = Router();

router.use(authenticateJWT);
router.use(requireRole(["ADMIN"]));
router.use(requireAdminCapability("settings.manage"));

// Health, SMTP Verification & Test Dispatch
router.get("/health", emailController.getHealth);
router.post("/verify-smtp", emailController.verifySmtp);
router.post("/test", emailController.sendTestEmail);

// Delivery Logs & Retry
router.get("/logs", emailController.getEmailLogs);
router.post("/logs/retry-failed", emailController.retryAllFailed);
router.get("/logs/:id", emailController.getEmailLogDetail);
router.post("/logs/:id/retry", emailController.retryEmailLog);

// Template Management
router.get("/templates", emailController.listTemplates);
router.put("/templates/:key", emailController.updateTemplate);
router.post("/templates/:key/preview", emailController.previewTemplate);
router.post("/templates/:key/reset", emailController.resetTemplate);

// Automated Triggers & Manual Reminder Check
router.get("/triggers", emailController.listAutomatedTriggers);
router.post("/triggers/run-exam-reminders", emailController.runExamRemindersNow);

export default router;
