import { Router } from "express";
import { AdminPanelistController } from "../controllers/admin-panelist.controller";
import { authenticateJWT, requireRole } from '../middlewares/auth.middleware';

const router = Router();
const controller = new AdminPanelistController();

// Admin-only CRUD routes
router.get("/", requireRole(["ADMIN"]), controller.getAllPanelists.bind(controller));
router.get("/:id", requireRole(["ADMIN"]), controller.getPanelistById.bind(controller));
router.post("/", requireRole(["ADMIN"]), controller.createPanelist.bind(controller));
router.put("/:id", requireRole(["ADMIN"]), controller.updatePanelist.bind(controller));

export default router;
