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

// Validate waiver
router.put(
  "/:id/waiver/validate",
  authenticateJWT,
  requireRole(["ADMIN"]),
  requireAdminCapability("waivers.manage"),
  controller.validateWaiver
);

// Reject waiver
router.put(
  "/:id/waiver/reject",
  authenticateJWT,
  requireRole(["ADMIN"]),
  requireAdminCapability("waivers.manage"),
  controller.rejectWaiver
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

export default router;
