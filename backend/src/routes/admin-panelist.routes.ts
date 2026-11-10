import { Router } from "express";
import { AdminPanelistController } from "../controllers/admin-panelist.controller";
import { authenticateJWT, requireRole, requireAdminCapability } from '../middlewares/auth.middleware';

const router = Router();
const controller = new AdminPanelistController();

// Apply JWT authentication and Faculty Management capability guard to all routes
router.use(authenticateJWT, requireRole(["ADMIN"]), requireAdminCapability("faculty.manage"));

// Admin-only CRUD routes
router.get("/", controller.getAllPanelists.bind(controller));
router.get("/:id", controller.getPanelistById.bind(controller));
router.post("/", controller.createPanelist.bind(controller));
router.put("/:id", controller.updatePanelist.bind(controller));

export default router;
