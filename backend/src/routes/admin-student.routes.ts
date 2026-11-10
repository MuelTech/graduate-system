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

router.use(authenticateJWT, requireRole(["ADMIN"]), requireAdminCapability("students.manage"));

// List all students
router.get("/", controller.listStudents);

// Get student detail
router.get("/:id", controller.getStudentDetail);

// Get the student's authoritative Thesis Journey (ADMIN read-only)
router.get("/:id/journey", controller.getStudentJourney);

// Update comprehensive exam status
router.put("/:id/comprehensive-exam", controller.updateCompExamStatus);

export default router;
