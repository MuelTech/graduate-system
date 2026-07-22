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
  controller.listStudents
);

// Get student detail
router.get(
  "/:id",
  authenticateJWT,
  requireRole(["ADMIN"]),
  controller.getStudentDetail
);

// Update comprehensive exam status
router.put(
  "/:id/comprehensive-exam",
  authenticateJWT,
  requireRole(["ADMIN"]),
  controller.updateCompExamStatus
);

export default router;
