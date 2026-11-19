import { Router } from "express";
import { StudentController } from "../controllers/student.controller";
import {
  authenticateJWT,
  requireAdminCapability,
  requireRole,
} from "../middlewares/auth.middleware";
const router = Router();
const studentController = new StudentController();
// STUDENT ONLY: Fetch their own academic journey pipeline
router.get(
  "/journey",
  authenticateJWT,
  requireRole(["STUDENT"]),
  studentController.getJourney,
);
// STUDENT ONLY: Fetch Written Comprehensive Exam certification foundation
router.get(
  "/comprehensive-exam/certificate",
  authenticateJWT,
  requireRole(["STUDENT"]),
  studentController.getCompExamCertificateFoundation,
);
// ADMIN ONLY: Record a Comprehensive Exam attempt (delegates to 3-attempt policy)
router.post(
  "/:id/comprehensive-exam",
  authenticateJWT,
  requireRole(["ADMIN"]),
  requireAdminCapability("students.manage"),
  studentController.updateCompExam,
);
export default router;
