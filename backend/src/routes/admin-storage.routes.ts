import { Router } from "express";
import { StorageHealthController } from "../controllers/storage-health.controller";
import {
  authenticateJWT,
  requireRole,
  requireAdminCapability,
} from "../middlewares/auth.middleware";

const router = Router();
const controller = new StorageHealthController();

router.get(
  "/health",
  authenticateJWT,
  requireRole(["ADMIN"]),
  requireAdminCapability("settings.manage"),
  controller.getHealth,
);
router.post(
  "/integrity-scan",
  authenticateJWT,
  requireRole(["ADMIN"]),
  requireAdminCapability("settings.manage"),
  controller.runIntegrityScan,
);

export default router;
