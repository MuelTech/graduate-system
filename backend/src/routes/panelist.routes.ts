import { Router } from "express";
import { PanelistController } from "../controllers/panelist.controller";
import { authenticateJWT, requireRole } from '../middlewares/auth.middleware';

const router = Router();
const controller = new PanelistController();

// Global Auth requirement
router.use(authenticateJWT);

// Panelist self-service routes (MUST come before /:id to avoid route capture)
router.get("/me", requireRole(["PANELIST"]), controller.getMe.bind(controller));
router.patch("/me/availability", requireRole(["PANELIST"]), controller.toggleAvailability.bind(controller));

// Admin-only CRUD routes
router.get("/", requireRole(["ADMIN"]), controller.getAllPanelists.bind(controller));
router.post("/", requireRole(["ADMIN"]), controller.createPanelist.bind(controller));
router.get("/:id", requireRole(["ADMIN"]), controller.getPanelistById.bind(controller));
router.put("/:id", requireRole(["ADMIN"]), controller.updatePanelist.bind(controller));

export default router;