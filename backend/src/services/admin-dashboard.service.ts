import { OperationalAuthorization, operationalAuthorization } from "../access/operational-authorization";
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

  constructor(private readonly authorization: OperationalAuthorization = operationalAuthorization) {}

  async getDashboardData(actorId = "") {
    const keys = await this.authorization.capabilities(actorId);
    const students = keys.includes("students.view");
    const applications = keys.includes("defense.applications.view");
    const schedules = keys.includes("defense.schedules.view");
    const records = keys.includes("defense.records.view");
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
      students ? this.dashboardRepo.getEnrolledStudents() : undefined,
      applications ? this.dashboardRepo.getThesisRecordsForPipeline() : undefined,
      keys.includes("waivers.view") ? this.dashboardRepo.getBridgingWaiversToReviewCount() : undefined,
      keys.includes("adviser.requests.view") ? this.dashboardRepo.getAdviserRequestsForDeanReviewCount() : undefined,
      schedules ? this.dashboardRepo.getDefensesAwaitingConclusionCount() : undefined,
      records ? this.dashboardRepo.getRapReportsAwaitingSignaturesCount() : undefined,
      schedules ? this.dashboardRepo.getUpcomingDefenses(5) : undefined,
      keys.includes("audit.view") ? this.dashboardRepo.getRecentActivity(6) : undefined,
      // Reuse the exact authoritative Defense Applications buckets.
      applications ? this.defenseAppsRepo.getDefenseApplicationsPaginated({
        page: 1,
        pageSize: 1,
        bucket: "NEEDS_REVIEW",
      }) : undefined,
      applications ? this.defenseAppsRepo.getDefenseApplicationsPaginated({
        page: 1,
        pageSize: 1,
        bucket: "READY",
      }) : undefined,
      // Reuse the canonical current-actionable COR review queue.
      keys.includes("cor.view") ? this.corRepo.getPendingUploads() : undefined,
    ]);

    const enrollment = enrolledStudents === undefined ? undefined : buildEnrollmentSnapshot(enrolledStudents);
    const thesisPipeline = thesisRecords === undefined ? undefined : buildThesisPipeline(thesisRecords);
    const defenseApplicationsToReview = defenseNeedsReview?.total;
    const defensesReadyForScheduling = defenseReady?.total;
    const corSubmissionsToReview = corPendingUploads?.length;

    // Omit unauthorized fields entirely; never query then hide, or fabricate zero counts.
    return {
      kpis: {
        ...(enrollment === undefined ? {} : { enrolledStudents: enrollment.total }),
        ...(defenseApplicationsToReview === undefined ? {} : { defenseApplicationsToReview }),
        ...(defensesReadyForScheduling === undefined ? {} : { defensesReadyForScheduling }),
        ...(corSubmissionsToReview === undefined ? {} : { corSubmissionsToReview }),
      },
      needsAttention: {
        ...(defenseApplicationsToReview === undefined ? {} : { defenseApplications: defenseApplicationsToReview }),
        ...(corSubmissionsToReview === undefined ? {} : { corSubmissions: corSubmissionsToReview }),
        ...(defensesReadyForScheduling === undefined ? {} : { defensesReadyForScheduling }),
        ...(bridgingWaivers === undefined ? {} : { bridgingWaivers }),
        ...(adviserRequestsForDeanReview === undefined ? {} : { adviserRequestsForDeanReview }),
      },
      ...(enrollment === undefined ? {} : { enrollment }),
      ...(thesisPipeline === undefined ? {} : { thesisPipeline }),
      ...(upcomingDefenses === undefined ? {} : { upcomingDefenses }),
      workflowMonitoring: {
        ...(defensesAwaitingConclusion === undefined ? {} : { defensesAwaitingConclusion }),
        ...(rapReportsAwaitingSignatures === undefined ? {} : { rapReportsAwaitingSignatures }),
      },
      ...(recentActivity === undefined ? {} : { recentActivity }),
    };
  }
}
