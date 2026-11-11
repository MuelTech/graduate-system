// backend/src/routes/admin-student.routes.ts

import { Router } from "express";
import { AdminStudentController } from "../controllers/admin-student.controller";
import {
  authenticateJWT,
  requireRole,
  requireAdminCapability,
} from "../middlewares/auth.middleware";

const router = Router();
const controller = new AdminStudentController();

// List all students
router.get(
  "/",
  authenticateJWT,
  requireRole(["ADMIN"]),
  requireAdminCapability("students.manage"),
  controller.listStudents,
);

// Get student detail
router.get(
  "/:id",
  authenticateJWT,
  requireRole(["ADMIN"]),
  requireAdminCapability("students.manage"),
  controller.getStudentDetail,
);

// Get the student's authoritative Thesis Journey (ADMIN read-only)
router.get(
  "/:id/journey",
  authenticateJWT,
  requireRole(["ADMIN"]),
  requireAdminCapability("students.manage"),
  controller.getStudentJourney,
);

// Update comprehensive exam status
router.put(
  "/:id/comprehensive-exam",
  authenticateJWT,
  requireRole(["ADMIN"]),
  requireAdminCapability("students.manage"),
  controller.updateCompExamStatus,
);

export default router;
