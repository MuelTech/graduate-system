import { Router } from "express";
import { PanelistController } from "../controllers/panelist.controller";
import { authenticateJWT, requireRole } from '../middlewares/auth.middleware';

const router = Router();
const controller = new PanelistController();

// Global Auth requirement
router.use(authenticateJWT);

// Admin-only CRUD routes
router.get("/", requireRole(["ADMIN"]), controller.getAllPanelists.bind(controller));
router.post("/", requireRole(["ADMIN"]), controller.createPanelist.bind(controller));
router.put("/:id", requireRole(["ADMIN"]), controller.updatePanelist.bind(controller));

// Panelist self-service routes
router.patch("/me/availability", requireRole(["PANELIST"]), controller.toggleAvailability.bind(controller));
router.get("/me", requireRole(["PANELIST"]), controller.getMe.bind(controller));

export default router;