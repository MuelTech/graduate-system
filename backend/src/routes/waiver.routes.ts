import { requireAdmissionStudentCapability } from "../middlewares/admission-student-capability.middleware";
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
router.get("/", authenticateJWT, requireRole(["ADMIN"]), requireAdmissionStudentCapability("waivers.view"), getAdminWaiverQueue);
router.put("/:id/validate", authenticateJWT, requireRole(["ADMIN"]), requireAdmissionStudentCapability("waivers.manage"), validateWaiver);
router.put("/:id/reject", authenticateJWT, requireRole(["ADMIN"]), requireAdmissionStudentCapability("waivers.manage"), rejectWaiver);

export default router;
