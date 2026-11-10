import { Router } from "express";
import { StorageHealthController } from "../controllers/storage-health.controller";
import {
  authenticateJWT,
  requireRole,
  requireAdminCapability,
} from "../middlewares/auth.middleware";

const router = Router();
const controller = new StorageHealthController();

router.use(authenticateJWT, requireRole(["ADMIN"]), requireAdminCapability("settings.manage"));

router.get("/health", controller.getHealth);
router.post("/integrity-scan", controller.runIntegrityScan);

export default router;
