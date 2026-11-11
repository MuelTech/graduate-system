import { Router } from "express";
import { AdminAdministratorController } from "../controllers/admin-administrator.controller";
import { authenticateJWT, requireRole, requireFullAdmin } from "../middlewares/auth.middleware";

const router = Router();
const controller = new AdminAdministratorController();

// Full Administrator authority is required for all Administrator Management operations
router.use(authenticateJWT, requireRole(["ADMIN"]), requireFullAdmin);

router.get("/", controller.getAllAdministrators.bind(controller));
router.get("/:id", controller.getAdministratorById.bind(controller));
router.post("/", controller.createAdministrator.bind(controller));
router.put("/:id", controller.updateAdministrator.bind(controller));

export default router;
