import { beforeEach, describe, expect, it, vi } from "vitest";
import { signedRequestEvidence } from "../../fixtures/adviser-request-signed";
import { defenseAdviserEndpoints } from "../../fixtures/defense-adviser-endpoints";

const db = vi.hoisted(() => ({
  $transaction: vi.fn(), $queryRaw: vi.fn(),
  user: { findUnique: vi.fn(), findMany: vi.fn() }, panelist: { findUnique: vi.fn() },
  thesisRecord: { findUnique: vi.fn(), updateMany: vi.fn(), update: vi.fn(), findMany: vi.fn() },
  defenseSchedule: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  adviserRequest: { findUnique: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
  adviserRequestSignedState: { findUnique: vi.fn() }, adviserRequestOfficialRecord: { create: vi.fn() },
  adviserAssignment: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn() },
  panelAssignment: { findMany: vi.fn(), findFirst: vi.fn(), createMany: vi.fn(), updateMany: vi.fn(), create: vi.fn(), update: vi.fn() },
  auditLog: { create: vi.fn() },
}));
vi.mock("../../../src/config/database", () => ({ default: db }));
vi.mock("../../../src/services/notification.service", () => ({ NotificationService: class { notifyDefenseCorrection = vi.fn(); } }));
import { DefenseAdviserAuthorization } from "../../../src/access/defense-adviser-authorization";
import { ThesisService } from "../../../src/services/thesis.service";
import { ThesisRepository } from "../../../src/repositories/thesis.repository";
import { AdviserRequestService } from "../../../src/services/adviser-request.service";
import { DefenseScheduleCorrectionService } from "../../../src/services/defense-schedule-correction.service";
import { DefenseApplicationDocumentHistoryService } from "../../../src/services/defense-document-history.service";
import { OfficialDefenseRecordService } from "../../../src/services/official-defense-record.service";
import { assertManualDefenseParticipants } from "../../../src/services/defense-participant-identity";
import { authorizeDefenseRoomJoin } from "../../../src/realtime/defense-realtime.authorization";

const keys = [...new Set(defenseAdviserEndpoints.map(row => row[2]))];
let current: any;
const loadActor = vi.fn(async () => current);
const authorization = new DefenseAdviserAuthorization(true, loadActor);
const service = new ThesisService(authorization);
const repo = new ThesisRepository(authorization);
const dean = new AdviserRequestService(authorization);
const correction = new DefenseScheduleCorrectionService(authorization);
const records = new OfficialDefenseRecordService(authorization);
const history = new DefenseApplicationDocumentHistoryService(undefined, authorization);
const request = () => ({ id: "request", studentId: "student-1", requestedAdviserId: "adv-user", reason: "Please advise",
  sourceDefenseScheduleId: "schedule-1", requestDate: new Date("2026-09-25"), status: "PENDING", adviserStatus: "CONFORMED",
  adviserRespondedAt: new Date("2026-09-26"), deanStatus: "PENDING" });
function actor(grants: readonly string[] = keys, extra = {}) {
  current = { id: "actor", email: "actor@example.test", role: "ADMIN", isActive: true, mustChangePassword: false,
    panelist: null, administratorAccess: { level: "RESTRICTED" }, capabilityGrants: grants.map(capabilityKey => ({ capabilityKey })), ...extra };
}
function manual(type = "TITLE_DEFENSE") {
  return [{ userId: "chair", role: "CHAIRMAN" }, ...["p1", "p2", "p3", ...(type === "TITLE_DEFENSE" ? ["p4"] : [])].map(userId => ({ userId, role: "PANELIST" })),
    { userId: "rap", role: "RAPPORTEUR" }, { userId: "fac", role: "FACILITATOR" }];
}
const input = (type = "TITLE_DEFENSE") => ({ defenseDate: "2026-11-15", defenseTime: "09:00", venueOrLink: "Room 201", defenseType: type, assignments: manual(type) });
function thesis(type = "TITLE_DEFENSE") {
  return { id: "thesis", stage: type === "TITLE_DEFENSE" ? "TITLE" : "PROPOSAL", status: "APPROVED",
    student: { id: "student-1", program: { programType: "MASTERS" } },
    thesisDocuments: [{ id: "doc", thesisId: "thesis", docType: type === "TITLE_DEFENSE" ? "TITLE_PROPOSAL" : "PROPOSAL_CHAPTERS",
      defenseStage: type === "TITLE_DEFENSE" ? "TITLE" : "PROPOSAL", isCurrent: true, uploadedAt: new Date() }],
    adviserCertifications: type === "TITLE_DEFENSE" ? [] : [{ status: "ISSUED", defenseStage: type, reviewedDocumentId: "doc" }] };
}
beforeEach(() => {
  vi.resetAllMocks(); actor();
  db.$transaction.mockImplementation(async fn => fn(db));
  db.$queryRaw.mockResolvedValue([{ id: 1 }]);
  db.user.findUnique.mockImplementation(async ({ where }) => where.id === "actor" ? current : { id: where.id, role: "FACULTY", isActive: true });
  db.user.findMany.mockImplementation(async ({ where }) => where.id.in.map((id: string) => ({ id, role: "FACULTY", isActive: true, panelist: { isActive: true } })));
  db.panelist.findUnique.mockResolvedValue({ isExternal: false, isActive: true, isAvailableAsAdviser: true });
  db.adviserRequest.findUnique.mockResolvedValue(request()); db.adviserRequest.updateMany.mockResolvedValue({ count: 1 });
  db.adviserRequestSignedState.findUnique.mockResolvedValue(signedRequestEvidence(request() as never));
  db.adviserAssignment.findFirst.mockResolvedValue(null); db.adviserAssignment.findMany.mockResolvedValue([{ id: "active", adviserId: "adv-user" }]);
  db.defenseSchedule.findMany.mockResolvedValue([]); db.thesisRecord.findUnique.mockResolvedValue(thesis());
  db.thesisRecord.updateMany.mockResolvedValue({ count: 1 }); db.thesisRecord.update.mockResolvedValue({});
  db.defenseSchedule.create.mockImplementation(async ({ data }) => ({ id: "schedule", ...data }));
  db.defenseSchedule.findUnique.mockResolvedValue({ id: "schedule", thesisId: "thesis", defenseType: "TITLE_DEFENSE", sessionStatus: "SCHEDULED", conclusion: null,
    defenseDate: new Date("2026-11-15"), defenseTime: new Date("1970-01-01T09:00Z"), venueOrLink: "Room 201",
    thesis: thesis(), panelAssignments: [] });
  db.panelAssignment.findMany.mockResolvedValue([]);
});

describe("FACULTY-7 service-level current authority", () => {
  const reads = [
    () => service.getPendingDefenses("actor"), () => service.getApprovedDefenses("actor"), () => service.getAllDefenses("actor"),
    () => service.getDefenseApplicationsPaginated({}, "actor"), () => service.getDefenseWorkflowSummary({}, "actor"), () => service.getDefenseApplicationDetail("thesis", "actor"),
    () => service.getAllAdviserRequests("actor"), () => service.getAllActiveAssignments("actor"), () => dean.listDeanReviewRequests("actor"),
    () => service.getActivePanelistCandidates("actor"), () => service.searchActivePanelists({}, "actor"), () => service.getApprovedApplicationsPaginated({}, "actor"),
    () => service.getCommitteePolicy("TITLE_DEFENSE", "MASTERS", "actor"), () => service.getScheduledDefenseDetail("schedule", "actor"),
    () => service.getScheduledDefenseSubmission("schedule", { userId: "actor", role: "ADMIN" }),
    () => history.getDocumentHistory("thesis", "TITLE", "actor"), () => records.listAdminDefenseRecords({}, "actor"),
    () => records.getAdminDefenseRecordDetail("schedule", "actor"), () => service.getAllRapReports("actor"),
  ];
  it.each(reads.map((run, i) => ({ i, run })))("read $i rejects direct invocation without current grants", async ({ run }) => {
    actor([]); await expect(run()).rejects.toMatchObject({ statusCode: 403 });
    expect(db.thesisRecord.findUnique).not.toHaveBeenCalled(); expect(db.defenseSchedule.findUnique).not.toHaveBeenCalled();
  });
  it("does not allow a scheduling capability to manage Faculty or other catalog domains", async () => {
    actor(["defense.schedules.manage"]);
    await authorization.assert("actor", "defense.schedules.view");
    const { resolveConfiguredAccountAccess, hasConfiguredCapability } = await import("../../../src/access/account-access");
    for (const key of ["faculty.manage", "applicants.view", "students.view"]) expect(hasConfiguredCapability(resolveConfiguredAccountAccess(current), key)).toBe(false);
  });
  it("freshly denies revoked authority and invalid actor IDs", async () => {
    await authorization.assert("actor", "defense.records.view"); actor([]);
    await expect(authorization.assert("actor", "defense.records.view")).rejects.toMatchObject({ statusCode: 403 });
    await expect(authorization.assert("", "defense.records.view")).rejects.toMatchObject({ statusCode: 403 });
  });
  it("legacy availability is Student-only in target mode and reminders have no accepted send authority", async () => {
    await expect(service.getAvailableAdvisers("actor")).rejects.toMatchObject({ statusCode: 403 });
    await expect(service.getMissingSignaturesForRap("rap")).rejects.toMatchObject({ statusCode: 403 });
    await expect(service.distributeRapReport("rap")).rejects.toMatchObject({ statusCode: 409 });
  });
});

const mutations = [
  { name: "Dean decision", run: () => dean.deanDecideAdviserRequest("actor", "request", { decision: "APPROVED" }) },
  { name: "compatibility assignment", run: () => service.assignAdviser("actor", { requestId: "request", adviserId: "attacker" }) },
  { name: "approval", run: () => repo.approveApplication({ thesisId: "thesis", actorId: "actor", stage: "TITLE" }) },
  { name: "rejection", run: () => repo.rejectApplication({ thesisId: "thesis", actorId: "actor", stage: "TITLE", reason: "Missing evidence" }) },
  { name: "scheduling", run: () => repo.scheduleDefense("thesis", "actor", input()) },
  { name: "correction", run: () => correction.correctSchedule("schedule", "actor", input()) },
];
describe("FACULTY-7 owning transaction fence", () => {
  it.each(mutations)("$name rechecks revocation after waiting, before domain reads/writes", async ({ run }) => {
    let entered!: () => void, release!: () => void;
    const waiting = new Promise<void>(resolve => { entered = resolve; });
    const fence = new Promise<void>(resolve => { release = resolve; });
    db.$queryRaw.mockImplementationOnce(async () => { entered(); await fence; return [{ id: 1 }]; });
    const result = run(); const assertion = expect(result).rejects.toMatchObject({ statusCode: 403 });
    await waiting; actor([]); release(); await assertion;
    expect(db.adviserRequest.updateMany).not.toHaveBeenCalled(); expect(db.adviserAssignment.create).not.toHaveBeenCalled();
    expect(db.thesisRecord.updateMany).not.toHaveBeenCalled(); expect(db.defenseSchedule.create).not.toHaveBeenCalled();
    expect(db.defenseSchedule.update).not.toHaveBeenCalled(); expect(db.auditLog.create).not.toHaveBeenCalled();
    // Dean's preflight may read outside its owning transaction. No workflow lock or transaction read follows the fence denial.
    expect(db.$queryRaw).toHaveBeenCalledTimes(2);
    expect(db.$queryRaw.mock.calls[0][0].join("?")).toContain("administrator_access_lock");
    expect(db.$queryRaw.mock.calls[1][0].join("?")).toContain("users");
  });
  it.each(mutations)("$name fails closed when the shared fence is absent", async ({ run }) => {
    db.$queryRaw.mockResolvedValueOnce([]);
    await expect(run()).rejects.toMatchObject({ statusCode: 503 });
    expect(db.auditLog.create).not.toHaveBeenCalled();
  });
  it.each(mutations)("$name allows current authority and locks before domain reads", async ({ run }) => {
    await run();
    expect(db.$queryRaw.mock.calls[0][0].join("?")).toContain("administrator_access_lock");
    expect(db.user.findUnique.mock.invocationCallOrder[0]).toBeGreaterThan(db.$queryRaw.mock.invocationCallOrder[1]);
  });
});

describe("FACULTY-7 GS-020 invariants", () => {
  it("wrapper requires requestId and ignores arbitrary replacement Adviser", async () => {
    await expect(service.assignAdviser("actor", { id: "request", adviserId: "attacker" })).rejects.toMatchObject({ statusCode: 400 });
    await service.assignAdviser("actor", { requestId: "request", adviserId: "attacker" });
    expect(db.adviserAssignment.create).toHaveBeenCalledWith({ data: expect.objectContaining({ adviserId: "adv-user", studentId: "student-1" }) });
  });
  it.each([{ adviserStatus: "PENDING" }, { deanStatus: "APPROVED" }, { status: "REJECTED" }])("rejects invalid current request %j", async change => {
    db.adviserRequest.findUnique.mockResolvedValue({ ...request(), ...change });
    await expect(dean.deanDecideAdviserRequest("actor", "request", { decision: "APPROVED" })).rejects.toMatchObject({ statusCode: 409 });
    expect(db.adviserAssignment.create).not.toHaveBeenCalled();
  });
  it.each([{ isExternal: true }, { isActive: false }, { isAvailableAsAdviser: false }, null])("rejects ineligible new Adviser profile %j", async change => {
    db.panelist.findUnique.mockResolvedValue(change && { isExternal: false, isActive: true, isAvailableAsAdviser: true, ...change });
    await expect(dean.deanDecideAdviserRequest("actor", "request", { decision: "APPROVED" })).rejects.toMatchObject({ statusCode: 409 });
    expect(db.adviserAssignment.create).not.toHaveBeenCalled();
  });
  it("review cannot bypass signed evidence", async () => {
    db.adviserRequestSignedState.findUnique.mockResolvedValue(null);
    await expect(dean.deanDecideAdviserRequest("actor", "request", { decision: "APPROVED" })).rejects.toMatchObject({ statusCode: 409 });
    expect(db.adviserAssignment.create).not.toHaveBeenCalled();
  });
});

describe("FACULTY-7 write-boundary participant identity", () => {
  const invalid = [null, { role: "ADMIN" }, { role: "STUDENT" }, { role: "APPLICANT" }, { role: "CUSTOM" },
    { isActive: false }, { panelist: null }, { panelist: { isActive: false } }];
  it.each(invalid)("rejects forged/stale candidate %j on both scheduling and correction", async change => {
    db.user.findMany.mockResolvedValue(change ? manual().map((row, i) => ({ id: row.userId, role: "FACULTY", isActive: true, panelist: { isActive: true }, ...(i === 0 ? change : {}) })) : []);
    await expect(repo.scheduleDefense("thesis", "actor", input())).rejects.toMatchObject({ statusCode: 400 });
    await expect(correction.correctSchedule("schedule", "actor", input())).rejects.toMatchObject({ statusCode: 400 });
    expect(db.defenseSchedule.create).not.toHaveBeenCalled(); expect(db.defenseSchedule.update).not.toHaveBeenCalled();
  });
  it.each(["PANELIST", "FACULTY"])("accepts current %s identity across all four DR-5 External manual roles (CHAIRMAN, PANELIST, RAPPORTEUR, FACILITATOR)", async role => {
    const externalCommittee = manual("TITLE_DEFENSE").map(row => ({
      userId: `ext-${row.userId}`,
      role: row.role,
    }));
    db.user.findMany.mockResolvedValue(
      externalCommittee.map(row => ({
        id: row.userId,
        role,
        isActive: true,
        panelist: { isActive: true, isExternal: true, isAvailableAsAdviser: false },
      })),
    );
    await assertManualDefenseParticipants(db as never, externalCommittee);
    await repo.scheduleDefense("thesis", "actor", { ...input("TITLE_DEFENSE"), assignments: externalCommittee });
    expect(db.panelAssignment.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining(
        externalCommittee.map(row => expect.objectContaining({ userId: row.userId, role: row.role })),
      ),
    });
    await correction.correctSchedule("schedule", "actor", { ...input("TITLE_DEFENSE"), assignments: externalCommittee });
    expect(db.panelAssignment.createMany).toHaveBeenLastCalledWith({
      data: expect.arrayContaining(
        externalCommittee.map(row => expect.objectContaining({ userId: row.userId, role: row.role })),
      ),
    });
  });
  it("rejects External Adviser assignment on Title, Proposal, and Final Defense scheduling and correction", async () => {
    await expect(
      repo.scheduleDefense("thesis", "actor", {
        ...input("TITLE_DEFENSE"),
        assignments: [...manual("TITLE_DEFENSE"), { userId: "ext-adv", role: "ADVISER" }],
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
    await expect(
      correction.correctSchedule("schedule", "actor", {
        ...input("TITLE_DEFENSE"),
        assignments: [...manual("TITLE_DEFENSE"), { userId: "ext-adv", role: "ADVISER" }],
      }),
    ).rejects.toMatchObject({ statusCode: 400 });

    db.thesisRecord.findUnique.mockResolvedValue(thesis("PROPOSAL_DEFENSE"));
    await expect(
      repo.scheduleDefense("thesis", "actor", {
        ...input("PROPOSAL_DEFENSE"),
        assignments: [...manual("PROPOSAL_DEFENSE"), { userId: "ext-adv", role: "ADVISER" }],
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
    await expect(
      correction.correctSchedule("schedule", "actor", {
        ...input("PROPOSAL_DEFENSE"),
        assignments: [...manual("PROPOSAL_DEFENSE"), { userId: "ext-adv", role: "ADVISER" }],
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
  it("committee candidate queries include active External Faculty without filtering by isExternal or isAvailableAsAdviser", async () => {
    db.user.findMany.mockResolvedValue([]);
    await repo.getActivePanelistCandidates();
    const candidatesWhere = db.user.findMany.mock.calls[0][0].where;
    expect(candidatesWhere.panelist).toEqual({ isActive: true });
    expect(candidatesWhere.panelist.isExternal).toBeUndefined();
    expect(candidatesWhere.panelist.isAvailableAsAdviser).toBeUndefined();

    db.user.findMany.mockClear();
    (db.user as any).count = vi.fn().mockResolvedValue(0);
    db.$transaction.mockImplementationOnce(async (items: any) => Promise.all(items));
    await repo.searchActivePanelists({ page: 1, pageSize: 20, search: "Ext" });
    const searchWhere = db.user.findMany.mock.calls[0][0].where;
    expect(searchWhere.panelist.isActive).toBe(true);
    expect(searchWhere.panelist.isExternal).toBeUndefined();
    expect(searchWhere.panelist.isAvailableAsAdviser).toBeUndefined();
  });
  it("derives Proposal Adviser at commit without availability filtering and rejects substitution", async () => {
    db.thesisRecord.findUnique.mockResolvedValue(thesis("PROPOSAL_DEFENSE"));
    await repo.scheduleDefense("thesis", "actor", input("PROPOSAL_DEFENSE"));
    expect(db.panelAssignment.createMany).toHaveBeenCalledWith({ data: expect.arrayContaining([expect.objectContaining({ userId: "adv-user", role: "ADVISER" })]) });
    expect(db.panelist.findUnique).not.toHaveBeenCalled();
    await expect(repo.scheduleDefense("thesis", "actor", { ...input("PROPOSAL_DEFENSE"), assignments: [...manual("PROPOSAL_DEFENSE"), { userId: "attacker", role: "ADVISER" }] })).rejects.toMatchObject({ statusCode: 400 });
  });
  it("fails closed for duplicate active Adviser state", async () => {
    db.thesisRecord.findUnique.mockResolvedValue(thesis("PROPOSAL_DEFENSE"));
    db.adviserAssignment.findMany.mockResolvedValue([{ id: "a", adviserId: "adv-user" }, { id: "b", adviserId: "other" }]);
    await expect(repo.scheduleDefense("thesis", "actor", input("PROPOSAL_DEFENSE"))).rejects.toMatchObject({ statusCode: 409 });
    expect(db.defenseSchedule.create).not.toHaveBeenCalled();
  });
  it("does not let valid Faculty identities bypass duplicate-person/role policy", async () => {
    const assignments = manual(); assignments[1].userId = assignments[0].userId;
    await expect(repo.scheduleDefense("thesis", "actor", { ...input(), assignments })).rejects.toMatchObject({ statusCode: 400 });
    await expect(correction.correctSchedule("schedule", "actor", { ...input(), assignments })).rejects.toMatchObject({ statusCode: 400 });
  });
  it.each(["IN_PROGRESS", "CONCLUDED", "CANCELLED", "RESCHEDULED"])("management cannot correct %s", async sessionStatus => {
    db.defenseSchedule.findUnique.mockResolvedValue({ sessionStatus });
    await expect(correction.correctSchedule("schedule", "actor", input())).rejects.toMatchObject({ statusCode: 409 });
    expect(db.defenseSchedule.update).not.toHaveBeenCalled();
  });
});

describe("FACULTY-7 academic separation beyond HTTP", () => {
  it.each(["FULL", "ALL_FACULTY_7"])("%s cannot enter an unassigned realtime room", async level => {
    if (level === "FULL") actor([], { administratorAccess: { level: "FULL" } });
    const store = { getSessionStatus: vi.fn(async () => "IN_PROGRESS"), hasPanelAssignment: vi.fn(async () => false), listAssignedUserIds: vi.fn() };
    expect(await authorizeDefenseRoomJoin(store, "cbb1276a-0551-4bd4-a341-d8f70672de76", current.id)).toEqual({ ok: false, code: "FORBIDDEN" });
  });
});

describe("FACULTY-7 administrative response projections", () => {
  const identity = { id: true, firstName: true, lastName: true, email: true };
  const applicationSelect = {
    id: true, stage: true, status: true, outcome: true, rejectionReason: true, createdAt: true,
    student: { select: { id: true, studentNumber: true, user: { select: identity },
      program: { select: { id: true, programName: true, programType: true } } } },
    thesisTitles: { select: { id: true, titleText: true, isSelected: true } },
    assignment: { select: { id: true, adviser: { select: identity } } },
  };
  const applicationMethods = [
    { method: "getPendingDefenses", where: { status: "PENDING" }, orderBy: undefined },
    { method: "getApprovedDefenses", where: { status: "APPROVED" }, orderBy: undefined },
    { method: "getAllDefenses", where: undefined, orderBy: { createdAt: "desc" } },
  ] as const;
  const forbidden = ["passwordHash", "mustChangePassword", "customRoleId", "createdById", "updatedById",
    "cellphone", "dateOfBirth", "residencyStartDate", "curriculumType", "alignmentStatus", "enrollmentDate",
    "corExtractedYearLevel", "corExtractedScholarship", "lastCorSyncAt", "orNumber", "amountPaid",
    "filePath", "storageKey", "storageProvider", "checksum", "checksumAlgorithm", "uploadedById", "supersedesDocumentId"];

  // Model Prisma's select semantics over a deliberately over-broad fixture. An absent
  // select or a broad nested `true` returns the raw fixture, so payload tests detect leaks.
  function selectedFixture(value: any, select?: Record<string, any>): any {
    if (!select || value == null) return value;
    if (Array.isArray(value)) return value.map(row => selectedFixture(row, select));
    return Object.fromEntries(Object.entries(select).map(([key, projection]) =>
      [key, projection === true ? value[key] : selectedFixture(value[key], projection.select)]));
  }
  function rawApplication(status: string, createdAt: string) {
    const privateFields = Object.fromEntries(forbidden.map(key => [key, `private-${key}`]));
    const user = { ...privateFields, id: "student-user", firstName: "Sam", lastName: "Student", email: "student@example.test" };
    return { ...privateFields, id: status, studentId: "student-1", assignmentId: "assignment", stage: "TITLE", status,
      outcome: null, rejectionReason: status === "REJECTED" ? "Correct the evidence" : null, createdAt,
      titleApplicationSubmittedAt: "unneeded-stage-timestamp", proposalApplicationSubmittedAt: null, finalApplicationSubmittedAt: null,
      student: { ...privateFields, id: "student-1", studentNumber: "2026-001", userId: user.id, programId: "program", user,
        program: { ...privateFields, id: "program", programName: "MIT", programType: "MASTERS", department: "unrelated", examPassingScore: 75 } },
      thesisTitles: [{ ...privateFields, id: "title", thesisId: status, titleText: "Research Title", isSelected: false, createdAt }],
      assignment: { ...privateFields, id: "assignment", studentId: "student-1", adviserId: "adviser", assignedDate: createdAt, createdAt, isActive: true,
        adviser: { ...user, id: "adviser", firstName: "Ana", lastName: "Adviser", email: "adviser@example.test", panelist: { ...privateFields, isActive: true } } },
      thesisDocuments: [{ ...privateFields, id: "document", docType: "RECEIPT", defenseStage: "TITLE", isCurrent: true, uploadedAt: createdAt }],
    };
  }
  function expectedApplication(status: string, createdAt: string) {
    return { id: status, stage: "TITLE", status, outcome: null,
      rejectionReason: status === "REJECTED" ? "Correct the evidence" : null, createdAt,
      student: { id: "student-1", studentNumber: "2026-001",
        user: { id: "student-user", firstName: "Sam", lastName: "Student", email: "student@example.test" },
        program: { id: "program", programName: "MIT", programType: "MASTERS" } },
      thesisTitles: [{ id: "title", titleText: "Research Title", isSelected: false }],
      assignment: { id: "assignment", adviser: { id: "adviser", firstName: "Ana", lastName: "Adviser", email: "adviser@example.test" } } };
  }
  function assertNoPrivateFields(value: any) {
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      expect(forbidden, `unexpected field ${key}`).not.toContain(key);
      expect(key).not.toBe("thesisDocuments");
      assertNoPrivateFields(child);
    }
  }
  it.each(applicationMethods)("$method uses an explicit complete application-list select with unchanged filter/order", async ({ method, where, orderBy }) => {
    db.thesisRecord.findMany.mockResolvedValue([]);
    await repo[method]();
    expect(db.thesisRecord.findMany).toHaveBeenCalledExactlyOnceWith({
      ...(where ? { where } : {}), select: applicationSelect, ...(orderBy ? { orderBy } : {}),
    });
  });
  it.each(applicationMethods)("$method returns only safe fields through the actual service, preserving rows and order", async ({ method }) => {
    const raw = [rawApplication("PENDING", "2026-11-01"), rawApplication("REJECTED", "2026-11-03"), rawApplication("APPROVED", "2026-11-02")];
    db.thesisRecord.findMany.mockImplementation(async query => {
      const rows = raw.filter(row => !query.where?.status || row.status === query.where.status);
      if (query.orderBy?.createdAt === "desc") rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return rows.map(row => selectedFixture(row, query.select));
    });
    const payload = JSON.parse(JSON.stringify(await service[method]("actor")));
    const expected = method === "getPendingDefenses" ? [expectedApplication("PENDING", "2026-11-01")]
      : method === "getApprovedDefenses" ? [expectedApplication("APPROVED", "2026-11-02")]
        : [expectedApplication("REJECTED", "2026-11-03"), expectedApplication("APPROVED", "2026-11-02"), expectedApplication("PENDING", "2026-11-01")];
    expect(payload).toEqual(expected);
    assertNoPrivateFields(payload);
  });
  it.each(applicationMethods)("$method preserves nullable assignment/context and title selection without loading documents", async ({ method }) => {
    const status = method === "getApprovedDefenses" ? "APPROVED" : "PENDING";
    const raw = { ...rawApplication(status, "2026-11-01"), stage: "FINAL", outcome: "REDEFENSE_REQUIRED", assignment: null };
    raw.student.program = null as any;
    raw.thesisTitles[0].isSelected = true;
    db.thesisRecord.findMany.mockImplementation(async query => [selectedFixture(raw, query.select)]);
    const payload = JSON.parse(JSON.stringify(await repo[method]()));
    const expected = { ...expectedApplication(status, "2026-11-01"), stage: "FINAL", outcome: "REDEFENSE_REQUIRED", assignment: null };
    expected.student.program = null as any;
    expected.thesisTitles[0].isSelected = true;
    expect(payload).toEqual([expected]);
    assertNoPrivateFields(payload);
  });
  it("Adviser request/assignment overviews omit account credentials and unrelated metadata", async () => {
    await repo.getAllAdviserRequests();
    const requests = db.adviserRequest.findMany.mock.calls[0][0];
    expect(requests.include.student.include.user).toEqual({ select: identity });
    expect(requests.include.requestedAdviser).toEqual({ select: identity });
    await repo.getAllActiveAssignments();
    const assignments = db.adviserAssignment.findMany.mock.calls[0][0];
    expect(assignments.include.student.include.user).toEqual({ select: identity });
    expect(Object.keys(assignments.include.adviser.select).sort()).toEqual([...Object.keys(identity), "panelist"].sort());
    expect(assignments.include.adviser.select.panelist.select).toEqual({ specialization: true, officeAffiliation: true, isExternal: true, isActive: true, isAvailableAsAdviser: true });
  });
  it("committee candidates select identity and scheduling profile instead of the whole User", async () => {
    db.user.findMany.mockResolvedValue([]);
    await repo.getActivePanelistCandidates();
    const query = db.user.findMany.mock.calls[0][0];
    expect(query.include).toBeUndefined();
    expect(Object.keys(query.select).sort()).toEqual([...Object.keys(identity), "panelist"].sort());
    expect(query.where.isActive).toBe(true); expect(query.where.panelist.isActive).toBe(true);
  });
});
