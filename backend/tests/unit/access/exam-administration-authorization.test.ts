import { beforeEach, describe, expect, it, vi } from "vitest";
import { ExamAdministrationAuthorization, EXAM_ADMINISTRATION_CAPABILITY_ENFORCEMENT_ENABLED } from "../../../src/access/exam-administration-authorization";
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
const access = new ExamAdministrationAuthorization(true, load);
beforeEach(() => { vi.clearAllMocks(); current = account(); });

describe("FACULTY-6 target authorization", () => {
  it.each(["exam.schedules.view", "exam.schedules.manage", "exam.records.view", "exam.starts.authorize", "exam.results.finalize", "exam.results.reconsider", "exam.questions.view", "exam.questions.manage", "exam.configuration.manage"] as const)("requires %s, including enumerated Full access", async key => {
    await expect(access.assert("actor", key)).rejects.toMatchObject({ statusCode: 403 });
    current = account([key]); await expect(access.assert("actor", key)).resolves.toBeUndefined();
    current = account([], { administratorAccess: { level: "FULL" } });
    await expect(access.assert("actor", key)).resolves.toBeUndefined();
  });
  it.each([
    { administratorAccess: null }, { administratorAccess: { level: "UNKNOWN" } },
    { capabilityGrants: null }, { capabilityGrants: [{ capabilityKey: "unknown" }] },
    { capabilityGrants: [{ capabilityKey: "essay.evaluate" }] },
    { capabilityGrants: [{ capabilityKey: "exam.records.view" }, { capabilityKey: "exam.records.view" }] },
    { capabilityGrants: [{ capabilityKey: "administrator_access.manage" }] },
    { capabilityGrants: [null] }, { role: "STUDENT" }, { role: "APPLICANT" },
    { role: "FACULTY", panelist: { isActive: true } }, { role: "CUSTOM" },
    { isActive: false }, { mustChangePassword: true }, { id: "someone-else" },
    { administratorAccess: { level: "FULL" }, capabilityGrants: [{ capabilityKey: "essay.evaluate" }] },
  ])("fails closed for invalid current authority %j", async extra => {
    current = account(["exam.starts.authorize"], extra);
    await expect(access.assert("actor", "exam.starts.authorize")).rejects.toMatchObject({ statusCode: 403 });
  });
  it("does not infer broad registries from minimum operation prerequisites", async () => {
    current = account(["exam.schedules.manage"]);
    for (const key of ["exam.schedules.view"] as const) await access.assert("actor", key);
    for (const key of ["exam.records.view", "exam.questions.view"] as const) {
      await expect(access.assert("actor", key)).rejects.toMatchObject({ statusCode: 403 });
    }
  });
  it("reloads after grant revocation and never accepts an omitted/target actor", async () => {
    current = account(["exam.records.view"]); await access.assert("actor", "exam.records.view");
    current.capabilityGrants = [];
    await expect(access.assert("actor", "exam.records.view")).rejects.toMatchObject({ statusCode: 403 });
    await expect(access.assert(undefined as never, "exam.records.view")).rejects.toMatchObject({ statusCode: 403 });
    await expect(access.assert("target-student", "exam.records.view")).rejects.toMatchObject({ statusCode: 403 });
    expect(load).toHaveBeenCalledTimes(3);
  });
  it("does not recover authority from a failed account lookup", async () => {
    const unavailable = new ExamAdministrationAuthorization(true, async () => { throw new Error("unavailable"); });
    await expect(unavailable.assert("actor", "exam.schedules.view")).rejects.toThrow("unavailable");
  });
  it("keeps all production rollout switches dormant, without treating unmapped Admin as Full", async () => {
    expect(EXAM_ADMINISTRATION_CAPABILITY_ENFORCEMENT_ENABLED).toBe(false);
    expect(DIRECT_ACCESS_ENFORCEMENT_ENABLED).toBe(false);
    expect(ADMINISTRATOR_MANAGEMENT_ENABLED).toBe(false);
    const dormant = new ExamAdministrationAuthorization(undefined, load);
    current = account([], { administratorAccess: null });
    await dormant.assert("actor", "exam.starts.authorize"); expect(load).not.toHaveBeenCalled();
    await expect(access.assert("actor", "exam.starts.authorize")).rejects.toMatchObject({ statusCode: 403 });
  });
});

describe("FACULTY-6 transactional current-authority fence", () => {
  it("waits for the shared management fence before reading grants, so revocation while waiting denies", async () => {
    current = account(["exam.starts.authorize"]); await access.assert("actor", "exam.starts.authorize");
    let release!: () => void;
    const waiting = new Promise<void>(resolve => { release = resolve; });
    const tx = {
      $queryRaw: vi.fn().mockImplementationOnce(async () => { await waiting; return [{ id: 1 }]; }).mockResolvedValue([]),
      user: { findUnique: vi.fn(async () => current) },
    };
    const operation = access.assertInTransaction(tx as never, "actor", "exam.starts.authorize");
    expect(tx.user.findUnique).not.toHaveBeenCalled();
    current.capabilityGrants = []; release();
    await expect(operation).rejects.toMatchObject({ statusCode: 403 });
    expect(tx.$queryRaw).toHaveBeenCalledTimes(2);
    expect(tx.user.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "actor" } }));
  });
  it("fails closed on an absent fence and never queries a target as the actor", async () => {
    const tx = { $queryRaw: vi.fn(async () => []), user: { findUnique: vi.fn() } };
    await expect(access.assertInTransaction(tx as never, "actor", "exam.questions.manage")).rejects.toMatchObject({ statusCode: 503 });
    expect(tx.user.findUnique).not.toHaveBeenCalled();
  });
  it("allows a current valid actor and keeps dormant transactions free of access queries", async () => {
    current = account(["exam.questions.manage"]);
    const tx = { $queryRaw: vi.fn(async () => [{ id: 1 }]), user: { findUnique: vi.fn(async () => current) } };
    await access.assertInTransaction(tx as never, "actor", "exam.questions.manage");
    expect(tx.user.findUnique).toHaveBeenCalledTimes(1);
    vi.clearAllMocks(); await new ExamAdministrationAuthorization().assertInTransaction(tx as never, "actor", "exam.questions.manage");
    expect(tx.$queryRaw).not.toHaveBeenCalled(); expect(tx.user.findUnique).not.toHaveBeenCalled();
  });
});


describe("FACULTY-6 explicit exclusions and mixed media identity", () => {
  it.each(["ESSAY_EVALUATION", "RESULT_EMAIL"] as const)("denies %s even for Full and every Exam Admin grant", action => {
    current = account([], { administratorAccess: { level: "FULL" } });
    expect(() => access.assertExcluded(action)).toThrow(expect.objectContaining({ statusCode: 403 }));
    expect(() => new ExamAdministrationAuthorization().assertExcluded(action)).not.toThrow();
  });
  it("derives mixed media identity from the current account instead of a supplied Admin role", async () => {
    current = account([], { role: "APPLICANT", administratorAccess: null });
    expect(await access.mediaActor({ userId: "actor", role: "ADMIN" })).toEqual({ userId: "actor", role: "APPLICANT" });
    current.mustChangePassword = true;
    await expect(access.mediaActor({ userId: "actor", role: "ADMIN" })).rejects.toMatchObject({ statusCode: 403 });
  });
});
