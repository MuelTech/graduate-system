/**
 * UIUX-3A — Panelist dashboard aggregate read model.
 *
 * Composes authoritative, read-only sources for the authenticated panelist:
 * - PanelistDashboardRepository   (own assignments + own RAP signature slots)
 * - AdviserRequestService         (own GS-020 adviser-request inbox)
 * - ProposalAdviserReviewService  (own Proposal adviser-review queue)
 * - FinalAdviserReviewService     (own Final adviser-review queue)
 *
 * Eligibility stays authoritative in the domain rules; this service only maps
 * existing records into the pure dashboard builder. It never mutates state.
 */
import { AdviserRequestService } from "./adviser-request.service";
import { ProposalAdviserReviewService } from "./proposal-adviser-review.service";
import { FinalAdviserReviewService } from "./final-adviser-review.service";
import { PanelistDashboardRepository } from "../repositories/panelist-dashboard.repository";
import {
  buildPanelistDashboard,
  type DashboardAdviserRequestInput,
  type DashboardReviewTaskInput,
  type PanelistDashboardView,
} from "./panelist-dashboard.rules";

function toWallDate(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

export class PanelistDashboardService {
  constructor(
    private repo: PanelistDashboardRepository = new PanelistDashboardRepository(),
    private adviserRequests: AdviserRequestService = new AdviserRequestService(),
    private proposalReviews: ProposalAdviserReviewService = new ProposalAdviserReviewService(),
    private finalReviews: FinalAdviserReviewService = new FinalAdviserReviewService(),
  ) {}

  async getDashboard(
    userId: string,
    now: Date = new Date(),
  ): Promise<PanelistDashboardView> {
    const [
      assignments,
      pendingRapSlots,
      signedRapSlots,
      adviserRequestRows,
      proposalTasks,
      finalTasks,
    ] = await Promise.all([
      this.repo.getAssignments(userId),
      this.repo.getPendingRapSlots(userId),
      this.repo.getSignedRapSlots(userId),
      this.adviserRequests.listMyAdviserRequests(userId),
      this.proposalReviews.listReviewTasks(userId),
      this.finalReviews.listReviewTasks(userId),
    ]);

    const adviserRequests: DashboardAdviserRequestInput[] =
      adviserRequestRows.map((row) => ({
        id: row.id,
        studentName: row.student.name,
        studentNumber: row.student.studentNumber,
        officialTitle: row.officialTitle,
        requestDate: toWallDate(row.requestDate),
        status: String(row.status),
        adviserStatus: String(row.adviserStatus),
        deanStatus: String(row.deanStatus),
      }));

    const proposalReviewTasks: DashboardReviewTaskInput[] = proposalTasks.map(
      (row) => ({
        thesisId: row.thesisId,
        studentName: row.student.name,
        studentNumber: row.student.studentNumber,
        officialTitle: row.officialTitle,
        stage: "PROPOSAL",
        reviewStatus: String(row.reviewStatus),
        manuscriptUploadedAt: toWallDate(row.manuscriptUploadedAt),
      }),
    );

    const finalReviewTasks: DashboardReviewTaskInput[] = finalTasks.map(
      (row) => ({
        thesisId: row.thesisId,
        studentName: row.student.name,
        studentNumber: row.student.studentNumber,
        officialTitle: row.officialTitle,
        stage: "FINAL",
        reviewStatus: String(row.reviewStatus),
        manuscriptUploadedAt: toWallDate(row.manuscriptUploadedAt),
      }),
    );

    return buildPanelistDashboard({
      now,
      assignments,
      pendingRapSlots,
      signedRapSlots,
      adviserRequests,
      proposalReviewTasks,
      finalReviewTasks,
    });
  }
}
