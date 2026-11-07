import { requireAdmissionStudentCapability } from "../middlewares/admission-student-capability.middleware";
// backend/src/routes/admin-student.routes.ts

import { Router } from "express";
import { AdminStudentController } from "../controllers/admin-student.controller";
import { authenticateJWT, requireRole } from "../middlewares/auth.middleware";

const router = Router();
const controller = new AdminStudentController();

// List all students
router.get(
  "/",
  authenticateJWT,
  requireRole(["ADMIN"]),
  requireAdmissionStudentCapability("students.view"),
  controller.listStudents
);

// Get student detail
router.get(
  "/:id",
  authenticateJWT,
  requireRole(["ADMIN"]),
  requireAdmissionStudentCapability("students.view"),
  controller.getStudentDetail
);

// Get the student's authoritative Thesis Journey (ADMIN read-only)
router.get(
  "/:id/journey",
  authenticateJWT,
  requireRole(["ADMIN"]),
  requireAdmissionStudentCapability("students.view"),
  controller.getStudentJourney
);

// Update comprehensive exam status
router.put(
  "/:id/comprehensive-exam",
  authenticateJWT,
  requireRole(["ADMIN"]),
  requireAdmissionStudentCapability("students.comprehensive_exam.manage"),
  controller.updateCompExamStatus
);

export default router;
