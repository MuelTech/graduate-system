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

// Record a comprehensive exam attempt (Manual §7.15.4 3-attempt rule)
router.put(
  "/:id/comprehensive-exam",
  authenticateJWT,
  requireRole(["ADMIN"]),
  requireAdminCapability("students.manage"),
  controller.recordCompExamAttempt,
);

// Audited correction of the latest graded comprehensive exam attempt
router.patch(
  "/:id/comprehensive-exam/latest",
  authenticateJWT,
  requireRole(["ADMIN"]),
  requireAdminCapability("students.manage"),
  controller.correctLatestCompExamAttempt,
);

// Comprehensive exam certification foundation metadata
router.get(
  "/:id/comprehensive-exam/certificate",
  authenticateJWT,
  requireRole(["ADMIN"]),
  requireAdminCapability("students.manage"),
  controller.getCompExamCertificateFoundation,
);

// Update student profile / academic record with audit reason
router.patch(
  "/:id",
  authenticateJWT,
  requireRole(["ADMIN"]),
  requireAdminCapability("students.manage"),
  controller.updateStudent,
);

// Reset student password (default LAST NAME ALL CAPS + mustChangePassword)
router.post(
  "/:id/reset-password",
  authenticateJWT,
  requireRole(["ADMIN"]),
  requireAdminCapability("students.manage"),
  controller.resetStudentPassword,
);

// Curriculum Checklist / Plan of Coursework (Admin review, encoding, verification, version shift)
router.get(
  "/:id/curriculum",
  authenticateJWT,
  requireRole(["ADMIN"]),
  requireAdminCapability("students.manage"),
  controller.getStudentCurriculum,
);

router.patch(
  "/:id/curriculum/version",
  authenticateJWT,
  requireRole(["ADMIN"]),
  requireAdminCapability("students.manage"),
  controller.assignStudentCurriculumVersion,
);

router.put(
  "/:id/curriculum/courses/:courseId",
  authenticateJWT,
  requireRole(["ADMIN"]),
  requireAdminCapability("students.manage"),
  controller.updateStudentCourseProgress,
);

router.post(
  "/:id/curriculum/verify-all",
  authenticateJWT,
  requireRole(["ADMIN"]),
  requireAdminCapability("students.manage"),
  controller.verifyAllStudentCourses,
);

router.put(
  "/:id/curriculum/publication",
  authenticateJWT,
  requireRole(["ADMIN"]),
  requireAdminCapability("students.manage"),
  controller.updateStudentPublicationMilestone,
);

export default router;
