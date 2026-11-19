import { Router } from "express";
import { AdminApplicantController } from "../controllers/admin-applicant.controller";
import {
  authenticateJWT,
  requireRole,
  requireAdminCapability,
} from "../middlewares/auth.middleware";

const router = Router();
const controller = new AdminApplicantController();

// List all applicants
router.get(
  "/",
  authenticateJWT,
  requireRole(["ADMIN"]),
  requireAdminCapability("applicants.manage"),
  controller.listApplicants
);

// Get applicant detail
router.get(
  "/:id",
  authenticateJWT,
  requireRole(["ADMIN"]),
  requireAdminCapability("applicants.manage"),
  controller.getApplicantDetail
);

// Verify COR
router.put(
  "/:id/cor/verify",
  authenticateJWT,
  requireRole(["ADMIN"]),
  requireAdminCapability("cor.verify"),
  controller.verifyCor
);

// Reject COR
router.put(
  "/:id/cor/reject",
  authenticateJWT,
  requireRole(["ADMIN"]),
  requireAdminCapability("cor.verify"),
  controller.rejectCor
);

// Promote to student
router.put(
  "/:id/promote",
  authenticateJWT,
  requireRole(["ADMIN"]),
  requireAdminCapability("applicants.manage"),
  controller.promoteToStudent
);

// Update applicant details
router.patch(
  "/:id",
  authenticateJWT,
  requireRole(["ADMIN"]),
  requireAdminCapability("applicants.manage"),
  controller.updateApplicant
);

// Reset applicant password (default LAST NAME ALL CAPS + mustChangePassword)
router.post(
  "/:id/reset-password",
  authenticateJWT,
  requireRole(["ADMIN"]),
  requireAdminCapability("applicants.manage"),
  controller.resetApplicantPassword
);

// Guarded delete applicant (only when no exam attempt / COR verification exists)
router.delete(
  "/:id",
  authenticateJWT,
  requireRole(["ADMIN"]),
  requireAdminCapability("applicants.manage"),
  controller.deleteApplicant
);

export default router;
