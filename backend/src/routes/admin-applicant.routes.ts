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
  controller.listApplicants
);

// Get applicant detail
router.get(
  "/:id",
  authenticateJWT,
  requireRole(["ADMIN"]),
  controller.getApplicantDetail
);

// Validate waiver
router.put(
  "/:id/waiver/validate",
  authenticateJWT,
  requireRole(["ADMIN"]),
  controller.validateWaiver
);

// Reject waiver
router.put(
  "/:id/waiver/reject",
  authenticateJWT,
  requireRole(["ADMIN"]),
  controller.rejectWaiver
);

// Verify COR
router.put(
  "/:id/cor/verify",
  authenticateJWT,
  requireRole(["ADMIN"]),
  controller.verifyCor
);

// Reject COR
router.put(
  "/:id/cor/reject",
  authenticateJWT,
  requireRole(["ADMIN"]),
  controller.rejectCor
);

// Promote to student
router.put(
  "/:id/promote",
  authenticateJWT,
  requireRole(["ADMIN"]),
  controller.promoteToStudent
);

export default router;
