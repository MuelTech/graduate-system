import { Router } from "express";
import { PanelistController } from "../controllers/panelist.controller";
import { authenticateJWT, requireRole } from '../middlewares/auth.middleware';

const router = Router();
const controller = new PanelistController();

// Global Auth requirement
router.use(authenticateJWT);

// Panelist self-service routes
router.get("/me", requireRole(["PANELIST"]), controller.getMe.bind(controller));
router.patch("/me/availability", requireRole(["PANELIST"]), controller.toggleAvailability.bind(controller));

export default router;
