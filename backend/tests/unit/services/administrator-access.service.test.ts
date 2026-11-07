import bcrypt from "bcryptjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("../../../src/config/database", () => ({ default: null }));
import { AdministratorAccessService } from "../../../src/services/administrator-access.service";
import { AdministratorAccessRepository } from "../../../src/repositories/administrator-access.repository";
import { administratorDatabase } from "../../fixtures/administrator-management";
import { DIRECT_ACCESS_ENFORCEMENT_ENABLED } from "../../../src/access/account-access";

let fixture: ReturnType<typeof administratorDatabase>;
let service: AdministratorAccessService;
const create = { firstName: "New", lastName: "Administrator", email: "new@example.test", level: "RESTRICTED", capabilityKeys: ["students.view"] };
beforeEach(() => {
  fixture = administratorDatabase(); service = new AdministratorAccessService(new AdministratorAccessRepository(fixture.database as never), () => true);
});
const account = (id: string) => fixture.control.state.users.find(user => user.id === id)!;

describe("FACULTY-4 current Full-only service", () => {
  it("keeps default production management and general direct enforcement dormant", async () => {
    const dormant = new AdministratorAccessService(new AdministratorAccessRepository(fixture.database as never));
    await expect(dormant.create("full-a", create)).rejects.toMatchObject({ statusCode: 503 });
    await expect(dormant.update("full-a", "restricted", { level: "FULL" })).rejects.toMatchObject({ statusCode: 503 });
    expect(fixture.database.$transaction).not.toHaveBeenCalled(); expect(DIRECT_ACCESS_ENFORCEMENT_ENABLED).toBe(false);
  });
  it.each([
    { administratorAccess: { level: "RESTRICTED" } }, { administratorAccess: null }, { administratorAccess: { level: "full" } },
    { role: "FACULTY" }, { role: "PANELIST" }, { role: "CUSTOM" }, { role: "STUDENT" }, { role: "APPLICANT" },
    { isActive: false }, { mustChangePassword: true }, { capabilityGrants: [{ capabilityKey: "unknown" }] },
    { capabilityGrants: [{ capabilityKey: "essay.evaluate" }] },
  ])("denies non-authoritative current actor %j", async change => {
    Object.assign(account("full-a"), change);
    await expect(service.list("full-a", {})).rejects.toMatchObject({ statusCode: 403 });
    await expect(service.update("full-a", "full-a", { level: "FULL", capabilityKeys: [] })).rejects.toMatchObject({ statusCode: 403 });
    await expect(service.update("full-a", "restricted", { level: "FULL" })).rejects.toMatchObject({ statusCode: 403 });
    expect(fixture.control.state.audits).toEqual([]);
  });
  it("does not bootstrap unmapped accounts or mutate academic identities", async () => {
    account("restricted").administratorAccess = null;
    await expect(service.update("full-a", "restricted", { level: "FULL" })).rejects.toMatchObject({ statusCode: 409 });
    account("restricted").role = "FACULTY";
    await expect(service.update("full-a", "restricted", { level: "FULL" })).rejects.toMatchObject({ statusCode: 404 });
  });
  it("preserves valid FACULTY-1 Full metadata with ordinary direct Admin keys", async () => {
    account("full-a").capabilityGrants = [{ capabilityKey: "students.view" }];
    expect((await service.update("full-a", "full-a", { capabilityKeys: ["students.view", "audit.view"] })).level).toBe("FULL");
  });
  it("fails closed if the migration/fence row is missing", async () => {
    fixture.control.missingFence = true;
    await expect(service.update("full-a", "restricted", { isActive: false })).rejects.toMatchObject({ statusCode: 503 });
    expect(account("restricted").isActive).toBe(true);
  });
  it("returns bounded summaries without credentials, hashes or inherited academic grants", async () => {
    const result = await service.list("full-a", { page: "1", pageSize: "2" });
    expect(result.accounts).toHaveLength(2);
    expect(JSON.stringify(result)).not.toMatch(/passwordHash|preserved-existing-hash|temporaryPassword|essay.evaluate/);
    expect((await service.get("full-a", "full-b")).level).toBe("FULL");
  });
});
describe("FACULTY-4 strict input and privileged credentials", () => {
  it.each([null, [], {}, { role: "ADMIN" }, { actorId: "full-a" }, { passwordHash: "injected" },
    { mustChangePassword: false }, { level: "SUPER_ADMIN" }, { isActive: "false" },
    { capabilityKeys: "students.view" }, { capabilityKeys: ["unknown"] }, { capabilityKeys: ["essay.evaluate"] },
    { capabilityKeys: ["administrator_access.manage"] }, { capabilityKeys: ["/admin/students"] },
    { capabilityKeys: ["students.view", "students.view"] }, { capabilityKeys: [null] },
  ])("rejects patch/body capability injection %j", async input => {
    await expect(service.update("full-a", "restricted", input)).rejects.toMatchObject({ statusCode: 400 });
    expect(fixture.control.state.audits).toEqual([]);
  });
  it.each([{ role: "ADMIN" }, { isActive: true }, { password: "surname123" }, { customRoleId: "legacy" }, { administratorAccess: { level: "FULL" } }])("rejects create mass assignment %j", async injection => {
    await expect(service.create("full-a", { ...create, ...injection })).rejects.toMatchObject({ statusCode: 400 });
  });
  it("creates separate random 256-bit temporary credentials, hashes them and requires password change", async () => {
    const first = await service.create("full-a", create);
    const second = await service.create("full-a", { ...create, email: "second@example.test", level: "FULL", capabilityKeys: [] });
    expect(first.temporaryPassword).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(first.temporaryPassword).not.toBe(second.temporaryPassword);
    expect(await bcrypt.compare(first.temporaryPassword, account(first.account.id).passwordHash)).toBe(true);
    expect(first.account).toMatchObject({ role: "ADMIN", isActive: true, mustChangePassword: true, level: "RESTRICTED" });
    expect(account(second.account.id).mustChangePassword).toBe(true);
    const audit = fixture.control.state.audits[0];
    expect(audit).toMatchObject({ actorId: "full-a", targetId: first.account.id, actionType: "ADMINISTRATOR_ACCESS_CREATED", oldValue: null });
    const event = JSON.parse(audit.description);
    expect(event).toMatchObject({ version: 1, actorUserId: "full-a", targetUserId: first.account.id,
      after: { administratorLevel: "RESTRICTED", capabilities: ["students.view"], isActive: true } });
    expect(new Date(event.occurredAt).getTime()).toBe(audit.createdAt.getTime());
    expect(JSON.stringify(fixture.control.state.audits)).not.toContain(first.temporaryPassword);
    expect(JSON.stringify(await service.get("full-a", first.account.id))).not.toMatch(/passwordHash|temporaryPassword/);
  });
});
describe("FACULTY-4 mutation/audit atomicity and last-Full fence", () => {
  it("audits every grant/revoke, level and status change with actor/target and before/after", async () => {
    await service.update("full-a", "restricted", { capabilityKeys: ["students.view"] });
    await service.update("full-a", "restricted", { level: "FULL", capabilityKeys: [], isActive: false });
    expect(fixture.control.state.audits.map(row => row.actionType)).toEqual([
      "ACCOUNT_CAPABILITY_GRANTED", "ADMINISTRATOR_ACCESS_LEVEL_CHANGED", "ADMINISTRATOR_ACCESS_STATUS_CHANGED", "ACCOUNT_CAPABILITY_REVOKED",
    ]);
    for (const audit of fixture.control.state.audits) {
      expect(audit.actorId).toBe("full-a"); expect(audit.targetId).toBe("restricted");
      expect(JSON.parse(audit.description).before).toBeTruthy(); expect(JSON.parse(audit.description).after).toBeTruthy();
    }
    expect(account("restricted").passwordHash).toBe("preserved-existing-hash");
  });
  it.each(["create", "update", "remove"])("rolls back %s and all required audit evidence on forced audit failure", async operation => {
    const before = structuredClone(fixture.control.state); fixture.control.failAudit = true;
    const call = operation === "create" ? service.create("full-a", create) : operation === "remove" ?
      service.removeAccess("full-a", "full-b") : service.update("full-a", "restricted", { isActive: false, capabilityKeys: ["students.view"] });
    await expect(call).rejects.toThrow("Synthetic audit failure"); expect(fixture.control.state).toEqual(before);
  });
  it("also rolls back earlier successful audit inserts when a later required audit fails", async () => {
    const before = structuredClone(fixture.control.state); fixture.control.failAuditAt = 2;
    await expect(service.update("full-a", "restricted", { level: "FULL", isActive: false }))
      .rejects.toThrow("Synthetic audit failure");
    expect(fixture.control.state).toEqual(before);
  });
  it.each(["demote", "disable", "remove"])("denies %s of the final valid active Full", async operation => {
    account("full-b").isActive = false;
    const call = operation === "remove" ? service.removeAccess("full-a", "full-a") :
      service.update("full-a", "full-a", operation === "demote" ? { level: "RESTRICTED", capabilityKeys: [] } : { isActive: false });
    await expect(call).rejects.toMatchObject({ statusCode: 409 }); expect(account("full-a").isActive).toBe(true);
    expect(account("full-a").administratorAccess?.level).toBe("FULL"); expect(fixture.control.state.audits).toEqual([]);
  });
  it("does not count malformed Full metadata/grants as another Full", async () => {
    account("full-b").capabilityGrants = [{ capabilityKey: "essay.evaluate" }];
    await expect(service.update("full-a", "full-a", { isActive: false })).rejects.toMatchObject({ statusCode: 409 });
  });
  it.each(["demote", "disable", "remove"])("serializes two competing self-%s operations; only one can commit", async operation => {
    const mutation = (id: string) => operation === "remove" ? service.removeAccess(id, id) :
      service.update(id, id, operation === "demote" ? { level: "RESTRICTED", capabilityKeys: [] } : { isActive: false });
    const results = await Promise.allSettled([mutation("full-a"), mutation("full-b")]);
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(fixture.control.state.users.filter(user => user.isActive && user.administratorAccess?.level === "FULL")).toHaveLength(1);
    expect(fixture.database.$transaction).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({ isolationLevel: "ReadCommitted" }));
  });
  it("revalidates a waiting actor after another transaction revokes its Full authority", async () => {
    const held = fixture.control.holdNextFence();
    const demotion = service.update("full-b", "full-a", { level: "RESTRICTED", capabilityKeys: [] });
    await held.entered.promise;
    const waiting = service.update("full-a", "restricted", { level: "FULL" });
    held.release.resolve(); await demotion;
    await expect(waiting).rejects.toMatchObject({ statusCode: 403 });
    expect(account("restricted").administratorAccess?.level).toBe("RESTRICTED");
    expect(fixture.control.state.audits).toHaveLength(1);
  });
  it("removes authority by disabling the retained User; existing IDs/hash/history attribution survive", async () => {
    const removed = await service.removeAccess("full-a", "full-b");
    expect(removed).toMatchObject({ id: "full-b", role: "ADMIN", isActive: false, level: null, capabilityKeys: [] });
    expect(account("full-b").passwordHash).toBe("preserved-existing-hash");
    expect(fixture.control.state.audits[0].actionType).toBe("ADMINISTRATOR_ACCESS_REMOVED");
  });
});
