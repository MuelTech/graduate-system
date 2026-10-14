import { Router } from "express";
import { StorageHealthController } from "../controllers/storage-health.controller";
import { authenticateJWT, requireRole } from "../middlewares/auth.middleware";

/**
 * DL-11: ADMIN-only read-only storage operations.
 *
 *   GET  /api/admin/storage/health
 *   POST /api/admin/storage/integrity-scan   (read-only despite POST)
 *
 * There is deliberately no public storage health endpoint.
 */

const router = Router();
const controller = new StorageHealthController();

router.get(
  "/health",
  authenticateJWT,
  requireRole(["ADMIN"]),
  controller.getHealth,
);
router.post(
  "/integrity-scan",
  authenticateJWT,
  requireRole(["ADMIN"]),
  controller.runIntegrityScan,
);

export default router;
