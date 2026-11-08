import { beforeEach, describe, expect, it, vi } from "vitest";
const sources = vi.hoisted(() => ({
  getEnrolledStudents: vi.fn(), getThesisRecordsForPipeline: vi.fn(), getBridgingWaiversToReviewCount: vi.fn(),
  getAdviserRequestsForDeanReviewCount: vi.fn(), getDefensesAwaitingConclusionCount: vi.fn(),
  getRapReportsAwaitingSignaturesCount: vi.fn(), getUpcomingDefenses: vi.fn(), getRecentActivity: vi.fn(),
}));
const defense = vi.hoisted(() => vi.fn()); const cor = vi.hoisted(() => vi.fn());
vi.mock("../../../src/repositories/admin-dashboard.repository", () => ({ DashboardRepository: class { constructor() { Object.assign(this, sources); } } }));
vi.mock("../../../src/repositories/defense-applications.repository", () => ({ DefenseApplicationsRepository: class { getDefenseApplicationsPaginated = defense; } }));
vi.mock("../../../src/repositories/cor.repository", () => ({ CorRepository: class { getPendingUploads = cor; } }));
import { AdminDashboardService } from "../../../src/services/admin-dashboard.service";
import { OperationalAuthorization } from "../../../src/access/operational-authorization";
let current: any;
const auth = new OperationalAuthorization(true, async () => current);
const service = new AdminDashboardService(auth);
function account(keys: string[] = [], extra = {}) {
  current = { id: "actor", role: "ADMIN", isActive: true, mustChangePassword: false, panelist: null,
    administratorAccess: { level: "RESTRICTED" }, capabilityGrants: keys.map(capabilityKey => ({ capabilityKey })), ...extra };
}
beforeEach(() => {
  vi.resetAllMocks(); account();
  for (const source of Object.values(sources)) source.mockResolvedValue(17);
  sources.getEnrolledStudents.mockResolvedValue([]); sources.getThesisRecordsForPipeline.mockResolvedValue([]);
  sources.getUpcomingDefenses.mockResolvedValue([{ studentName: "Private Student" }]);
  sources.getRecentActivity.mockResolvedValue([{ detail: "Private audit evidence" }]);
  defense.mockResolvedValue({ total: 19 }); cor.mockResolvedValue([{}]);
});
const mapping = [
  ["students.view", ["getEnrolledStudents"], ["enrollment"]],
  ["defense.applications.view", ["getThesisRecordsForPipeline"], ["thesisPipeline"]],
  ["defense.schedules.view", ["getDefensesAwaitingConclusionCount", "getUpcomingDefenses"], ["upcomingDefenses"]],
  ["defense.records.view", ["getRapReportsAwaitingSignaturesCount"], []],
  ["waivers.view", ["getBridgingWaiversToReviewCount"], []],
  ["adviser.requests.view", ["getAdviserRequestsForDeanReviewCount"], []],
  ["cor.view", [], []], ["audit.view", ["getRecentActivity"], ["recentActivity"]],
] as const;
describe("FACULTY-9 dashboard source containment", () => {
  it.each(mapping)("%s fetches only its authorized sources", async (key, expectedSources, fields) => {
    account([key]); const dto = await service.getDashboardData("actor");
    for (const [name, source] of Object.entries(sources)) {
      if ((expectedSources as readonly string[]).includes(name)) expect(source).toHaveBeenCalledTimes(1);
      else expect(source).not.toHaveBeenCalled();
    }
    expect(defense).toHaveBeenCalledTimes(key === "defense.applications.view" ? 2 : 0);
    expect(cor).toHaveBeenCalledTimes(key === "cor.view" ? 1 : 0);
    for (const field of ["enrollment", "thesisPipeline", "upcomingDefenses", "recentActivity"]) {
      expect(Object.hasOwn(dto, field)).toBe((fields as readonly string[]).includes(field));
    }
    expect(dto.kpis).toEqual(key === "students.view" ? { enrolledStudents: 0 }
      : key === "defense.applications.view" ? { defenseApplicationsToReview: 19, defensesReadyForScheduling: 19 }
      : key === "cor.view" ? { corSubmissionsToReview: 1 } : {});
    if (key !== "defense.schedules.view") expect(JSON.stringify(dto)).not.toContain("Private Student");
    if (key !== "audit.view") expect(JSON.stringify(dto)).not.toContain("Private audit evidence");
  });
  it.each([[], ["settings.manage"], ["repository.view"]].map(keys => ({ keys })))("no dashboard module grants %j returns no sensitive sources or zeros", async ({ keys }) => {
    account(keys); expect(await service.getDashboardData("actor")).toEqual({ kpis: {}, needsAttention: {}, workflowMonitoring: {} });
    for (const source of [...Object.values(sources), defense, cor]) expect(source).not.toHaveBeenCalled();
  });
  it("Full fetches complete projection using enumerated catalog", async () => {
    account([], { administratorAccess: { level: "FULL" } }); const dto = await service.getDashboardData("actor");
    for (const source of [...Object.values(sources), cor]) expect(source).toHaveBeenCalledTimes(1);
    expect(defense).toHaveBeenCalledTimes(2);
    expect(dto).toHaveProperty("recentActivity"); expect(dto).toHaveProperty("enrollment");
  });
  it("revocation and changed current role take effect before querying", async () => {
    account(["students.view"]); await service.getDashboardData("actor"); vi.clearAllMocks(); account([]);
    expect(await service.getDashboardData("actor")).toEqual({ kpis: {}, needsAttention: {}, workflowMonitoring: {} });
    account([], { role: "STUDENT" }); await expect(service.getDashboardData("actor")).rejects.toMatchObject({ statusCode: 403 });
    for (const source of [...Object.values(sources), defense, cor]) expect(source).not.toHaveBeenCalled();
  });
  it.each([{ isActive: false }, { mustChangePassword: true }, { administratorAccess: null },
    { capabilityGrants: [{ capabilityKey: "unknown" }] }, { capabilityGrants: [{ capabilityKey: "essay.evaluate" }] },
    { capabilityGrants: [{ capabilityKey: "audit.view" }, { capabilityKey: "audit.view" }] },
  ])("invalid access %j fails before all aggregate sources", async extra => {
    account([], { administratorAccess: { level: "FULL" }, ...extra });
    await expect(service.getDashboardData("actor")).rejects.toMatchObject({ statusCode: 403 });
    for (const source of [...Object.values(sources), defense, cor]) expect(source).not.toHaveBeenCalled();
  });
  it("omitted service actor is denied", async () => {
    account([], { administratorAccess: { level: "FULL" } }); await expect(service.getDashboardData()).rejects.toMatchObject({ statusCode: 403 });
  });
});
