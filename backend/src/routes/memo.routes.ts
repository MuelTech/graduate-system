import { Router } from "express";
import { MemoController } from "../controllers/memo.controller";
import { authenticateJWT, requireRole } from "../middlewares/auth.middleware";
import { upload } from "../middlewares/upload.middleware";

const router = Router();
const controller = new MemoController();

router.use(authenticateJWT);

// Admin broadcasts memo (supports optional single PDF attachment)
router.post("/", requireRole(["ADMIN"]), upload.single("attachment"), controller.createMemo);

// All authenticated roles fetch their memos
router.get("/", controller.getMemos);

// Admin archives/soft-deletes a memo
router.patch("/:id/archive", requireRole(["ADMIN"]), controller.archiveMemo);

export default router;
