import { Router } from "express";
import {
  authenticateJWT,
  requireRole,
  requireAdminCapability,
} from "../middlewares/auth.middleware";
import {
  getMyWaiver,
  downloadWaiverForm,
  getAdminWaiverQueue,
  validateWaiver,
  rejectWaiver
} from "../controllers/waiver.controller";

const router = Router();

// Applicant Routes
router.get("/me", authenticateJWT, getMyWaiver);
router.get("/me/download", authenticateJWT, downloadWaiverForm);

// Admin Routes
router.get("/", authenticateJWT, requireRole(["ADMIN"]), requireAdminCapability("waivers.manage"), getAdminWaiverQueue);
router.put("/:id/validate", authenticateJWT, requireRole(["ADMIN"]), requireAdminCapability("waivers.manage"), validateWaiver);
router.put("/:id/reject", authenticateJWT, requireRole(["ADMIN"]), requireAdminCapability("waivers.manage"), rejectWaiver);

export default router;
