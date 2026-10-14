import { DashboardRepository } from "../repositories/admin-dashboard.repository";
import { DefenseApplicationsRepository } from "../repositories/defense-applications.repository";
import { CorRepository } from "../repositories/cor.repository";
import {
  buildEnrollmentSnapshot,
  buildThesisPipeline,
} from "./admin-dashboard.rules";

/**
 * Admin dashboard read model.
 *
 * Composes authoritative, read-only sources:
 * - DashboardRepository        (direct dashboard projections)
 * - DefenseApplicationsRepository (shared Defense Applications buckets)
 * - CorRepository              (canonical current-actionable COR queue)
 *
 * The response is semantic/numeric; all presentation is owned by the frontend.
 */
export class AdminDashboardService {
  private dashboardRepo = new DashboardRepository();
  private defenseAppsRepo = new DefenseApplicationsRepository();
  private corRepo = new CorRepository();

  async getDashboardData() {
    const [
      enrolledStudents,
      thesisRecords,
      bridgingWaivers,
      adviserRequestsForDeanReview,
      defensesAwaitingConclusion,
      rapReportsAwaitingSignatures,
      upcomingDefenses,
      recentActivity,
      defenseNeedsReview,
      defenseReady,
      corPendingUploads,
    ] = await Promise.all([
      this.dashboardRepo.getEnrolledStudents(),
      this.dashboardRepo.getThesisRecordsForPipeline(),
      this.dashboardRepo.getBridgingWaiversToReviewCount(),
      this.dashboardRepo.getAdviserRequestsForDeanReviewCount(),
      this.dashboardRepo.getDefensesAwaitingConclusionCount(),
      this.dashboardRepo.getRapReportsAwaitingSignaturesCount(),
      this.dashboardRepo.getUpcomingDefenses(5),
      this.dashboardRepo.getRecentActivity(6),
      // Reuse the exact authoritative Defense Applications buckets.
      this.defenseAppsRepo.getDefenseApplicationsPaginated({
        page: 1,
        pageSize: 1,
        bucket: "NEEDS_REVIEW",
      }),
      this.defenseAppsRepo.getDefenseApplicationsPaginated({
        page: 1,
        pageSize: 1,
        bucket: "READY",
      }),
      // Reuse the canonical current-actionable COR review queue.
      this.corRepo.getPendingUploads(),
    ]);

    const enrollment = buildEnrollmentSnapshot(enrolledStudents);
    const thesisPipeline = buildThesisPipeline(thesisRecords);

    const defenseApplicationsToReview = defenseNeedsReview.total;
    const defensesReadyForScheduling = defenseReady.total;
    const corSubmissionsToReview = corPendingUploads.length;

    return {
      kpis: {
        enrolledStudents: enrollment.total,
        defenseApplicationsToReview,
        defensesReadyForScheduling,
        corSubmissionsToReview,
      },
      needsAttention: {
        defenseApplications: defenseApplicationsToReview,
        corSubmissions: corSubmissionsToReview,
        defensesReadyForScheduling,
        bridgingWaivers,
        adviserRequestsForDeanReview,
      },
      enrollment,
      thesisPipeline,
      upcomingDefenses,
      workflowMonitoring: {
        defensesAwaitingConclusion,
        rapReportsAwaitingSignatures,
      },
      recentActivity,
    };
  }
}
