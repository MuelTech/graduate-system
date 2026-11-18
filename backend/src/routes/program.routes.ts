import { Router } from "express";
import { ProgramController } from "../controllers/program.controller";
import {
  authenticateJWT,
  requireAdminCapability,
  requireRole,
} from "../middlewares/auth.middleware";

const router = Router();
const programController = new ProgramController();

// Public active Graduate School programs list
router.get("/", programController.getAllPrograms);

// Admin Program Master Data management (requires System Settings capability)
router.get(
  "/admin",
  authenticateJWT,
  requireRole(["ADMIN"]),
  requireAdminCapability("settings.manage"),
  programController.getAdminPrograms,
);

router.post(
  "/",
  authenticateJWT,
  requireRole(["ADMIN"]),
  requireAdminCapability("settings.manage"),
  programController.createProgram,
);

router.put(
  "/:id",
  authenticateJWT,
  requireRole(["ADMIN"]),
  requireAdminCapability("settings.manage"),
  programController.updateProgram,
);

router.patch(
  "/:id/status",
  authenticateJWT,
  requireRole(["ADMIN"]),
  requireAdminCapability("settings.manage"),
  programController.updateProgramStatus,
);

export default router;
