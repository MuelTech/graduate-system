import { Router } from "express";
import { AdminDashboardController } from "../controllers/admin-dashboard.controller";
import { authenticateJWT, requireRole } from "../middlewares/auth.middleware";

const router = Router();
const controller = new AdminDashboardController();

// Only ADMIN users can access this dashboard data
router.get("/", authenticateJWT, requireRole(["ADMIN"]), controller.getDashboard);

export default router;
