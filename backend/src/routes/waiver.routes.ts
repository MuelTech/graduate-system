import { Router } from "express";
import { authenticateJWT } from "../middlewares/auth.middleware";
import { requireRole } from "../middlewares/auth.middleware";
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
router.get("/", authenticateJWT, requireRole(["ADMIN"]), getAdminWaiverQueue);
router.put("/:id/validate", authenticateJWT, requireRole(["ADMIN"]), validateWaiver);
router.put("/:id/reject", authenticateJWT, requireRole(["ADMIN"]), rejectWaiver);

export default router;
