import { Response } from "express";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import { AdminDashboardService } from "../services/admin-dashboard.service";

export class AdminDashboardController {
  private dashboardService = new AdminDashboardService();

  getDashboard = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      const data = await this.dashboardService.getDashboardData();
      res.status(200).json(data);
    } catch (error: any) {
      console.error("Dashboard error:", error);
      res.status(500).json({ error: "Failed to load dashboard data." });
    }
  };
}
