import { Router } from "express";
import { StudentController } from "../controllers/student.controller";
import { authenticateJWT, requireRole } from "../middlewares/auth.middleware";
const router = Router();
const studentController = new StudentController();
// STUDENT ONLY: Fetch their own academic journey pipeline
router.get(
  "/journey",
  authenticateJWT,
  requireRole(["STUDENT"]),
  studentController.getJourney,
);
// ADMIN ONLY: Update a specific student's Comprehensive Exam status
router.post(
  "/:id/comprehensive-exam",
  authenticateJWT,
  requireRole(["ADMIN"]),
  studentController.updateCompExam,
);
export default router;
