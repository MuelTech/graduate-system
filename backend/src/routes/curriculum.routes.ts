import { Router } from "express";
import { CurriculumController } from "../controllers/curriculum.controller";
import {
  authenticateJWT,
  requireAdminCapability,
  requireAnyAdminCapability,
  requireRole,
} from "../middlewares/auth.middleware";

const router = Router();
const controller = new CurriculumController();

// Admin lookup for Students, Settings, and COR Verification modules
router.get(
  "/programs/:programId/versions",
  authenticateJWT,
  requireRole(["ADMIN"]),
  requireAnyAdminCapability(["students.manage", "settings.manage", "cor.verify"]),
  controller.listProgramVersions,
);

// Admin Curriculum Master management (System Settings)
router.get(
  "/admin",
  authenticateJWT,
  requireRole(["ADMIN"]),
  requireAdminCapability("settings.manage"),
  controller.listVersions,
);

router.get(
  "/admin/:versionId",
  authenticateJWT,
  requireRole(["ADMIN"]),
  requireAdminCapability("settings.manage"),
  controller.getVersion,
);

router.post(
  "/admin",
  authenticateJWT,
  requireRole(["ADMIN"]),
  requireAdminCapability("settings.manage"),
  controller.createVersion,
);

router.put(
  "/admin/:versionId",
  authenticateJWT,
  requireRole(["ADMIN"]),
  requireAdminCapability("settings.manage"),
  controller.updateVersion,
);

router.post(
  "/admin/:versionId/groups",
  authenticateJWT,
  requireRole(["ADMIN"]),
  requireAdminCapability("settings.manage"),
  controller.createGroup,
);

router.put(
  "/admin/groups/:groupId",
  authenticateJWT,
  requireRole(["ADMIN"]),
  requireAdminCapability("settings.manage"),
  controller.updateGroup,
);

router.delete(
  "/admin/groups/:groupId",
  authenticateJWT,
  requireRole(["ADMIN"]),
  requireAdminCapability("settings.manage"),
  controller.deleteGroup,
);

router.post(
  "/admin/groups/:groupId/courses",
  authenticateJWT,
  requireRole(["ADMIN"]),
  requireAdminCapability("settings.manage"),
  controller.createCourse,
);

router.put(
  "/admin/courses/:courseId",
  authenticateJWT,
  requireRole(["ADMIN"]),
  requireAdminCapability("settings.manage"),
  controller.updateCourse,
);

router.delete(
  "/admin/courses/:courseId",
  authenticateJWT,
  requireRole(["ADMIN"]),
  requireAdminCapability("settings.manage"),
  controller.deleteCourse,
);

export default router;
