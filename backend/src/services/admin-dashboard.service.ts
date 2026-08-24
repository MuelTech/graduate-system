import { DashboardRepository } from "../repositories/admin-dashboard.repository";

export class AdminDashboardService {
  private dashboardRepo = new DashboardRepository();

  async getDashboardData() {
    // We use Promise.all to fetch all metrics concurrently for maximum speed
    const [
      activeStudents,
      pendingDefenses,
      pendingCORs,
      repositoryEntries,
      pipelineStages,
      pendingActions,
      recentActivity,
    ] = await Promise.all([
      this.dashboardRepo.getTotalActiveStudents(),
      this.dashboardRepo.getPendingDefenses(),
      this.dashboardRepo.getPendingCORs(),
      this.dashboardRepo.getRepositoryCount(),
      this.dashboardRepo.getPipelineStages(),
      this.dashboardRepo.getPendingActions(),
      this.dashboardRepo.getRecentActivity(),
    ]);

    // Format the KPIs exactly how the frontend expects them
    const kpis = [
      {
        label: "Total Active Students",
        value: activeStudents.toString(),
        trend: "Currently enrolled",
        color: "text-blue-600",
        bg: "bg-blue-50",
      },
      {
        label: "Pending Defense Applications",
        value: pendingDefenses.toString(),
        trend: "Awaiting review",
        color: "text-amber-600",
        bg: "bg-amber-50",
      },
      {
        label: "Pending COR Verifications",
        value: pendingCORs.toString(),
        trend: "Needs validation",
        color: "text-(--earist-primary)",
        bg: "bg-(--earist-surface-light-red)",
      },
      {
        label: "Repository Entries",
        value: repositoryEntries.toString(),
        trend: "Public papers",
        color: "text-green-600",
        bg: "bg-green-50",
      },
    ];

    return {
      kpis,
      pipelineStages,
      pendingActions,
      recentActivity,
    };
  }
}
