import { ACADEMIC_ACCOUNT_ROLES } from "../utils/academic-account";
import { Router } from "express";
import { PanelistController } from "../controllers/panelist.controller";
import { authenticateJWT, requireRole } from '../middlewares/auth.middleware';

const router = Router();
const controller = new PanelistController();

// Global Auth requirement
router.use(authenticateJWT);

// Panelist self-service routes
router.get("/me", requireRole([...ACADEMIC_ACCOUNT_ROLES]), controller.getMe.bind(controller));
router.patch("/me/availability", requireRole([...ACADEMIC_ACCOUNT_ROLES]), controller.toggleAvailability.bind(controller));

export default router;
