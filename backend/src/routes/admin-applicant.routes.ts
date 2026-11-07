import { requireAdmissionStudentCapability } from "../middlewares/admission-student-capability.middleware";
import { Router } from "express";
import { AdminApplicantController } from "../controllers/admin-applicant.controller";
import { authenticateJWT, requireRole } from "../middlewares/auth.middleware";

const router = Router();
const controller = new AdminApplicantController();

// List all applicants
router.get(
  "/",
  authenticateJWT,
  requireRole(["ADMIN"]),
  requireAdmissionStudentCapability("applicants.view"),
  controller.listApplicants
);

// Get applicant detail
router.get(
  "/:id",
  authenticateJWT,
  requireRole(["ADMIN"]),
  requireAdmissionStudentCapability("applicants.view"),
  controller.getApplicantDetail
);

// Validate waiver
router.put(
  "/:id/waiver/validate",
  authenticateJWT,
  requireRole(["ADMIN"]),
  requireAdmissionStudentCapability("waivers.manage"),
  controller.validateWaiver
);

// Reject waiver
router.put(
  "/:id/waiver/reject",
  authenticateJWT,
  requireRole(["ADMIN"]),
  requireAdmissionStudentCapability("waivers.manage"),
  controller.rejectWaiver
);

// Verify COR
router.put(
  "/:id/cor/verify",
  authenticateJWT,
  requireRole(["ADMIN"]),
  requireAdmissionStudentCapability("cor.verify"),
  controller.verifyCor
);

// Reject COR
router.put(
  "/:id/cor/reject",
  authenticateJWT,
  requireRole(["ADMIN"]),
  requireAdmissionStudentCapability("cor.verify"),
  controller.rejectCor
);

// Promote to student
router.put(
  "/:id/promote",
  authenticateJWT,
  requireRole(["ADMIN"]),
  requireAdmissionStudentCapability("cor.verify"),
  controller.promoteToStudent
);

export default router;
