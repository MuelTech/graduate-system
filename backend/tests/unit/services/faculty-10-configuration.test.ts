import { beforeEach, describe, expect, it, vi } from "vitest";
import bcrypt from "bcryptjs";
const db = vi.hoisted(() => ({
  user: { findUnique: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
  panelist: { findMany: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  accountCapabilityGrant: { createMany: vi.fn(), deleteMany: vi.fn() },
  adviserAssignment: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), deleteMany: vi.fn() },
  adviserRequestOfficialRecord: { update: vi.fn(), deleteMany: vi.fn() },
  auditLog: { create: vi.fn() }, $transaction: vi.fn(), $queryRaw: vi.fn(),
}));
vi.mock("../../../src/config/database", () => ({ default: db }));
import { AdminPanelistService } from "../../../src/services/admin-panelist.service";
import { PanelistService } from "../../../src/services/panelist.service";
import { AdminPanelistRepository } from "../../../src/repositories/admin-panelist.repository";
import { OperationalAuthorization } from "../../../src/access/operational-authorization";
import { FACULTY_CONFIGURATION_ENABLED, FACULTY_AUDIT_ACTIONS } from "../../../src/access/faculty-configuration";
import { isProtectedAccessAuditAction } from "../../../src/access/access-audit";
let actor: any, profile: any;
const auth = new OperationalAuthorization(true, async id => id === "actor" ? actor : null as any);
const service = new AdminPanelistService(auth);
const valid = { email: "faculty@example.test", firstName: "First", lastName: "Surname" };
function account(keys: string[] = [], extra = {}) {
  actor = { id: "actor", role: "ADMIN", isActive: true, mustChangePassword: false, panelist: null,
    administratorAccess: { level: "RESTRICTED" }, capabilityGrants: keys.map(capabilityKey => ({ capabilityKey })), ...extra };
}
function faculty(role = "FACULTY") {
  return { id: "profile", userId: "faculty", isExternal: false, isActive: true, isAvailableAsAdviser: true,
    highestEducationalAttainment: "Doctorate", specialization: "Research", officeAffiliation: "Graduate School", createdAt: new Date(),
    user: { id: "faculty", role, ...valid, isActive: true, title: null, suffix: null, passwordHash: "private-hash",
      mustChangePassword: false, customRoleId: "private-role", administratorAccess: null, capabilityGrants: [],
      createdBy: { firstName: "Creator", lastName: "Name", passwordHash: "nested-secret" }, updatedBy: null,
      createdAt: new Date(), updatedAt: new Date() } };
}
const clone = <T>(value: T): T => structuredClone(value);
beforeEach(() => {
  vi.resetAllMocks(); account(); profile = faculty();
  db.user.findUnique.mockImplementation(async ({ where }) => where.id === "actor" ? clone(actor) : clone(profile?.user));
  db.panelist.findMany.mockImplementation(async () => profile ? [clone(profile)] : []);
  db.panelist.findUnique.mockImplementation(async () => profile ? clone(profile) : null);
  db.$queryRaw.mockResolvedValue([{ id: 1 }]);
  db.$transaction.mockImplementation(async work => {
    const before = clone(profile);
    try { return await work(db); } catch (error) { profile = before; throw error; }
  });
  db.user.create.mockImplementation(async ({ data }) => { profile.user = { ...profile.user, ...data, id: "faculty", capabilityGrants: [] }; return { id: "faculty" }; });
  db.panelist.create.mockImplementation(async ({ data }) => { profile = { ...profile, ...data }; return { id: "profile" }; });
  db.user.updateMany.mockImplementation(async ({ data }) => { Object.assign(profile.user, data); return { count: 1 }; });
  db.panelist.update.mockImplementation(async ({ data }) => { Object.assign(profile, data); return { id: "profile" }; });
  db.accountCapabilityGrant.createMany.mockImplementation(async ({ data }) => {
    profile.user.capabilityGrants.push(...data.map((row: any) => ({ capabilityKey: row.capabilityKey }))); return { count: data.length };
  });
  db.accountCapabilityGrant.deleteMany.mockImplementation(async ({ where }) => {
    profile.user.capabilityGrants = profile.user.capabilityGrants.filter((row: any) => !where.capabilityKey.in.includes(row.capabilityKey)); return { count: 1 };
  });
  db.adviserAssignment.findFirst.mockResolvedValue(null); db.auditLog.create.mockResolvedValue({});
});
const actions = [
  ["faculty.view", () => service.getAllPanelists("actor"), db.panelist.findMany],
  ["faculty.view", () => service.getPanelistById("profile", "actor"), db.panelist.findUnique],
  ["faculty.manage", () => service.updatePanelist("profile", { specialization: "Updated" }, "actor"), db.user.updateMany],
  ["faculty.manage", () => service.createPanelist(valid, "actor"), db.user.create],
] as const;
describe.each(actions)("FACULTY-10 exact management action %s", (key, invoke, work) => {
  it("allows exact Restricted key and enumerated Full", async () => {
    account([key]); await invoke(); expect(work).toHaveBeenCalled();
    account([], { administratorAccess: { level: "FULL" } }); await invoke();
  });
  it.each([[], ["settings.manage"], ["adviser.requests.review"], ["essay.evaluate"]].map(keys => ({ keys })))("denies missing/unrelated access %j", async ({ keys }) => {
    account(keys); await expect(invoke()).rejects.toMatchObject({ statusCode: 403 }); expect(work).not.toHaveBeenCalled();
  });
  it.each([{ isActive: false }, { mustChangePassword: true }, { administratorAccess: null },
    { administratorAccess: { level: "INVALID" } }, { capabilityGrants: null },
    { capabilityGrants: [{ capabilityKey: "unknown" }] }, { capabilityGrants: [{ capabilityKey: "faculty.view" }, { capabilityKey: "faculty.view" }] },
    { id: "other" }, { role: "STUDENT" },
  ])("rejects current-invalid Administrator %j", async extra => {
    account([key], extra); await expect(invoke()).rejects.toMatchObject({ statusCode: 403 }); expect(work).not.toHaveBeenCalled();
  });
  it("reloads authority after revocation", async () => {
    account([key]); await invoke(); account([]); work.mockClear();
    await expect(invoke()).rejects.toMatchObject({ statusCode: 403 }); expect(work).not.toHaveBeenCalled();
  });
});
describe("FACULTY-11 page-specific management context", () => {
  it("returns only a current server-derived boolean for view, manage and Full", async () => {
    account(["faculty.view"]); expect(await service.getManagementContext("actor")).toEqual({ canManage: false });
    account(["faculty.manage"]); expect(await service.getManagementContext("actor")).toEqual({ canManage: true });
    account([], { administratorAccess: { level: "FULL" } });
    expect(await service.getManagementContext("actor")).toEqual({ canManage: true });
    account(["faculty.view"]); expect(await service.getManagementContext("actor")).toEqual({ canManage: false });
    expect(db.panelist.findMany).not.toHaveBeenCalled();
    expect(db.panelist.findUnique).not.toHaveBeenCalled();
  });
  it.each([[], ["settings.manage"], ["essay.evaluate"]])("rejects absent/unrelated/malformed authority %j", async (...keys) => {
    account(keys as string[]);
    await expect(service.getManagementContext("actor")).rejects.toMatchObject({ statusCode: 403 });
  });
  it("does not invent management authority while dormant", async () => {
    account([], { administratorAccess: { level: "FULL" } });
    await expect(new AdminPanelistService().getManagementContext("actor")).rejects.toMatchObject({ statusCode: 503 });
  });
});

describe("FACULTY-10 bounded DTOs, contracts, provisioning and history", () => {
  it("faculty.view never permits a mutation", async () => {
    account(["faculty.view"]); await expect(service.updatePanelist("profile", { isActive: false }, "actor")).rejects.toMatchObject({ statusCode: 403 });
    await expect(service.createPanelist(valid, "actor")).rejects.toMatchObject({ statusCode: 403 });
  });
  it.each(["FACULTY", "PANELIST"])("safe %s list/detail excludes credentials, private internals and unrelated access", async role => {
    account(["faculty.view"]); profile = faculty(role);
    for (const dto of [(await service.getAllPanelists("actor"))[0], await service.getPanelistById("profile", "actor")]) {
      expect(dto.user.role).toBe(role); expect(dto.user.createdBy).toEqual({ firstName: "Creator", lastName: "Name" });
      for (const field of ["passwordHash", "temporaryPassword", "administratorAccess", "capabilityGrants", "mustChangePassword", "customRoleId", "nested-secret"]) expect(JSON.stringify(dto)).not.toContain(field);
      expect(dto.capabilityKeys).toEqual([]);
    }
    const select = db.panelist.findMany.mock.calls[0][0].select;
    expect(select.user.select).not.toHaveProperty("passwordHash"); expect(select.user.select).not.toHaveProperty("mustChangePassword");
    expect(db.panelist.findMany.mock.calls[0][0].where).toEqual({ user: { role: { in: ["FACULTY", "PANELIST"] } } });
  });
  it.each(["ADMIN", "STUDENT", "CUSTOM", "APPLICANT"])("incompatible %s target cannot be edited or receive essay authority", async role => {
    account(["faculty.manage"]); profile = faculty(role);
    await expect(service.updatePanelist("profile", { capabilityKeys: ["essay.evaluate"] }, "actor")).rejects.toMatchObject({ statusCode: 404 });
    expect(db.user.updateMany).not.toHaveBeenCalled(); expect(db.accountCapabilityGrant.createMany).not.toHaveBeenCalled();
  });
  it.each([null, { userId: "other" }, { user: { ...faculty().user, administratorAccess: { level: "FULL" } } },
    { user: { ...faculty().user, capabilityGrants: [{ capabilityKey: "settings.manage" }] } },
    { user: { ...faculty().user, capabilityGrants: [{ capabilityKey: "essay.evaluate" }, { capabilityKey: "essay.evaluate" }] } },
  ])("invalid target/profile state %j fails closed", async extra => {
    account(["faculty.manage"]); profile = extra === null ? null : { ...profile, ...extra };
    await expect(service.updatePanelist("profile", { isAvailableAsAdviser: false }, "actor")).rejects.toBeInstanceOf(Error);
    expect(db.user.updateMany).not.toHaveBeenCalled(); expect(db.panelist.update).not.toHaveBeenCalled();
  });
  it.each(["role", "level", "administratorAccess", "passwordHash", "password", "mustChangePassword", "createdById", "updatedById",
    "adviserId", "studentId", "assignmentId", "panelAssignmentId", "chairman", "panelist", "rapporteur", "facilitator", "adviser", "loadLimit", "programId", "essayProgramIds", "unknown"])("rejects prohibited field %s", async field => {
    account(["faculty.manage"]);
    await expect(service.updatePanelist("profile", { [field]: true }, "actor")).rejects.toMatchObject({ statusCode: 400 });
    await expect(service.createPanelist({ ...valid, [field]: true }, "actor")).rejects.toMatchObject({ statusCode: 400 });
    expect(db.user.updateMany).not.toHaveBeenCalled(); expect(db.user.create).not.toHaveBeenCalled();
  });
  it.each([["unknown"], ["faculty.manage"], ["administrator_access.manage"], ["CHAIRMAN"], ["essay.evaluate", "essay.evaluate"], null, "essay.evaluate"].map(keys => ({ keys })))("rejects invalid/category/duplicate capability list %j", async ({ keys }) => {
    account(["faculty.manage"]); await expect(service.updatePanelist("profile", { capabilityKeys: keys }, "actor")).rejects.toMatchObject({ statusCode: 400 });
  });
  it.each([{}, null, [], { isActive: "false" }, { isExternal: 1 }, { isAvailableAsAdviser: null }, { firstName: "" }, { email: "invalid" }])("rejects malformed input %j", async input => {
    account(["faculty.manage"]); await expect(service.updatePanelist("profile", input, "actor")).rejects.toMatchObject({ statusCode: 400 });
  });
  it("provisions unpredictable one-time credentials, hashes only, current FACULTY writer and password gate", async () => {
    account(["faculty.manage"]);
    const first = await service.createPanelist({ ...valid, capabilityKeys: ["essay.evaluate"] }, "actor");
    const data = db.user.create.mock.calls[0][0].data;
    expect(first.temporaryPassword).toMatch(/^[A-Za-z0-9_-]{43}$/); expect(first.temporaryPassword).not.toBe(valid.lastName.toUpperCase());
    expect(await bcrypt.compare(first.temporaryPassword, data.passwordHash)).toBe(true); expect(bcrypt.getRounds(data.passwordHash)).toBe(12);
    expect(data).toMatchObject({ role: "FACULTY", mustChangePassword: true, createdById: "actor", updatedById: "actor" });
    expect(first.account.capabilityKeys).toEqual(["essay.evaluate"]); expect(first.account.isAvailableAsAdviser).toBe(false);
    expect(JSON.stringify(db.auditLog.create.mock.calls)).not.toContain(first.temporaryPassword);
    expect(JSON.stringify(db.auditLog.create.mock.calls)).not.toContain(data.passwordHash);
    expect(JSON.stringify(db.user.create.mock.calls)).not.toContain(first.temporaryPassword);
    const second = await service.createPanelist(valid, "actor"); expect(second.temporaryPassword).not.toBe(first.temporaryPassword);
    expect(second.account.capabilityKeys).toEqual([]);
  });
  it("profile-only edits preserve existing credential hash, password gate, IDs and historical records", async () => {
    account(["faculty.manage"]); const previous = clone(profile);
    await service.updatePanelist("profile", { specialization: "New field", isAvailableAsAdviser: false }, "actor");
    expect(profile.user.passwordHash).toBe(previous.user.passwordHash); expect(profile.user.mustChangePassword).toBe(false);
    expect(profile.id).toBe(previous.id); expect(profile.userId).toBe(previous.userId);
    expect(db.user.updateMany.mock.calls[0][0].data).not.toHaveProperty("passwordHash");
    for (const mutation of [db.adviserAssignment.create, db.adviserAssignment.update, db.adviserAssignment.deleteMany,
      db.adviserRequestOfficialRecord.update, db.adviserRequestOfficialRecord.deleteMany]) expect(mutation).not.toHaveBeenCalled();
  });
  it("account activation and deactivation synchronize profile and User without touching grants/history", async () => {
    account(["faculty.manage"]);
    for (const isActive of [false, true]) {
      await service.updatePanelist("profile", { isActive }, "actor"); expect(profile.user.isActive).toBe(isActive); expect(profile.isActive).toBe(isActive);
    }
    expect(db.accountCapabilityGrant.deleteMany).not.toHaveBeenCalled();
  });
  it("grants/revokes only essay.evaluate with protected atomic before/after evidence", async () => {
    account(["faculty.manage"]);
    await service.updatePanelist("profile", { capabilityKeys: ["essay.evaluate"] }, "actor");
    await service.updatePanelist("profile", { capabilityKeys: [] }, "actor");
    const events = db.auditLog.create.mock.calls.map(([arg]) => arg.data);
    expect(events.map(row => row.actionType)).toContain("ACCOUNT_CAPABILITY_GRANTED"); expect(events.map(row => row.actionType)).toContain("ACCOUNT_CAPABILITY_REVOKED");
    expect(events.every(row => isProtectedAccessAuditAction(row.actionType))).toBe(true);
    for (const row of events) {
      const event = JSON.parse(row.description); expect(event).toMatchObject({ actorUserId: "actor", targetUserId: "faculty", version: 1 });
      expect(event.occurredAt).toBeTruthy(); expect(event.before).toBeTruthy(); expect(event.after).toBeTruthy();
    }
  });
  it("External effective availability is false; explicit true conflicts are rejected", async () => {
    account(["faculty.manage"]); profile.isExternal = true;
    expect((await service.getPanelistById("profile", "actor")).isAvailableAsAdviser).toBe(false);
    await expect(service.updatePanelist("profile", { isAvailableAsAdviser: true }, "actor")).rejects.toMatchObject({ statusCode: 400 });
    await expect(service.createPanelist({ ...valid, isExternal: true, isAvailableAsAdviser: true }, "actor")).rejects.toMatchObject({ statusCode: 400 });
    await service.updatePanelist("profile", { specialization: "Safe profile edit" }, "actor"); expect(profile.isAvailableAsAdviser).toBe(false);
  });
  it("safe classification changes preserve identifiers and force External availability off", async () => {
    account(["faculty.manage"]); await service.updatePanelist("profile", { isExternal: true }, "actor");
    expect(profile).toMatchObject({ id: "profile", userId: "faculty", isExternal: true, isAvailableAsAdviser: false });
    await service.updatePanelist("profile", { isExternal: false, isAvailableAsAdviser: true }, "actor"); expect(profile.isAvailableAsAdviser).toBe(true);
  });
  it.each([false, true])("DR-7 active or historical AdviserAssignment with current External=%j permanently blocks classification repair/reclassification", async isExternal => {
    account(["faculty.manage"]); profile.isExternal = isExternal; const before = clone(profile);
    db.adviserAssignment.findFirst.mockResolvedValue({ id: "historical-or-active-assignment" });
    await expect(service.updatePanelist("profile", { isExternal: !isExternal }, "actor")).rejects.toMatchObject({
      statusCode: 409,
      message: "This Adviser classification requires institutional review.",
    });
    expect(db.adviserAssignment.findFirst).toHaveBeenCalledWith({
      where: { adviserId: "faculty" },
      select: { id: true },
    });
    expect(profile).toEqual(before); expect(db.user.updateMany).not.toHaveBeenCalled(); expect(db.auditLog.create).not.toHaveBeenCalled();
  });
  it("DR-7 completed/inactive historical AdviserAssignment blocks Internal-to-External reclassification even for Full Administrator with no override", async () => {
    account([], { administratorAccess: { level: "FULL" } });
    const historicalAssignments = [{ id: "completed-assignment-1", adviserId: "faculty", studentId: "student-1", isActive: false }];
    db.adviserAssignment.findFirst.mockImplementation(async ({ where }: any) => {
      const match = historicalAssignments.find(row =>
        row.adviserId === where.adviserId && (where.isActive === undefined || row.isActive === where.isActive),
      );
      return match ? { id: match.id } : null;
    });
    const before = clone(profile);
    await expect(service.updatePanelist("profile", { isExternal: true }, "actor")).rejects.toMatchObject({
      statusCode: 409,
      message: "This Adviser classification requires institutional review.",
    });
    expect(profile).toEqual(before);
    expect(db.panelist.update).not.toHaveBeenCalled();
    expect(db.adviserAssignment.update).not.toHaveBeenCalled();
    expect(db.adviserAssignment.deleteMany).not.toHaveBeenCalled();
  });
  it("DR-7 Internal Faculty without any authoritative AdviserAssignment (even if pending request or CONFORME exists) may be reclassified as External", async () => {
    account(["faculty.manage"]);
    db.adviserAssignment.findFirst.mockResolvedValue(null);
    await service.updatePanelist("profile", { isExternal: true }, "actor");
    expect(profile).toMatchObject({ id: "profile", userId: "faculty", isExternal: true, isAvailableAsAdviser: false });
    expect(db.adviserAssignment.findFirst).toHaveBeenCalledWith({
      where: { adviserId: "faculty" },
      select: { id: true },
    });
  });
  it("availability change with an existing or historical Internal Adviser preserves their academic relationship", async () => {
    account(["faculty.manage"]); db.adviserAssignment.findFirst.mockResolvedValue({ id: "historical-assignment" });
    await service.updatePanelist("profile", { isAvailableAsAdviser: false }, "actor"); expect(profile.isAvailableAsAdviser).toBe(false);
    expect(db.adviserAssignment.update).not.toHaveBeenCalled(); expect(db.adviserAssignment.deleteMany).not.toHaveBeenCalled();
  });
  it("authority revoked while waiting for fence prevents target reads/writes", async () => {
    account(["faculty.manage"]); db.$queryRaw.mockImplementation(async () => { account([]); return [{ id: 1 }]; });
    await expect(service.updatePanelist("profile", { isActive: false }, "actor")).rejects.toMatchObject({ statusCode: 403 });
    expect(db.panelist.findUnique).not.toHaveBeenCalled(); expect(db.user.updateMany).not.toHaveBeenCalled();
  });
  it("mutation locks fence, actor, target User and exact profile before writes", async () => {
    account(["faculty.manage"]); await service.updatePanelist("profile", { isActive: false }, "actor");
    const queries = db.$queryRaw.mock.calls.map(([sql]) => sql.join(""));
    expect(queries[0]).toContain("administrator_access_lock"); expect(queries[1]).toContain("FROM users");
    expect(queries[2]).toContain("FROM users"); expect(queries[3]).toContain("FROM panelists");
    expect(db.user.updateMany.mock.invocationCallOrder[0]).toBeGreaterThan(db.$queryRaw.mock.invocationCallOrder[3]);
  });
  it("audit failure rolls back profile/status/grants in the transactional test double", async () => {
    account(["faculty.manage"]); const before = clone(profile); db.auditLog.create.mockRejectedValue(new Error("audit failed"));
    await expect(service.updatePanelist("profile", { isActive: false, capabilityKeys: ["essay.evaluate"] }, "actor")).rejects.toThrow("audit failed");
    expect(profile).toEqual(before);
    await expect(service.createPanelist(valid, "actor")).rejects.toThrow("audit failed");
  });
  it("identity collisions return a controlled conflict without provisioning or disclosing credentials", async () => {
    account(["faculty.manage"]); db.user.create.mockRejectedValue({ code: "P2002" });
    await expect(service.createPanelist(valid, "actor")).rejects.toMatchObject({ statusCode: 409 });
    expect(db.panelist.create).not.toHaveBeenCalled(); expect(db.auditLog.create).not.toHaveBeenCalled();
  });
  it("a conditional academic-target update conflict prevents profile and grant writes", async () => {
    account(["faculty.manage"]); db.user.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.updatePanelist("profile", { capabilityKeys: ["essay.evaluate"] }, "actor")).rejects.toMatchObject({ statusCode: 409 });
    expect(db.panelist.update).not.toHaveBeenCalled(); expect(db.accountCapabilityGrant.createMany).not.toHaveBeenCalled();
  });
  it("legacy repository writers and Faculty self-availability cannot bypass the management service", async () => {
    const repo = new AdminPanelistRepository();
    await expect(repo.updateWithUserTransaction("profile", { isActive: false }, "actor")).rejects.toMatchObject({ statusCode: 403 });
    await expect(repo.createWithUserTransaction(valid, "injected-hash", "actor")).rejects.toMatchObject({ statusCode: 403 });
    await expect(new PanelistService(auth).toggleAvailability("faculty", true)).rejects.toMatchObject({ statusCode: 403 });
    expect(db.panelist.update).not.toHaveBeenCalled();
  });
  it.each(["PANELIST", "FACULTY"])("own %s profile remains readable with External availability false", async role => {
    profile = faculty(role); profile.isExternal = true;
    db.panelist.findFirst.mockImplementation(async () => clone(profile));
    const self = new PanelistService(new OperationalAuthorization(true, async () => ({ ...profile.user, panelist: { isActive: true } })));
    expect(await self.getPanelistByUserId("faculty")).toMatchObject({ id: "profile", userId: "faculty", isAvailableAsAdviser: false });
    await expect(self.toggleAvailability("faculty", true)).rejects.toMatchObject({ statusCode: 403 });
  });
  it("omitted administrative actors fail closed; dormant management cannot provision live accounts", async () => {
    account([], { administratorAccess: { level: "FULL" } });
    await expect(service.getAllPanelists()).rejects.toMatchObject({ statusCode: 403 });
    await expect(service.getPanelistById("profile")).rejects.toMatchObject({ statusCode: 403 });
    expect(FACULTY_CONFIGURATION_ENABLED).toBe(false);
    await expect(new AdminPanelistService().createPanelist(valid, "actor")).rejects.toMatchObject({ statusCode: 503 });
    expect(db.user.create).not.toHaveBeenCalled();
  });
});
