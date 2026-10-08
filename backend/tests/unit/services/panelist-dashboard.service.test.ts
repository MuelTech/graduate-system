import { beforeEach, describe, expect, it, vi } from "vitest";

// The service imports the real repository/services (which import prisma at module
// scope). Replace the database module so no PrismaClient is constructed.
vi.mock("../../../src/config/database", () => ({ default: {} }));

import { PanelistDashboardService } from "../../../src/services/panelist-dashboard.service";

const NOW = new Date(2026, 9, 8, 3, 0, 0);

function makeRepo() {
  return {
    getAssignments: vi.fn().mockResolvedValue([]),
    getPendingRapSlots: vi.fn().mockResolvedValue([]),
    getSignedRapSlots: vi.fn().mockResolvedValue([]),
  };
}

function makeReviewService() {
  return { listReviewTasks: vi.fn().mockResolvedValue([]) };
}

describe("PanelistDashboardService (UIUX-3A)", () => {
  let repo: ReturnType<typeof makeRepo>;
  let adviserRequests: { listMyAdviserRequests: ReturnType<typeof vi.fn> };
  let proposalReviews: ReturnType<typeof makeReviewService>;
  let finalReviews: ReturnType<typeof makeReviewService>;
  let service: PanelistDashboardService;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = makeRepo();
    adviserRequests = { listMyAdviserRequests: vi.fn().mockResolvedValue([]) };
    proposalReviews = makeReviewService();
    finalReviews = makeReviewService();
    service = new PanelistDashboardService(
      repo as never,
      adviserRequests as never,
      proposalReviews as never,
      finalReviews as never,
    );
  });

  it("composes all sources and returns an empty dashboard when nothing is assigned", async () => {
    const view = await service.getDashboard("u-1", NOW);
    expect(view.kpis).toEqual({ upcomingDefenses: 0, pendingTasks: 0 });
    expect(view.needsAttention).toEqual([]);
    expect(repo.getAssignments).toHaveBeenCalledWith("u-1");
    expect(adviserRequests.listMyAdviserRequests).toHaveBeenCalledWith("u-1");
    expect(proposalReviews.listReviewTasks).toHaveBeenCalledWith("u-1");
    expect(finalReviews.listReviewTasks).toHaveBeenCalledWith("u-1");
  });

  it("maps an actionable adviser request (Date → wall date) into a task", async () => {
    adviserRequests.listMyAdviserRequests.mockResolvedValue([
      {
        id: "req-1",
        student: { name: "Ana Student", studentNumber: "2026-1" },
        officialTitle: "A Title",
        requestDate: new Date("2026-10-01T00:00:00.000Z"),
        status: "PENDING",
        adviserStatus: "PENDING",
        deanStatus: "PENDING",
      },
    ]);

    const view = await service.getDashboard("u-1", NOW);
    expect(view.kpis.pendingTasks).toBe(1);
    expect(view.needsAttention[0]).toMatchObject({
      category: "ADVISER_REQUEST",
      studentName: "Ana Student",
      date: "2026-10-01",
    });
  });

  it("maps a CONFORME-awaiting-Dean request as waiting-only", async () => {
    adviserRequests.listMyAdviserRequests.mockResolvedValue([
      {
        id: "req-2",
        student: { name: "Bea Student", studentNumber: "2026-2" },
        officialTitle: "B Title",
        requestDate: new Date("2026-09-20T00:00:00.000Z"),
        status: "PENDING",
        adviserStatus: "CONFORMED",
        deanStatus: "PENDING",
      },
    ]);

    const view = await service.getDashboard("u-1", NOW);
    expect(view.kpis.pendingTasks).toBe(0);
    expect(view.waitingOnOthers).toHaveLength(1);
    expect(view.waitingOnOthers[0].id).toBe("adviser-dean:req-2");
  });

  it("maps Proposal and Final adviser-review queues with their own stages", async () => {
    proposalReviews.listReviewTasks.mockResolvedValue([
      {
        thesisId: "thesis-p",
        student: { name: "Pro Student", studentNumber: "P-1" },
        officialTitle: "P Title",
        reviewStatus: "AWAITING_REVIEW",
        manuscriptUploadedAt: new Date("2026-10-02T00:00:00.000Z"),
      },
    ]);
    finalReviews.listReviewTasks.mockResolvedValue([
      {
        thesisId: "thesis-f",
        student: { name: "Fin Student", studentNumber: "F-1" },
        officialTitle: "F Title",
        reviewStatus: "CHANGES_REQUESTED",
        manuscriptUploadedAt: new Date("2026-10-03T00:00:00.000Z"),
        stage: "FINAL",
      },
    ]);

    const view = await service.getDashboard("u-1", NOW);
    expect(view.needsAttention.map((t) => t.id)).toContain(
      "review:PROPOSAL:thesis-p",
    );
    expect(view.waitingOnOthers.map((w) => w.id)).toContain(
      "manuscript-revision:FINAL:thesis-f",
    );
  });
});
