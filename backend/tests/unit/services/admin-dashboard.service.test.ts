import { beforeEach, describe, expect, it, vi } from "vitest";

const repoMock = vi.hoisted(() => ({
  getEnrolledStudents: vi.fn(),
  getThesisRecordsForPipeline: vi.fn(),
  getBridgingWaiversToReviewCount: vi.fn(),
  getAdviserRequestsForDeanReviewCount: vi.fn(),
  getDefensesAwaitingConclusionCount: vi.fn(),
  getRapReportsAwaitingSignaturesCount: vi.fn(),
  getUpcomingDefenses: vi.fn(),
  getRecentActivity: vi.fn(),
}));

const defenseAppsMock = vi.hoisted(() => ({
  getDefenseApplicationsPaginated: vi.fn(),
}));

const corMock = vi.hoisted(() => ({
  getPendingUploads: vi.fn(),
}));

vi.mock("../../../src/repositories/admin-dashboard.repository", () => ({
  DashboardRepository: class {
    constructor() {
      Object.assign(this, repoMock);
    }
  },
}));
vi.mock("../../../src/repositories/defense-applications.repository", () => ({
  DefenseApplicationsRepository: class {
    constructor() {
      Object.assign(this, defenseAppsMock);
    }
  },
}));
vi.mock("../../../src/repositories/cor.repository", () => ({
  CorRepository: class {
    constructor() {
      Object.assign(this, corMock);
    }
  },
}));

import { AdminDashboardService } from "../../../src/services/admin-dashboard.service";

function primeHappyPath() {
  repoMock.getEnrolledStudents.mockResolvedValue([
    { programName: "MSIT", programType: "MASTERS" },
    { programName: "MSIT", programType: "MASTERS" },
    { programName: "DIT", programType: "DOCTORAL" },
  ]);
  repoMock.getThesisRecordsForPipeline.mockResolvedValue([]);
  repoMock.getBridgingWaiversToReviewCount.mockResolvedValue(3);
  repoMock.getAdviserRequestsForDeanReviewCount.mockResolvedValue(1);
  repoMock.getDefensesAwaitingConclusionCount.mockResolvedValue(5);
  repoMock.getRapReportsAwaitingSignaturesCount.mockResolvedValue(2);
  repoMock.getUpcomingDefenses.mockResolvedValue([]);
  repoMock.getRecentActivity.mockResolvedValue([]);
  defenseAppsMock.getDefenseApplicationsPaginated.mockImplementation(
    (params: { bucket?: string }) =>
      Promise.resolve({ total: params.bucket === "NEEDS_REVIEW" ? 4 : 2 }),
  );
  corMock.getPendingUploads.mockResolvedValue([{ id: "c1" }, { id: "c2" }]);
}

beforeEach(() => {
  vi.clearAllMocks();
  primeHappyPath();
});

describe("AdminDashboardService.getDashboardData", () => {
  it("builds the four primary KPIs from authoritative sources", async () => {
    const service = new AdminDashboardService();
    const result = await service.getDashboardData();

    expect(result.kpis).toEqual({
      enrolledStudents: 3,
      defenseApplicationsToReview: 4,
      defensesReadyForScheduling: 2,
      corSubmissionsToReview: 2,
    });
  });

  it("requests the authoritative NEEDS_REVIEW and READY defense-application buckets", async () => {
    const service = new AdminDashboardService();
    await service.getDashboardData();

    const buckets = defenseAppsMock.getDefenseApplicationsPaginated.mock.calls.map(
      (call) => call[0].bucket,
    );
    expect(buckets).toEqual(
      expect.arrayContaining(["NEEDS_REVIEW", "READY"]),
    );
  });

  it("counts COR review tasks from current actionable pending uploads, not CorRecord", async () => {
    const service = new AdminDashboardService();
    const result = await service.getDashboardData();

    expect(corMock.getPendingUploads).toHaveBeenCalled();
    expect(result.kpis.corSubmissionsToReview).toBe(2);
  });

  it("assembles the grouped needs-attention queues including waiver and Dean-review counts", async () => {
    const service = new AdminDashboardService();
    const result = await service.getDashboardData();

    expect(result.needsAttention).toEqual({
      defenseApplications: 4,
      corSubmissions: 2,
      defensesReadyForScheduling: 2,
      bridgingWaivers: 3,
      adviserRequestsForDeanReview: 1,
    });
  });

  it("separates actor-owned workflow monitoring from Admin-owned actions", async () => {
    const service = new AdminDashboardService();
    const result = await service.getDashboardData();

    expect(result.workflowMonitoring).toEqual({
      defensesAwaitingConclusion: 5,
      rapReportsAwaitingSignatures: 2,
    });
  });

  it("returns a semantic payload without frontend presentation classes", async () => {
    const service = new AdminDashboardService();
    const result = await service.getDashboardData();

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("bg-");
    expect(serialized).not.toContain("\"color\"");
    expect(result.enrollment.total).toBe(3);
    expect(result.thesisPipeline).toEqual([
      { stage: "TITLE", count: 0 },
      { stage: "PROPOSAL", count: 0 },
      { stage: "FINAL", count: 0 },
    ]);
  });
});
