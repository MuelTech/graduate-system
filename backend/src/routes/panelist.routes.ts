import { Router } from "express";
import { PanelistController } from "../controllers/panelist.controller";
import { authenticateJWT, requireRole } from '../middlewares/auth.middleware';

const router = Router();
const controller = new PanelistController();

router.use(authenticateJWT);
router.use(requireRole(["ADMIN"]));

router.get("/", controller.getAllPanelists.bind(controller));
router.post("/", controller.createPanelist.bind(controller));
router.put("/:id", controller.updatePanelist.bind(controller));

export default router;