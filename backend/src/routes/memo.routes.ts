import { Router } from "express";
import { MemoController } from "../controllers/memo.controller";
import { authenticateJWT, requireRole } from "../middlewares/auth.middleware";

const router = Router();
const controller = new MemoController();

router.use(authenticateJWT);
router.post("/", requireRole(["ADMIN"]), controller.createMemo);
router.get("/", controller.getMemos);

export default router;