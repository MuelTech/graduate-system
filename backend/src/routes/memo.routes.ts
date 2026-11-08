import { requireOperationalCapability } from "../middlewares/operational-capability.middleware";
import { Router } from "express";
import { MemoController } from "../controllers/memo.controller";
import { authenticateJWT, requireRole } from "../middlewares/auth.middleware";
import { upload } from "../middlewares/upload.middleware";

const router = Router();
const controller = new MemoController();

router.use(authenticateJWT);

// Admin broadcasts memo (supports optional single PDF attachment)
router.post("/", requireRole(["ADMIN"]), requireOperationalCapability("memos.manage"), upload.single("attachment"), controller.createMemo);

// All authenticated roles fetch their memos
router.get("/", requireOperationalCapability("memos.manage", true), controller.getMemos);

// Admin archives/soft-deletes a memo
router.patch("/:id/archive", requireRole(["ADMIN"]), requireOperationalCapability("memos.manage"), controller.archiveMemo);

export default router;
