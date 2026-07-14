import { Router } from "express";
import { NotificationController } from "../controllers/notification.controller";
import { authenticateJWT } from "../middlewares/auth.middleware";

const router = Router();
const controller = new NotificationController();

router.use(authenticateJWT);
router.get("/", controller.getMyNotifications);
router.put("/:id/read", controller.markAsRead);

export default router;