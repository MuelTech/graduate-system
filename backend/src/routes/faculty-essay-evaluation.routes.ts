import { Router } from "express";
import { authenticateJWT } from "../middlewares/auth.middleware";
import { facultyEssayAuthorization } from "../access/faculty-essay-authorization";
import { FacultyEssayEvaluationController } from "../controllers/faculty-essay-evaluation.controller";
import { AppError } from "../utils/AppError";

const router = Router();
const controller = new FacultyEssayEvaluationController();
router.use(authenticateJWT);
router.use(async (req, res, next) => {
  res.setHeader("Cache-Control", "private, no-store");
  try {
    await facultyEssayAuthorization.assert((req as import("../middlewares/auth.middleware").AuthenticatedRequest).user?.userId ?? "");
    next();
  } catch (error) {
    const status = error instanceof AppError ? error.statusCode : 503;
    res.status(status).json({ error: status === 403 ? "Essay Evaluation access denied." : "Essay Evaluation is currently unavailable." });
  }
});
router.get("/", controller.queue);
router.get("/:id", controller.detail);
router.post("/:id/grade", controller.grade);
router.get("/:id/media/:mediaId/content", controller.image);
export default router;
