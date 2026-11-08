import { requireFacultyCapability } from "../middlewares/faculty-capability.middleware";
import { Router } from "express";
import { AdminPanelistController } from "../controllers/admin-panelist.controller";
import { authenticateJWT, requireRole } from '../middlewares/auth.middleware';

const router = Router();
const controller = new AdminPanelistController();

// Apply JWT authentication to all routes
router.use(authenticateJWT);

// Admin-only CRUD routes
router.get("/", requireRole(["ADMIN"]), requireFacultyCapability("faculty.view"), controller.getAllPanelists.bind(controller));
router.get("/:id", requireRole(["ADMIN"]), requireFacultyCapability("faculty.view"), controller.getPanelistById.bind(controller));
router.post("/", requireRole(["ADMIN"]), requireFacultyCapability("faculty.manage"), controller.createPanelist.bind(controller));
router.put("/:id", requireRole(["ADMIN"]), requireFacultyCapability("faculty.manage"), controller.updatePanelist.bind(controller));

export default router;
