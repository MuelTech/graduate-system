import { beforeEach, describe, expect, it, vi } from "vitest";
import { REVIEW_CONTEXT, STUDENT_SIGNATURE, signedRequestEvidence } from "../../fixtures/adviser-request-signed";
const db = vi.hoisted(() => ({
  user: { findUnique: vi.fn() }, panelist: { findUnique: vi.fn() }, student: { findUnique: vi.fn() },
  defenseConclusion: { findFirst: vi.fn() }, rapReport: { findMany: vi.fn() },
  adviserRequest: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
  adviserAssignment: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), deleteMany: vi.fn() },
  adviserRequestSignedState: { findUnique: vi.fn(), update: vi.fn() },
  adviserRequestOfficialRecord: { create: vi.fn(), update: vi.fn() }, $transaction: vi.fn(), $queryRaw: vi.fn(),
}));
vi.mock("../../../src/config/database", () => ({ default: db }));
vi.mock("../../../src/documents/official-defense/adviser-request/adviser-request.renderer", () => ({ renderAdviserRequest: vi.fn().mockResolvedValue(Buffer.from("synthetic form")) }));
vi.mock("../../../src/services/official-form-assets", () => ({ loadOfficialFormLogos: vi.fn().mockResolvedValue({}) }));
import { AdviserRequestService } from "../../../src/services/adviser-request.service";
import { ThesisService } from "../../../src/services/thesis.service";
import { ThesisRepository } from "../../../src/repositories/thesis.repository";
import { OperationalAuthorization } from "../../../src/access/operational-authorization";
import { DefenseAdviserAuthorization } from "../../../src/access/defense-adviser-authorization";
import { evaluateCandidateEligibility, evaluateNewAdviserEligibility } from "../../../src/services/adviser-request.rules";
let accounts: Record<string, any>, adviserProfile: any, request: any, evidence: any, defenseRole: string;
let assignment: any, inTransaction: boolean;
const load = async (id: string) => accounts[id] ?? null;
const faculty = new OperationalAuthorization(true, load);
const administration = new DefenseAdviserAuthorization(true, load);
const service = new AdviserRequestService(administration, faculty);
const thesis = new ThesisService(administration, undefined, faculty);
const clone = <T>(value: T): T => structuredClone(value);
function candidateAccount(role = "FACULTY") {
  return { id: "adv-user", role, firstName: "Ana", lastName: "Chair", isActive: true, mustChangePassword: false,
    panelist: { isActive: true }, administratorAccess: null, capabilityGrants: [] };
}
const submission = () => ({ requestedAdviserId: "adv-user", reason: "Please guide my research.", signatureData: STUDENT_SIGNATURE,
  reviewedContext: { ...REVIEW_CONTEXT } });
function context() {
  return { id: "conclusion-1", scheduleId: "schedule-1", selectedTitleId: null, selectedTitle: null,
    schedule: { panelAssignments: [{ role: defenseRole, user: { ...accounts["adv-user"], panelist: adviserProfile } }] } };
}
beforeEach(() => {
  vi.resetAllMocks(); assignment = null; inTransaction = false; defenseRole = "CHAIRMAN";
  accounts = {
    "student-user": { id: "student-user", role: "STUDENT", firstName: "Sam", lastName: "Student", isActive: true,
      mustChangePassword: false, panelist: null, administratorAccess: null, capabilityGrants: [] },
    "dean": { id: "dean", role: "ADMIN", isActive: true, mustChangePassword: false, panelist: null,
      administratorAccess: { level: "RESTRICTED" }, capabilityGrants: [{ capabilityKey: "adviser.requests.review" }] },
    "adv-user": candidateAccount(),
  };
  adviserProfile = { id: "profile", userId: "adv-user", isActive: true, isExternal: false, isAvailableAsAdviser: true,
    specialization: "Research", officeAffiliation: "Other Program" };
  request = { id: "request", studentId: "student-1", requestedAdviserId: "adv-user", reason: "Please guide my research.",
    sourceDefenseScheduleId: "schedule-1", requestDate: new Date("2026-09-25"), status: "PENDING", adviserStatus: "CONFORMED",
    adviserRespondedAt: new Date("2026-09-26T08:00:00Z"), deanStatus: "PENDING" };
  evidence = signedRequestEvidence(request);
  db.user.findUnique.mockImplementation(async ({ where }) => clone(accounts[where.id] ?? null));
  db.panelist.findUnique.mockImplementation(async () => clone(adviserProfile));
  db.student.findUnique.mockImplementation(async () => ({ id: "student-1", userId: "student-user", studentNumber: "2026-001",
    user: clone(accounts["student-user"]), programId: "student-program", program: { programName: "MIT" } }));
  db.defenseConclusion.findFirst.mockImplementation(async () => clone(context()));
  db.rapReport.findMany.mockResolvedValue([{ status: "FINALIZED" }]);
  db.adviserAssignment.findFirst.mockImplementation(async () => clone(assignment));
  db.adviserRequest.findFirst.mockResolvedValue(null); db.adviserRequest.findUnique.mockImplementation(async () => clone(request));
  db.adviserRequestSignedState.findUnique.mockImplementation(async () => clone(evidence));
  db.adviserRequest.updateMany.mockImplementation(async ({ data }) => { Object.assign(request, data); return { count: 1 }; });
  db.adviserAssignment.create.mockImplementation(async ({ data }) => { assignment = clone(data); return { id: "assignment", ...data }; });
  db.adviserRequestOfficialRecord.create.mockResolvedValue({});
  db.adviserRequest.create.mockImplementation(async ({ data }) => {
    const { signedState, ...row } = data; request = clone(row);
    evidence = { requestId: row.id, ...clone(signedState.create) }; return clone(row);
  });
  db.$queryRaw.mockResolvedValue([{ id: 1 }]);
  db.$transaction.mockImplementation(async work => {
    const old = { request: clone(request), evidence: clone(evidence), assignment: clone(assignment) }; inTransaction = true;
    try { return await work(db); } catch (error) { request = old.request; evidence = old.evidence; assignment = old.assignment; throw error; }
    finally { inTransaction = false; }
  });
});
describe("FACULTY-10 common new-Adviser eligibility", () => {
  it.each(["FACULTY", "PANELIST"])("same positive %s predicate for list, request and approval", async role => {
    accounts["adv-user"].role = role;
    expect((await service.listOdpCandidates("student-user")).candidates.map(row => row.userId)).toEqual(["adv-user"]);
    await service.createRequest("student-user", submission());
    request.adviserStatus = "CONFORMED"; request.adviserRespondedAt = new Date();
    await service.deanDecideAdviserRequest("dean", request.id, { decision: "APPROVED" });
    expect(assignment).toMatchObject({ adviserId: "adv-user", studentId: "student-1", isActive: true });
  });
  const invalid = [
    ["External", { isExternal: true }, {}], ["unavailable", { isAvailableAsAdviser: false }, {}],
    ["inactive profile", { isActive: false }, {}], ["missing profile", null, {}],
    ["missing availability", { isAvailableAsAdviser: undefined }, {}], ["missing classification", { isExternal: undefined }, {}],
    ["inactive User", {}, { isActive: false }], ["Admin target", {}, { role: "ADMIN" }], ["nonacademic target", {}, { role: "STUDENT" }],
  ] as const;
  it.each(invalid)("%s excluded from list, request, and new assignment", async (_label, profilePatch, userPatch) => {
    adviserProfile = profilePatch === null ? null : { ...adviserProfile, ...profilePatch };
    Object.assign(accounts["adv-user"], userPatch); const original = clone(request), originalEvidence = clone(evidence);
    expect((await service.listOdpCandidates("student-user")).candidates).toEqual([]);
    await expect(service.createRequest("student-user", submission())).rejects.toMatchObject({ statusCode: 400 });
    await expect(service.deanDecideAdviserRequest("dean", "request", { decision: "APPROVED" })).rejects.toMatchObject({ statusCode: 409 });
    expect(request).toEqual(original); expect(evidence).toEqual(originalEvidence); expect(db.adviserAssignment.create).not.toHaveBeenCalled();
  });
  it.each(["FACILITATOR", "RAPPORTEUR", "ADVISER", "FACULTY"])("%s seat cannot become a new Adviser", async role => {
    defenseRole = role;
    expect((await service.listOdpCandidates("student-user")).candidates).toEqual([]);
    await expect(service.createRequest("student-user", submission())).rejects.toMatchObject({ statusCode: 400 });
    const original = clone(request);
    await expect(service.deanDecideAdviserRequest("dean", "request", { decision: "APPROVED" })).rejects.toMatchObject({ statusCode: 409 });
    expect(request).toEqual(original); expect(db.adviserAssignment.create).not.toHaveBeenCalled();
  });
  it("guessed candidate ID cannot bypass exact passed Title ODP membership", async () => {
    await expect(service.createRequest("student-user", { ...submission(), requestedAdviserId: "unrelated-faculty" })).rejects.toMatchObject({ statusCode: 400 });
    expect(db.adviserRequest.create).not.toHaveBeenCalled();
    expect(db.defenseConclusion.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ thesis: { studentId: "student-1" }, outcome: "PASSED" }) }));
  });
  it("missing passed Title or same-session finalized RAP cannot unlock candidates", async () => {
    db.defenseConclusion.findFirst.mockResolvedValue(null);
    await expect(service.listOdpCandidates("student-user")).rejects.toMatchObject({ statusCode: 400 });
    db.defenseConclusion.findFirst.mockImplementation(async () => clone(context())); db.rapReport.findMany.mockResolvedValue([{ status: "DRAFT" }]);
    await expect(service.listOdpCandidates("student-user")).rejects.toMatchObject({ statusCode: 400 });
  });
  it("request eligibility is re-read after fence, before persisting signed evidence", async () => {
    db.$queryRaw.mockImplementation(async (sql: TemplateStringsArray) => {
      if (sql.join("").includes("administrator_access_lock")) adviserProfile.isAvailableAsAdviser = false;
      return [{ id: 1 }];
    });
    await expect(service.createRequest("student-user", submission())).rejects.toMatchObject({ statusCode: 409 });
    expect(db.adviserRequest.create).not.toHaveBeenCalled();
    expect(db.defenseConclusion.findFirst).toHaveBeenCalledTimes(2);
  });
  it("Student activity/password status is rechecked after locks", async () => {
    db.$queryRaw.mockImplementation(async () => { accounts["student-user"].isActive = false; return [{ id: 1 }]; });
    await expect(service.createRequest("student-user", submission())).rejects.toMatchObject({ statusCode: 403 });
    expect(db.adviserRequest.create).not.toHaveBeenCalled();
  });
  it("identity changed during signing is denied without silently changing signed values", async () => {
    db.$queryRaw.mockImplementation(async () => { accounts["adv-user"].firstName = "Changed"; return [{ id: 1 }]; });
    await expect(service.createRequest("student-user", submission())).rejects.toMatchObject({ statusCode: 409 });
    expect(db.adviserRequest.create).not.toHaveBeenCalled();
  });
  it("DR-6 availability revoked after signed request/CONFORME blocks approval, preserves immutable evidence", async () => {
    await service.createRequest("student-user", submission()); request.adviserStatus = "CONFORMED"; request.adviserRespondedAt = new Date();
    const signed = clone(evidence), pending = clone(request); adviserProfile.isAvailableAsAdviser = false;
    await expect(service.deanDecideAdviserRequest("dean", request.id, { decision: "APPROVED" })).rejects.toMatchObject({ statusCode: 409 });
    expect(request).toEqual(pending); expect(evidence).toEqual(signed); expect(db.adviserAssignment.create).not.toHaveBeenCalled();
    expect(db.adviserRequestSignedState.update).not.toHaveBeenCalled(); expect(db.adviserRequest.deleteMany).not.toHaveBeenCalled();
    expect(db.adviserRequestOfficialRecord.create).not.toHaveBeenCalled();
  });
  it("Dean approval re-reads availability after waiting for the configuration fence", async () => {
    const original = clone(request), originalEvidence = clone(evidence);
    db.$queryRaw.mockImplementation(async (sql: TemplateStringsArray) => {
      if (sql.join("").includes("administrator_access_lock")) adviserProfile.isAvailableAsAdviser = false;
      return [{ id: 1 }];
    });
    await expect(service.deanDecideAdviserRequest("dean", "request", { decision: "APPROVED" })).rejects.toMatchObject({ statusCode: 409 });
    expect(request).toEqual(original); expect(evidence).toEqual(originalEvidence);
    expect(db.adviserAssignment.create).not.toHaveBeenCalled(); expect(db.adviserRequest.updateMany).not.toHaveBeenCalled();
  });
  it("Dean checks exact current source/ODP immediately before assignment in the transaction", async () => {
    db.defenseConclusion.findFirst.mockImplementation(async () => {
      expect(inTransaction).toBe(true); expect(db.$queryRaw).toHaveBeenCalled(); return clone(context());
    });
    await service.deanDecideAdviserRequest("dean", "request", { decision: "APPROVED" });
    expect(db.adviserAssignment.create.mock.invocationCallOrder[0]).toBeGreaterThan(db.defenseConclusion.findFirst.mock.invocationCallOrder[0]);
    expect(db.adviserRequestOfficialRecord.create).toHaveBeenCalledTimes(1);
    const queries = db.$queryRaw.mock.calls.map(([sql]) => sql.join(""));
    expect(queries[0]).toContain("administrator_access_lock"); expect(queries.some(query => query.includes("FROM panelists"))).toBe(true);
  });
  it("a different passed Title source cannot approve an older signed context", async () => {
    db.defenseConclusion.findFirst.mockResolvedValue({ ...context(), scheduleId: "different-schedule" }); const original = clone(request);
    await expect(service.deanDecideAdviserRequest("dean", "request", { decision: "APPROVED" })).rejects.toMatchObject({ statusCode: 409 });
    expect(request).toEqual(original); expect(db.adviserAssignment.create).not.toHaveBeenCalled();
  });
  it("profile display-name changes preserve the signed GS-020 display snapshot at approval", async () => {
    accounts["adv-user"].firstName = "Updated name";
    const originalEvidence = clone(evidence);
    await service.deanDecideAdviserRequest("dean", "request", { decision: "APPROVED" });
    expect(evidence).toEqual(originalEvidence);
    expect(db.adviserRequestOfficialRecord.create.mock.calls[0][0].data.snapshot.requestedAdviserName).toBe("Ana Chair");
    expect(assignment.adviserId).toBe("adv-user");
  });
  it.each([{ isActive: false }, { mustChangePassword: true }, { role: "ADMIN" }, { role: "FACULTY" }])("current-invalid Student %j cannot use a stale role", async patch => {
    Object.assign(accounts["student-user"], patch);
    await expect(service.listOdpCandidates("student-user")).rejects.toMatchObject({ statusCode: 403 });
    await expect(service.createRequest("student-user", submission())).rejects.toMatchObject({ statusCode: 403 });
    expect(db.adviserRequest.create).not.toHaveBeenCalled();
  });
  it("current Dean capability and post-fence revocation remain authoritative", async () => {
    accounts.dean.capabilityGrants = [{ capabilityKey: "faculty.manage" }];
    await expect(service.deanDecideAdviserRequest("dean", "request", { decision: "APPROVED" })).rejects.toMatchObject({ statusCode: 403 });
    accounts.dean.capabilityGrants = [{ capabilityKey: "adviser.requests.review" }];
    db.$queryRaw.mockImplementation(async () => { accounts.dean.capabilityGrants = []; return [{ id: 1 }]; });
    await expect(service.deanDecideAdviserRequest("dean", "request", { decision: "APPROVED" })).rejects.toMatchObject({ statusCode: 403 });
    expect(db.adviserAssignment.create).not.toHaveBeenCalled();
  });
  it("Full Dean uses enumerated authority while CONFORME/sole-active guards remain mandatory", async () => {
    accounts.dean.administratorAccess.level = "FULL"; accounts.dean.capabilityGrants = [];
    request.adviserStatus = "PENDING";
    await expect(service.deanDecideAdviserRequest("dean", "request", { decision: "APPROVED" })).rejects.toMatchObject({ statusCode: 409 });
    request.adviserStatus = "CONFORMED"; assignment = { id: "existing" };
    await expect(service.deanDecideAdviserRequest("dean", "request", { decision: "APPROVED" })).rejects.toMatchObject({ statusCode: 409 });
  });
  it("no Program scope or load cap is introduced", async () => {
    accounts["adv-user"].programId = "unrelated-program"; adviserProfile.adviserLoad = 9999;
    expect((await service.listOdpCandidates("student-user")).candidates).toHaveLength(1);
    await service.deanDecideAdviserRequest("dean", "request", { decision: "APPROVED" }); expect(assignment.adviserId).toBe("adv-user");
    for (const [query] of db.defenseConclusion.findFirst.mock.calls) expect(JSON.stringify(query.where)).not.toContain("programId");
  });
  it("legacy available-adviser route service delegates to the same bounded ODP candidates; raw directory is retired", async () => {
    expect((await thesis.getAvailableAdvisers("student-user")).map(row => row.userId)).toEqual(["adv-user"]);
    await expect(thesis.getAvailableAdvisers("dean")).rejects.toMatchObject({ statusCode: 403 });
    await expect(new ThesisRepository().getAvailableAdvisers()).rejects.toMatchObject({ statusCode: 410 });
  });
  it("hardened assign alias still delegates to Dean decision and ignores arbitrary adviserId", async () => {
    await thesis.assignAdviser("dean", { requestId: "request", adviserId: "unrelated" }); expect(assignment.adviserId).toBe("adv-user");
  });
  it.each([undefined, null, false])("missing/false explicit availability %j fails the shared predicate", value => {
    expect(evaluateCandidateEligibility({ defenseRole: "CHAIRMAN", userRole: "FACULTY", userIsActive: true,
      hasPanelistProfile: true, panelistIsActive: true, isExternal: false, isAvailableAsAdviser: value }).eligible).toBe(false);
  });
});
