// backend/src/routes/document.routes.ts
import { Router } from "express";
import { DocumentController } from "../controllers/document.controller";
import { authenticateJWT } from "../middlewares/auth.middleware";

const router = Router();
const documentController = new DocumentController();

router.use(authenticateJWT);

router.get("/:modelType/:id/file", documentController.getFile);

export default router;
