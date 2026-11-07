import express from "express";
import { createServer } from "node:http";
import jwt from "jsonwebtoken";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  user: { findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn() },
  panelist: { findFirst: vi.fn() },
  student: { findUnique: vi.fn() },
  adviserAssignment: { findMany: vi.fn() },
  adviserRequest: { findMany: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn() },
  defenseSchedule: { findUnique: vi.fn() },
  $transaction: vi.fn(async (queries: Promise<unknown>[]) => Promise.all(queries)),
}));
vi.mock("../../../src/config/database", () => ({ default: db }));
import thesisRoutes from "../../../src/routes/thesis.routes";
import panelistRoutes from "../../../src/routes/panelist.routes";
import { authenticateJWT, requireRole } from "../../../src/middlewares/auth.middleware";
import { loadCurrentAccount, currentAccountResponse } from "../../../src/services/current-account";
import { isAcademicAccountRole, academicAccountRoleFilter } from "../../../src/utils/academic-account";
import { evaluateCandidateEligibility } from "../../../src/services/adviser-request.rules";
import { ThesisRepository } from "../../../src/repositories/thesis.repository";

const secret = "faculty-3-synthetic-secret";
const originalSecret = process.env.JWT_SECRET;
let url: string;
let server: ReturnType<typeof createServer>;
let account: Record<string, any>;
function request(path: string, claim = "PANELIST", body?: object) {
  return fetch(`${url}${path}`, {
    headers: { Authorization: `Bearer ${jwt.sign({ userId: "academic-1", role: claim }, secret)}`, "Content-Type": "application/json" },
    ...(body ? { method: "POST", body: JSON.stringify(body) } : {}),
  });
}
beforeAll(async () => {
  process.env.JWT_SECRET = secret;
  const app = express(); app.use(express.json());
  app.use("/api/thesis", thesisRoutes); app.use("/api/panelists", panelistRoutes);
  app.get("/api/admin-only", authenticateJWT, requireRole(["ADMIN"]), (_req, res) => res.json({ ok: true }));
  server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  url = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
afterAll(async () => {
  if (originalSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = originalSecret;
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
});
beforeEach(() => {
  vi.clearAllMocks();
  account = { id: "academic-1", email: "synthetic@example.test", role: "PANELIST", isActive: true,
    mustChangePassword: false, panelist: { isActive: true }, administratorAccess: null, capabilityGrants: [] };
  db.user.findUnique.mockImplementation(async () => account);
  db.panelist.findFirst.mockResolvedValue({ id: "profile-preserved", userId: "academic-1" });
  db.adviserRequest.findMany.mockResolvedValue([]);
  db.adviserRequest.findUnique.mockResolvedValue({ id: "request-1", requestedAdviserId: "academic-1", status: "PENDING", adviserStatus: "PENDING", deanStatus: "PENDING" });
  db.adviserRequest.updateMany.mockResolvedValue({ count: 1 });
  db.adviserAssignment.findMany.mockResolvedValue([]);
  db.student.findUnique.mockResolvedValue({ id: "student-1", user: { firstName: "Test", lastName: "Student" },
    studentNumber: "SYNTHETIC", program: { programName: "Test" }, thesisRecords: [],
    adviserAssignments: [{ id: "assignment-preserved", adviserId: "academic-1", assignedDate: new Date("2026-11-01") }] });
  db.defenseSchedule.findUnique.mockResolvedValue({ id: "schedule-1", thesisId: "thesis-1", defenseType: "TITLE_DEFENSE",
    sessionStatus: "IN_PROGRESS", defenseDate: null, defenseTime: null, thesis: null,
    manuscriptDocument: { id: "doc-preserved", docType: "TITLE_PROPOSAL", defenseStage: "TITLE", uploadedAt: new Date("2026-11-01") },
    panelAssignments: [{ id: "seat-preserved", userId: "academic-1", role: "PANELIST", user: { id: "academic-1", firstName: "Test", lastName: "Faculty" } }],
    oralExamScores: [], rapReports: [], conclusion: null, oralExamSummary: null });
});

describe("FACULTY-3 bounded academic identity", () => {
  it.each(["PANELIST", "FACULTY"])("recognizes only academic account %s", role => {
    expect(isAcademicAccountRole(role)).toBe(true);
    expect(academicAccountRoleFilter().in).toContain(role);
  });
  it.each(["ADMIN", "CUSTOM", "APPLICANT", "STUDENT", "CHAIRMAN", "ADVISER", "faculty", null, undefined, {}])("does not reinterpret %j as Faculty", role => {
    expect(isAcademicAccountRole(role)).toBe(false);
  });
  it.each(["PANELIST", "FACULTY"])("keeps candidacy gates for %s", role => {
    const valid = { defenseRole: "PANELIST", userRole: role, userIsActive: true, hasPanelistProfile: true,
      panelistIsActive: true, isAvailableAsAdviser: true, isExternal: false };
    expect(evaluateCandidateEligibility(valid).eligible).toBe(true);
    for (const change of [{ userRole: "ADMIN" }, { userRole: "CUSTOM" }, { defenseRole: "FACULTY" },
      { userIsActive: false }, { hasPanelistProfile: false }, { panelistIsActive: false }, { isExternal: true }, { isAvailableAsAdviser: false }]) {
      expect(evaluateCandidateEligibility({ ...valid, ...change }).eligible).toBe(false);
    }
  });
  it("queries both identities in committee/adviser candidate readers", async () => {
    db.user.findMany.mockResolvedValue([]); db.user.count.mockResolvedValue(0);
    const repository = new ThesisRepository();
    await repository.searchActivePanelists({ page: 1, pageSize: 10 });
    await repository.getActivePanelistCandidates(); await repository.getAvailableAdvisers();
    for (const [query] of db.user.findMany.mock.calls) {
      expect(query.where.role).toEqual({ in: ["PANELIST", "FACULTY"] });
      expect(query.where.panelist.isActive).toBe(true);
    }
  });
});

describe.each(["PANELIST", "FACULTY"])("FACULTY-3 current-account + real HTTP workflow (%s)", role => {
  beforeEach(() => { account.role = role; });
  it("loads current identity without changing IDs or activating grants", async () => {
    const current = await loadCurrentAccount("academic-1");
    expect(currentAccountResponse(current)).toMatchObject({ user: { id: "academic-1", role },
      configuredAccess: { status: "RESOLVED", capabilities: [] }, directAccessEnforcementEnabled: false });
  });
  it("retains exact own Panelist profile lookup", async () => {
    const result = await request("/api/panelists/me"); expect(result.status).toBe(200);
    expect(await result.json()).toMatchObject({ id: "profile-preserved", userId: "academic-1" });
    expect(db.panelist.findFirst).toHaveBeenCalledWith({ where: { userId: "academic-1" } });
  });
  it("reads own addressed requests, including before any AdviserAssignment", async () => {
    expect((await request("/api/thesis/adviser/requests/mine")).status).toBe(200);
    expect(db.adviserRequest.findMany.mock.calls[0][0].where).toEqual({ requestedAdviserId: "academic-1" });
  });
  it("keeps Proposal/Final manuscript queues scoped to the authenticated Adviser", async () => {
    for (const stage of ["proposal", "final"]) {
      const result = await request(`/api/thesis/${stage}-adviser-review/tasks`);
      expect(result.status).toBe(200); expect(await result.json()).toEqual([]);
    }
    expect(db.adviserAssignment.findMany).toHaveBeenCalledTimes(2);
    for (const [query] of db.adviserAssignment.findMany.mock.calls) {
      expect(query.where).toEqual({ adviserId: "academic-1", isActive: true });
    }
  });
  it("responds only to an exact addressed request", async () => {
    const endpoint = "/api/thesis/adviser/requests/request-1/adviser-response";
    expect((await request(endpoint, "PANELIST", { decision: "CONFORMED" })).status).toBe(200);
    expect(db.adviserRequest.updateMany.mock.calls[0][0].where.requestedAdviserId).toBe("academic-1");
    db.adviserRequest.findUnique.mockResolvedValue({ requestedAdviserId: "someone-else", status: "PENDING", adviserStatus: "PENDING", deanStatus: "PENDING" });
    expect((await request(endpoint, role, { decision: "CONFORMED" })).status).toBe(403);
    expect(db.adviserRequest.updateMany).toHaveBeenCalledOnce();
  });
  it("requires the sole exact AdviserAssignment for advisee detail", async () => {
    const endpoint = "/api/thesis/adviser/advisees/student-1";
    const result = await request(endpoint); expect(result.status).toBe(200);
    expect((await result.json()).assignment.assignmentId).toBe("assignment-preserved");
    const student = await db.student.findUnique();
    student.adviserAssignments = []; expect((await request(endpoint)).status).toBe(404);
    student.adviserAssignments = [{ adviserId: "someone-else" }]; expect((await request(endpoint)).status).toBe(404);
  });
  it("preserves exact defense seat role and denies an unassigned account", async () => {
    const endpoint = "/api/thesis/defense/schedule-1/workspace";
    const result = await request(endpoint); expect(result.status).toBe(200);
    expect((await result.json()).myAssignment).toEqual({ panelAssignmentId: "seat-preserved", role: "PANELIST" });
    const schedule = await db.defenseSchedule.findUnique(); schedule.panelAssignments = [];
    expect((await request(endpoint)).status).toBe(403);
  });
  it("uses a stale ADMIN/CUSTOM claim only as identity and denies admin privilege", async () => {
    for (const claim of ["ADMIN", "CUSTOM"]) {
      expect((await request("/api/panelists/me", claim)).status).toBe(200);
      expect((await request("/api/admin-only", claim)).status).toBe(403);
    }
  });
  it.each([{ isActive: false }, { panelist: null }, { panelist: { isActive: false } }, { mustChangePassword: true }])("denies current ineligible account %j", async change => {
    Object.assign(account, change);
    expect((await request("/api/panelists/me")).status).toBe(403);
    expect(db.panelist.findFirst).not.toHaveBeenCalled();
  });
});

it.each(["ADMIN", "CUSTOM", "STUDENT", "APPLICANT"])("denies current %s impersonating Faculty with an academic token", async role => {
  account.role = role;
  expect((await request("/api/panelists/me", "FACULTY")).status).toBe(403);
  expect((await request("/api/thesis/defense/schedule-1/workspace", "PANELIST")).status).toBe(403);
  expect(db.defenseSchedule.findUnique).not.toHaveBeenCalled();
});
