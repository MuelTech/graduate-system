import express from "express";
import jwt from "jsonwebtoken";
import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const database = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  adviserAssignment: { findMany: vi.fn() },
  adviserRequest: { count: vi.fn() },
  adviserCertification: { count: vi.fn() },
  panelAssignment: { count: vi.fn() },
  // No queue or detailed workspace source should be consulted for navigation.
  examApplication: { findMany: vi.fn() },
  thesisRecord: { findFirst: vi.fn() },
  defenseSchedule: { findUnique: vi.fn() },
  student: { findUnique: vi.fn() },
}));
vi.mock("../../../src/config/database", () => ({ default: database }));
import authRoutes from "../../../src/routes/auth.routes";
import { EffectiveAccessService } from "../../../src/services/effective-access.service";
import { DIRECT_ACCESS_ENFORCEMENT_ENABLED } from "../../../src/access/account-access";
import { FACULTY_CONFIGURATION_ENABLED } from "../../../src/access/faculty-configuration";
import { FACULTY_ESSAY_EVALUATION_ENABLED } from "../../../src/access/faculty-essay-authorization";
import { MULTIPLE_ACTIVE_ADVISERS_WORKSPACE_MESSAGE } from "../../../src/services/adviser-workspace.service";
import { AdviserWorkspaceService } from "../../../src/services/adviser-workspace.service";
import { DefenseWorkspaceService } from "../../../src/services/defense-workspace.service";

const SECRET = "faculty-13-test-only";
const originalSecret = process.env.JWT_SECRET;
const selfId = "self-faculty";
const otherId = "other-faculty";
let account: any;
let assignments: any[];
let requests: any[];
let certifications: any[];
let defenses: any[];
let server: Server;
let base: string;

const emptyWork = {
  essayEvaluations: { relevant: false },
  myAdvisees: { relevant: false, activeAdviseeCount: 0, addressedRequestCount: 0, issuedCertificationCount: 0 },
  myDefenses: { relevant: false, assignmentCount: 0 },
};

function academic(role = "FACULTY") {
  return { id: selfId, role, email: "self@example.test", isActive: true, mustChangePassword: false,
    panelist: { isActive: true, isExternal: false, isAvailableAsAdviser: false },
    administratorAccess: null, capabilityGrants: [], passwordHash: "private-password-hash" };
}
function adviser(adviserId = selfId, studentId = "private-student-id", isActive = true) {
  return { id: `private-assignment-${assignments.length}`, adviserId, studentId, isActive };
}
function certification(adviserId = selfId, defenseStage = "PROPOSAL_DEFENSE", status = "ISSUED") {
  return { adviserId, defenseStage, status, id: "private-certification-id", signatureData: "private-signature",
    thesisId: "private-thesis-id", reviewedDocumentId: "private-document-id" };
}
function defense(userId = selfId, isActive = true, sessionStatus = "SCHEDULED") {
  return { userId, isActive, sessionStatus, id: "private-panel-id", scheduleId: "private-schedule-id",
    studentNumber: "private-student-number", notes: "private-defense-notes" };
}
async function me(claims = {}) {
  const token = jwt.sign({ userId: selfId, role: "ADMIN", capabilities: ["essay.evaluate", "faculty.manage"], ...claims }, SECRET);
  const response = await fetch(`${base}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
  const body = await response.json();
  return { response, body };
}

beforeAll(async () => {
  process.env.JWT_SECRET = SECRET;
  const app = express();
  app.use(express.json());
  app.use("/api/auth", authRoutes);
  server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  if (originalSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = originalSecret;
});
beforeEach(() => {
  vi.resetAllMocks();
  account = academic();
  assignments = []; requests = []; certifications = []; defenses = [];
  database.user.findUnique.mockImplementation(async ({ where }) => where.id === selfId ? structuredClone(account) : academic());
  database.adviserAssignment.findMany.mockImplementation(async ({ where }) => assignments
    .filter(row => row.adviserId === where.adviserId && row.isActive === where.isActive)
    .map(row => ({ student: { adviserAssignments: assignments
      .filter(active => active.studentId === row.studentId && active.isActive)
      .map(active => ({ id: active.id, adviserId: active.adviserId })) } })));
  database.adviserRequest.count.mockImplementation(async ({ where }) => requests.filter(row => row.requestedAdviserId === where.requestedAdviserId).length);
  database.adviserCertification.count.mockImplementation(async ({ where }) => certifications.filter(row => row.adviserId === where.adviserId
    && row.status === where.status && where.defenseStage.in.includes(row.defenseStage)).length);
  database.panelAssignment.count.mockImplementation(async ({ where }) => defenses.filter(row => row.userId === where.userId && row.isActive === where.isActive).length);
});

describe("FACULTY-13 additive self-access contract", () => {
  it("returns persisted identity and the compatible configured shape, ignoring JWT authority", async () => {
    account.capabilityGrants = [{ capabilityKey: "essay.evaluate" }];
    const { response, body } = await me({ role: "CUSTOM", userEmail: "other@example.test", facultyWork: { myDefenses: { relevant: true } } });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body).toEqual({
      user: { id: selfId, email: "self@example.test", role: "FACULTY", mustChangePassword: false },
      configuredAccess: { status: "RESOLVED", administratorLevel: null, capabilities: ["essay.evaluate"] },
      directAccessEnforcementEnabled: false,
      facultyWork: { ...emptyWork, essayEvaluations: { relevant: true } },
    });
    expect(database.user.findUnique).toHaveBeenCalledTimes(1);
    expect(database.user.findUnique.mock.calls[0][0].where).toEqual({ id: selfId });
    expect(database.examApplication.findMany).not.toHaveBeenCalled();
    expect(database.thesisRecord.findFirst).not.toHaveBeenCalled();
  });
  it.each(["APPLICANT", "STUDENT", "ADMIN"])("%s cannot inherit another Faculty account's work", async role => {
    account = { ...academic(role), panelist: null, administratorAccess: role === "ADMIN" ? { level: "FULL" } : null };
    assignments.push(adviser(otherId)); requests.push({ requestedAdviserId: otherId });
    certifications.push(certification(otherId)); defenses.push(defense(otherId));
    const { response, body } = await me();
    expect(response.status).toBe(200); expect(body.facultyWork).toBeNull();
    expect(database.adviserAssignment.findMany).not.toHaveBeenCalled();
    expect(database.adviserRequest.count).not.toHaveBeenCalled();
    expect(database.adviserCertification.count).not.toHaveBeenCalled();
    expect(database.panelAssignment.count).not.toHaveBeenCalled();
    expect(database.user.findUnique).toHaveBeenCalledTimes(1);
  });
  it.each(["FULL", "RESTRICTED"])("Admin %s keeps its own level and current configured capabilities only", async level => {
    account = { ...academic("ADMIN"), panelist: null, administratorAccess: { level } };
    let result = await me();
    expect(result.response.status).toBe(200);
    expect(result.body.configuredAccess.status).toBe("RESOLVED");
    expect(result.body.configuredAccess.administratorLevel).toBe(level);
    expect(result.body.facultyWork).toBeNull();
    expect(result.body.configuredAccess.capabilities).not.toContain("essay.evaluate");
    if (level === "RESTRICTED") {
      expect(result.body.configuredAccess.capabilities).toEqual([]);
      account.capabilityGrants = [{ capabilityKey: "faculty.view" }];
      result = await me();
      expect(result.body.configuredAccess.capabilities).toEqual(["faculty.view"]);
      account.capabilityGrants = [];
      expect((await me()).body.configuredAccess.capabilities).toEqual([]);
    } else expect(result.body.configuredAccess.capabilities).toContain("administrator_access.manage");
  });
  it.each(["FACULTY", "PANELIST"])("valid %s with no work has a truthful zero summary", async role => {
    account = academic(role);
    expect((await me()).body.facultyWork).toEqual(emptyWork);
  });
  it("cannot activate any dormant target through the projection", async () => {
    account.capabilityGrants = [{ capabilityKey: "essay.evaluate" }];
    expect((await me()).body.facultyWork.essayEvaluations.relevant).toBe(true);
    expect([DIRECT_ACCESS_ENFORCEMENT_ENABLED, FACULTY_CONFIGURATION_ENABLED, FACULTY_ESSAY_EVALUATION_ENABLED]).toEqual([false, false, false]);
  });
});

describe("FACULTY-13 configured essay relevance and failure states", () => {
  it.each([false, true])("grant works with no pending essays, External=%s", async external => {
    account.panelist.isExternal = external;
    account.capabilityGrants = [{ capabilityKey: "essay.evaluate" }];
    expect((await me()).body.facultyWork).toEqual({ ...emptyWork, essayEvaluations: { relevant: true } });
    expect(database.examApplication.findMany).not.toHaveBeenCalled();
  });
  it("absence of a persisted grant cannot be supplied through a token", async () => {
    expect((await me()).body.facultyWork.essayEvaluations.relevant).toBe(false);
  });
  it.each([
    [{ capabilityKey: "faculty.manage" }], [{ capabilityKey: "unknown" }],
    [{ capabilityKey: "essay.evaluate" }, { capabilityKey: "essay.evaluate" }],
    [null], [{ capabilityKey: 5 }], null,
  ])("malformed/wrong-category grants expose explicit failure status with no work: %j", async grants => {
    account.capabilityGrants = grants;
    assignments.push(adviser());
    const { body } = await me();
    expect(body.configuredAccess).toEqual({ status: "INVALID_CONFIGURATION", administratorLevel: null, capabilities: [] });
    expect(body.facultyWork).toBeNull();
    expect(database.adviserAssignment.findMany).not.toHaveBeenCalled();
  });
  it("academic account with Admin metadata fails closed", async () => {
    account.administratorAccess = { level: "FULL" };
    const { body } = await me();
    expect(body.configuredAccess.status).toBe("INVALID_CONFIGURATION"); expect(body.facultyWork).toBeNull();
  });
  it("required password change exposes no usable work despite persisted grants and assignments", async () => {
    account.mustChangePassword = true; account.capabilityGrants = [{ capabilityKey: "essay.evaluate" }];
    assignments.push(adviser()); defenses.push(defense());
    const { response, body } = await me();
    expect(response.status).toBe(200); expect(body.configuredAccess.status).toBe("UNAVAILABLE");
    expect(body.facultyWork).toBeNull(); expect(database.panelAssignment.count).not.toHaveBeenCalled();
  });
  it.each(["account", "profile"])("inactive %s denies self-access rather than returning historical work", async target => {
    defenses.push(defense());
    if (target === "account") account.isActive = false;
    else account.panelist.isActive = false;
    const { response, body } = await me();
    expect(response.status).toBe(403); expect(body.facultyWork).toBeUndefined();
    expect(database.panelAssignment.count).not.toHaveBeenCalled();
  });
  it("missing academic profile is denied by existing authentication", async () => {
    account.panelist = null;
    expect((await me()).response.status).toBe(403);
  });
  it.each(["account", "assignments", "requests", "certifications", "defenses"])("%s read failure is a controlled error, never successful empty work", async source => {
    const method = { account: database.user.findUnique, assignments: database.adviserAssignment.findMany,
      requests: database.adviserRequest.count, certifications: database.adviserCertification.count, defenses: database.panelAssignment.count }[source]!;
    method.mockRejectedValueOnce(new Error("private DB path and other@example.test"));
    const { response, body } = await me();
    expect(response.status).toBe(503); expect(body.facultyWork).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain("private DB");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
  it.each([-1, NaN, undefined, 1.5, Number.MAX_SAFE_INTEGER + 1])("malformed read-model count %s fails closed", async value => {
    database.panelAssignment.count.mockResolvedValueOnce(value);
    expect((await me()).response.status).toBe(503);
  });
});

describe("FACULTY-13 My Advisees authority reduction", () => {
  it("counts sole active relationships without requiring new-assignment availability", async () => {
    assignments.push(adviser(), adviser(selfId, "second-private-student"), adviser(otherId, "unrelated-student"));
    const { body } = await me();
    expect(body.facultyWork.myAdvisees).toEqual({ relevant: true, activeAdviseeCount: 2, addressedRequestCount: 0, issuedCertificationCount: 0 });
    expect(body.facultyWork.myDefenses).toEqual(emptyWork.myDefenses);
    expect(database.adviserAssignment.findMany).toHaveBeenCalledTimes(1);
    expect(database.adviserAssignment.findMany.mock.calls[0][0]).toEqual({
      where: { adviserId: selfId, isActive: true },
      select: { student: { select: { adviserAssignments: { where: { isActive: true }, select: { id: true, adviserId: true } } } } },
    });
  });
  it.each(["PENDING", "CONFORMED", "APPROVED", "DECLINED", "REJECTED"])("addressed GS-020 %s preserves inbox relevance without an assignment", async status => {
    requests.push({ requestedAdviserId: selfId, status, id: "private-request-id", reason: "private-reason" });
    requests.push({ requestedAdviserId: otherId, status: "PENDING" });
    const { body } = await me();
    expect(body.facultyWork.myAdvisees).toEqual({ relevant: true, activeAdviseeCount: 0, addressedRequestCount: 1, issuedCertificationCount: 0 });
    expect(database.adviserRequest.count).toHaveBeenCalledWith({ where: { requestedAdviserId: selfId } });
  });
  it.each([false, true])("issued GS-017 and addressed request remain visible without a relationship, External=%s", async external => {
    account.panelist.isExternal = external;
    requests.push({ requestedAdviserId: selfId });
    certifications.push(certification(), certification(selfId, "FINAL_DEFENSE"), certification(otherId),
      certification(selfId, "PROPOSAL_DEFENSE", "DRAFT"), certification(selfId, "TITLE_DEFENSE"));
    const { body } = await me();
    expect(body.facultyWork.myAdvisees).toEqual({ relevant: true, activeAdviseeCount: 0, addressedRequestCount: 1, issuedCertificationCount: 2 });
    expect(database.adviserCertification.count).toHaveBeenCalledWith({ where: {
      adviserId: selfId, status: "ISSUED", defenseStage: { in: ["PROPOSAL_DEFENSE", "FINAL_DEFENSE"] },
    } });
  });
  it("own issued GS-017 alone retains relevance without an active relationship", async () => {
    certifications.push(certification());
    expect((await me()).body.facultyWork.myAdvisees).toEqual({ relevant: true, activeAdviseeCount: 0, addressedRequestCount: 0, issuedCertificationCount: 1 });
  });
  it("availability alone and other-account records cannot create relevance", async () => {
    account.panelist.isAvailableAsAdviser = true;
    assignments.push(adviser(otherId)); requests.push({ requestedAdviserId: otherId }); certifications.push(certification(otherId));
    expect((await me()).body.facultyWork).toEqual(emptyWork);
  });
  it.each([selfId, otherId])("multiple active Advisers, second=%s, preserve workspace fail-closed conflict", async second => {
    assignments.push(adviser(), adviser(second));
    const { response, body } = await me();
    expect(response.status).toBe(409);
    expect(body).toEqual({ error: MULTIPLE_ACTIVE_ADVISERS_WORKSPACE_MESSAGE });
    expect(body.facultyWork).toBeUndefined();
  });
  it("an inconsistent relationship snapshot fails closed", async () => {
    database.adviserAssignment.findMany.mockResolvedValueOnce([{ student: { adviserAssignments: [{ id: "a", adviserId: otherId }] } }]);
    expect((await me()).response.status).toBe(409);
  });
});

describe("FACULTY-13 My Defenses", () => {
  it.each(["SCHEDULED", "IN_PROGRESS", "CONCLUDED", "CANCELLED"])("retains accepted exact assignment read context for %s without recency cutoff", async status => {
    account.panelist.isExternal = true;
    defenses.push(defense(selfId, true, status));
    const { body } = await me();
    expect(body.facultyWork.myDefenses).toEqual({ relevant: true, assignmentCount: 1 });
    expect(body.facultyWork.myAdvisees.relevant).toBe(false);
    expect(database.panelAssignment.count).toHaveBeenCalledWith({ where: { userId: selfId, isActive: true } });
  });
  it("removed/corrected rows and unrelated Faculty assignments confer no read authority", async () => {
    defenses.push(defense(selfId, false), defense(otherId), defense(otherId, true, "CONCLUDED"));
    expect((await me()).body.facultyWork.myDefenses).toEqual(emptyWork.myDefenses);
  });
});

describe("FACULTY-13 combinations, freshness and privacy", () => {
  it.each(["FACULTY", "PANELIST"].flatMap(role => Array.from({ length: 8 }, (_, mask) =>
    ({ role, essay: Boolean(mask & 1), advisee: Boolean(mask & 2), scheduled: Boolean(mask & 4) }))))(
    "composes current $role responsibilities: Essay=$essay Adviser=$advisee Defense=$scheduled", async ({ role, essay, advisee, scheduled }) => {
      account = academic(role);
      if (essay) account.capabilityGrants = [{ capabilityKey: "essay.evaluate" }];
      if (advisee) assignments.push(adviser());
      if (scheduled) defenses.push(defense());
      const { body } = await me();
      expect(body.facultyWork.essayEvaluations.relevant).toBe(essay);
      expect(body.facultyWork.myAdvisees.relevant).toBe(advisee);
      expect(body.facultyWork.myDefenses.relevant).toBe(scheduled);
    });
  it("recomputes grant, assignment, addressed-request, issuer-record, Defense and credential changes on each request", async () => {
    account.capabilityGrants = [{ capabilityKey: "essay.evaluate" }];
    expect((await me()).body.facultyWork.essayEvaluations.relevant).toBe(true);
    account.capabilityGrants = [];
    expect((await me()).body.facultyWork.essayEvaluations.relevant).toBe(false);
    assignments.push(adviser());
    expect((await me()).body.facultyWork.myAdvisees.activeAdviseeCount).toBe(1);
    assignments[0].isActive = false;
    expect((await me()).body.facultyWork.myAdvisees.relevant).toBe(false);
    requests.push({ requestedAdviserId: selfId, adviserStatus: "PENDING", deanStatus: "PENDING" });
    expect((await me()).body.facultyWork.myAdvisees.addressedRequestCount).toBe(1);
    requests[0].adviserStatus = "CONFORMED";
    expect((await me()).body.facultyWork.myAdvisees.relevant).toBe(true);
    requests = [];
    certifications.push(certification());
    expect((await me()).body.facultyWork.myAdvisees.issuedCertificationCount).toBe(1);
    assignments[0].isActive = true;
    await me();
    assignments[0].isActive = false;
    expect((await me()).body.facultyWork.myAdvisees.relevant).toBe(true);
    defenses.push(defense());
    expect((await me()).body.facultyWork.myDefenses.assignmentCount).toBe(1);
    defenses[0].isActive = false;
    expect((await me()).body.facultyWork.myDefenses.relevant).toBe(false);
    account.mustChangePassword = true;
    expect((await me()).body.facultyWork).toBeNull();
    account.mustChangePassword = false;
    expect((await me()).body.facultyWork.myAdvisees.relevant).toBe(true);
    account.panelist.isActive = false;
    expect((await me()).response.status).toBe(403);
    account.panelist.isActive = true; account.isActive = false;
    expect((await me()).response.status).toBe(403);
  });
  it("serializes only the allowlisted contract even when records contain private fields", async () => {
    assignments.push(adviser()); requests.push({ requestedAdviserId: selfId, id: "private-request-id" });
    certifications.push(certification()); defenses.push(defense());
    Object.assign(account, { signatureData: "private-signature", studentId: "private-student-id", applicantId: "private-applicant-id",
      privateEvaluatorDraft: "private-draft", manuscriptText: "private-manuscript", filePath: "private-file-path", auditRows: ["private-audit"],
      relatedAccount: { email: "other@example.test", capabilityGrants: [{ capabilityKey: "faculty.manage" }] } });
    const { body } = await me();
    const serialized = JSON.stringify(body);
    for (const forbidden of ["signatureData", "passwordHash", "other@example.test", "studentId", "studentNumber", "applicantId", "thesisId",
      "scheduleId", "documentId", "requestId", "certificationId", "privateEvaluatorDraft", "manuscriptText", "filePath", "auditRows", "private-"]) {
      expect(serialized).not.toContain(forbidden);
    }
    expect(body.facultyWork).toEqual({ ...emptyWork,
      myAdvisees: { relevant: true, activeAdviseeCount: 1, addressedRequestCount: 1, issuedCertificationCount: 1 },
      myDefenses: { relevant: true, assignmentCount: 1 },
    });
  });
  it("never reuses prior granted work after a later domain failure", async () => {
    assignments.push(adviser());
    expect((await me()).body.facultyWork.myAdvisees.relevant).toBe(true);
    database.adviserRequest.count.mockRejectedValueOnce(new Error("offline"));
    const failed = await me();
    expect(failed.response.status).toBe(503); expect(failed.body.facultyWork).toBeUndefined();
    expect((await me()).body.facultyWork.myAdvisees.relevant).toBe(true);
  });
  it("relevant summaries never authorize guessed Student or schedule IDs at exact workflow services", async () => {
    assignments.push(adviser()); defenses.push(defense());
    const projection = await new EffectiveAccessService().currentAccount(account);
    expect(projection.facultyWork?.myDefenses.relevant).toBe(true);
    expect(projection.facultyWork?.myAdvisees.relevant).toBe(true);
    database.defenseSchedule.findUnique.mockResolvedValue({ panelAssignments: [] });
    await expect(new DefenseWorkspaceService().getWorkspace("guessed-schedule", selfId)).rejects.toMatchObject({ statusCode: 403 });
    database.student.findUnique.mockResolvedValue({ id: "guessed-student", adviserAssignments: [{ id: "other-assignment", adviserId: otherId }] });
    await expect(new AdviserWorkspaceService().getAdviseeDetail(selfId, "guessed-student")).rejects.toMatchObject({ statusCode: 404 });
    expect(account.capabilityGrants).toEqual([]);
  });
});
