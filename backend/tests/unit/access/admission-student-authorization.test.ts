import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdmissionStudentAuthorization, ADMISSION_STUDENT_CAPABILITY_ENFORCEMENT_ENABLED } from "../../../src/access/admission-student-authorization";
import { DIRECT_ACCESS_ENFORCEMENT_ENABLED } from "../../../src/access/account-access";
import { ADMINISTRATOR_MANAGEMENT_ENABLED } from "../../../src/access/administrator-management";
import type { CurrentAccount } from "../../../src/services/current-account";

const account = (keys: string[] = [], extra = {}): CurrentAccount => ({
  id: "actor", email: "actor@example.test", role: "ADMIN", isActive: true,
  mustChangePassword: false, panelist: null, administratorAccess: { level: "RESTRICTED" },
  capabilityGrants: keys.map(capabilityKey => ({ capabilityKey })), ...extra,
} as CurrentAccount);
let current: CurrentAccount;
const load = vi.fn(async () => current);
const access = new AdmissionStudentAuthorization(true, load);
beforeEach(() => { vi.clearAllMocks(); current = account(); });

describe("FACULTY-5 target authorization", () => {
  it.each(["applicants.view", "waivers.view", "waivers.manage", "cor.view", "cor.verify", "students.view", "students.comprehensive_exam.manage"] as const)("requires %s, including enumerated Full access", async key => {
    await expect(access.assert("actor", key)).rejects.toMatchObject({ statusCode: 403 });
    current = account([key]); await expect(access.assert("actor", key)).resolves.toBeUndefined();
    current = account([], { administratorAccess: { level: "FULL" } });
    await expect(access.assert("actor", key)).resolves.toBeUndefined();
  });
  it.each([
    { administratorAccess: null }, { administratorAccess: { level: "UNKNOWN" } },
    { capabilityGrants: null }, { capabilityGrants: [{ capabilityKey: "unknown" }] },
    { capabilityGrants: [{ capabilityKey: "essay.evaluate" }] },
    { capabilityGrants: [{ capabilityKey: "cor.view" }, { capabilityKey: "cor.view" }] },
    { capabilityGrants: [{ capabilityKey: "administrator_access.manage" }] },
    { capabilityGrants: [null] }, { role: "STUDENT" }, { role: "APPLICANT" },
    { role: "FACULTY", panelist: { isActive: true } }, { role: "CUSTOM" },
    { isActive: false }, { mustChangePassword: true }, { id: "someone-else" },
    { administratorAccess: { level: "FULL" }, capabilityGrants: [{ capabilityKey: "essay.evaluate" }] },
  ])("fails closed for invalid current authority %j", async extra => {
    current = account(["cor.verify"], extra);
    await expect(access.assert("actor", "cor.verify")).rejects.toMatchObject({ statusCode: 403 });
  });
  it("does not infer broad registries from minimum operation prerequisites", async () => {
    current = account(["cor.verify", "waivers.manage"]);
    for (const key of ["cor.view", "waivers.view"] as const) await access.assert("actor", key);
    for (const key of ["applicants.view", "students.view"] as const) {
      await expect(access.assert("actor", key)).rejects.toMatchObject({ statusCode: 403 });
    }
  });
  it("reloads after grant revocation and never accepts an omitted/target actor", async () => {
    current = account(["students.view"]); await access.assert("actor", "students.view");
    current.capabilityGrants = [];
    await expect(access.assert("actor", "students.view")).rejects.toMatchObject({ statusCode: 403 });
    await expect(access.assert(undefined as never, "students.view")).rejects.toMatchObject({ statusCode: 403 });
    await expect(access.assert("target-student", "students.view")).rejects.toMatchObject({ statusCode: 403 });
    expect(load).toHaveBeenCalledTimes(3);
  });
  it("does not recover authority from a failed account lookup", async () => {
    const unavailable = new AdmissionStudentAuthorization(true, async () => { throw new Error("unavailable"); });
    await expect(unavailable.assert("actor", "applicants.view")).rejects.toThrow("unavailable");
  });
  it("keeps all production rollout switches dormant, without treating unmapped Admin as Full", async () => {
    expect(ADMISSION_STUDENT_CAPABILITY_ENFORCEMENT_ENABLED).toBe(false);
    expect(DIRECT_ACCESS_ENFORCEMENT_ENABLED).toBe(false);
    expect(ADMINISTRATOR_MANAGEMENT_ENABLED).toBe(false);
    const dormant = new AdmissionStudentAuthorization(undefined, load);
    current = account([], { administratorAccess: null });
    await dormant.assert("actor", "cor.verify"); expect(load).not.toHaveBeenCalled();
    await expect(access.assert("actor", "cor.verify")).rejects.toMatchObject({ statusCode: 403 });
  });
});

describe("FACULTY-5 transactional current-authority fence", () => {
  it("waits for the shared management fence before reading grants, so revocation while waiting denies", async () => {
    current = account(["cor.verify"]); await access.assert("actor", "cor.verify");
    let release!: () => void;
    const waiting = new Promise<void>(resolve => { release = resolve; });
    const tx = {
      $queryRaw: vi.fn().mockImplementationOnce(async () => { await waiting; return [{ id: 1 }]; }).mockResolvedValue([]),
      user: { findUnique: vi.fn(async () => current) },
    };
    const operation = access.assertInTransaction(tx as never, "actor", "cor.verify");
    expect(tx.user.findUnique).not.toHaveBeenCalled();
    current.capabilityGrants = []; release();
    await expect(operation).rejects.toMatchObject({ statusCode: 403 });
    expect(tx.$queryRaw).toHaveBeenCalledTimes(2);
    expect(tx.user.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "actor" } }));
  });
  it("fails closed on an absent fence and never queries a target as the actor", async () => {
    const tx = { $queryRaw: vi.fn(async () => []), user: { findUnique: vi.fn() } };
    await expect(access.assertInTransaction(tx as never, "actor", "waivers.manage")).rejects.toMatchObject({ statusCode: 503 });
    expect(tx.user.findUnique).not.toHaveBeenCalled();
  });
  it("allows a current valid actor and keeps dormant transactions free of access queries", async () => {
    current = account(["waivers.manage"]);
    const tx = { $queryRaw: vi.fn(async () => [{ id: 1 }]), user: { findUnique: vi.fn(async () => current) } };
    await access.assertInTransaction(tx as never, "actor", "waivers.manage");
    expect(tx.user.findUnique).toHaveBeenCalledTimes(1);
    vi.clearAllMocks(); await new AdmissionStudentAuthorization().assertInTransaction(tx as never, "actor", "waivers.manage");
    expect(tx.$queryRaw).not.toHaveBeenCalled(); expect(tx.user.findUnique).not.toHaveBeenCalled();
  });
});
