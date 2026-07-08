import { Router, Request, Response, NextFunction } from "express";
import { DatabankController } from "../controllers/databank.controller";
import { authenticateJWT, requireRole } from "../middlewares/auth.middleware";
import jwt from "jsonwebtoken";

const router = Router();
const controller = new DatabankController();

// Custom inline optional auth for public routes (Does not block missing tokens)
const optionalAuthJWT = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return next();
  }

  try {
    const secret = process.env.JWT_SECRET || "";
    const decoded = jwt.verify(token, secret);
    (req as any).user = decoded;
    next();
  } catch (err) {
    // If token is invalid, we still let them through as an unauthenticated user
    next();
  }
};

// 1. Public & Hybrid Routes (Optional Auth)
router.get("/public", optionalAuthJWT, controller.searchPublic);
router.get("/public/:id", optionalAuthJWT, controller.getEntryById);

// 2. Protected Admin Routes
router.get("/", authenticateJWT, requireRole(["ADMIN"]), controller.getAllEntries);
router.put("/:id/approve", authenticateJWT, requireRole(["ADMIN"]), controller.approveAndPublish);
router.put("/:id/unpublish", authenticateJWT, requireRole(["ADMIN"]), controller.unpublish);
router.put("/:id/metadata", authenticateJWT, requireRole(["ADMIN"]), controller.editMetadata);

// 3. Protected Student Routes
router.post("/", authenticateJWT, requireRole(["STUDENT"]), controller.createEntry);

export default router;
