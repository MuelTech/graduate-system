import { beforeEach, describe, expect, it, vi } from "vitest";
const db = vi.hoisted(() => ({
  user: { findUnique: vi.fn() }, $transaction: vi.fn(), $queryRaw: vi.fn(),
  systemSetting: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  emailTemplate: { findMany: vi.fn(), update: vi.fn() },
  auditLog: { findMany: vi.fn(), count: vi.fn() },
  emailLog: { findMany: vi.fn(), count: vi.fn() },
}));
vi.mock("../../../src/config/database", () => ({ default: db }));
import { OperationalAuthorization, OPERATIONAL_ENFORCEMENT_ENABLED } from "../../../src/access/operational-authorization";
import { DIRECT_ACCESS_ENFORCEMENT_ENABLED } from "../../../src/access/account-access";
import { SettingsService } from "../../../src/services/settings.service";
import { EmailLogService } from "../../../src/services/email-log.service";
import { StorageHealthService } from "../../../src/services/storage-health.service";
import { UploadTelemetry } from "../../../src/storage/upload-telemetry";
import { AdminPanelistService } from "../../../src/services/admin-panelist.service";
import { EvaluationService } from "../../../src/services/evaluation.service";
import { EXAM_CONFIGURATION_KEY } from "../../../src/services/exam-configuration.rules";
import { ORDINARY_SETTING_KEYS } from "../../../src/access/operational-settings-policy";

let current: any;
const load = vi.fn(async () => current);
const auth = new OperationalAuthorization(true, load);
const settings = new SettingsService(auth);
const email = new EmailLogService(auth);
const diagnostics = {
  providerName: "local", listManagedObjects: vi.fn(), legacyOrUnclassifiedSummary: vi.fn(),
  tempSummary: vi.fn(), capacity: vi.fn(),
};
const storageRepo = {
  getReferenceCounts: vi.fn(), listManagedCorUploads: vi.fn(), listManagedThesisDocuments: vi.fn(),
  listManagedExamMedia: vi.fn(), listLegacyCorUploads: vi.fn(), listLegacyThesisDocuments: vi.fn(),
};
const storage = new StorageHealthService(diagnostics as never, storageRepo as never,
  { staleTempHours: 24, minFreePercent: null }, new UploadTelemetry(), 200, auth);
function account(keys: string[] = [], extra = {}) {
  current = { id: "actor", role: "ADMIN", isActive: true, mustChangePassword: false, panelist: null,
    administratorAccess: { level: "RESTRICTED" }, capabilityGrants: keys.map(capabilityKey => ({ capabilityKey })), ...extra };
}
beforeEach(() => {
  vi.resetAllMocks(); account();
  db.user.findUnique.mockImplementation(async () => current);
  db.$transaction.mockImplementation(async work => work(db)); db.$queryRaw.mockResolvedValue([{ id: 1 }]);
  db.systemSetting.findMany.mockResolvedValue([{ settingKey: "ACADEMIC_YEAR", settingValue: "2026" }]);
  db.systemSetting.findUnique.mockResolvedValue({ settingKey: "ACADEMIC_YEAR" }); db.systemSetting.update.mockResolvedValue({});
  db.emailTemplate.findMany.mockResolvedValue([]); db.emailTemplate.update.mockResolvedValue({ templateKey: "memo_broadcast" });
  db.auditLog.findMany.mockResolvedValue([]); db.auditLog.count.mockResolvedValue(0);
  db.emailLog.findMany.mockResolvedValue([]); db.emailLog.count.mockResolvedValue(0);
  diagnostics.listManagedObjects.mockResolvedValue({ objects: [], symlinks: [] });
  diagnostics.legacyOrUnclassifiedSummary.mockResolvedValue({ count: 0, totalBytes: 0 });
  diagnostics.tempSummary.mockResolvedValue({ fileCount: 0, totalBytes: 0, staleFiles: 0 });
  diagnostics.capacity.mockResolvedValue({ available: false }); storageRepo.getReferenceCounts.mockResolvedValue({});
  for (const method of ["listManagedCorUploads", "listManagedThesisDocuments", "listManagedExamMedia", "listLegacyCorUploads", "listLegacyThesisDocuments"] as const) storageRepo[method].mockResolvedValue([]);
});
const actions = [
  ["settings.view", () => settings.getAllSettings("actor"), db.systemSetting.findMany],
  ["settings.manage", () => settings.updateSetting("ACADEMIC_YEAR", "2027", "actor"), db.systemSetting.update],
  ["email.configuration.manage", () => settings.getAllEmailTemplates("actor"), db.emailTemplate.findMany],
  ["email.configuration.manage", () => settings.updateEmailTemplate("memo_broadcast", "subject", "body", "actor"), db.emailTemplate.update],
  ["audit.view", () => settings.getAuditLogs({}, "actor"), db.auditLog.findMany],
  ["email.logs.view", () => email.getLogs("actor", 1, 20), db.emailLog.findMany],
  ["storage.health.view", () => storage.getHealth("actor"), diagnostics.listManagedObjects],
  ["storage.integrity.scan", () => storage.runIntegrityScan("actor"), storageRepo.listManagedCorUploads],
] as const;
describe.each(actions)("FACULTY-9 service boundary %s", (key, invoke, work) => {
  it("requires exact capability, accepts Full through catalog", async () => {
    account([key]); await invoke(); expect(work).toHaveBeenCalled();
    account([], { administratorAccess: { level: "FULL" } }); await invoke();
  });
  it.each([[], ["repository.view"], ["essay.evaluate"]].map(keys => ({ keys })))("denies unrelated/missing authority %j before work", async ({ keys }) => {
    account(keys); await expect(invoke()).rejects.toMatchObject({ statusCode: 403 }); expect(work).not.toHaveBeenCalled();
  });
  it.each([
    { isActive: false }, { mustChangePassword: true }, { administratorAccess: null },
    { administratorAccess: { level: "INVALID" } }, { capabilityGrants: null },
    { capabilityGrants: [{ capabilityKey: "unknown" }] },
    { capabilityGrants: [{ capabilityKey: "settings.view" }, { capabilityKey: "settings.view" }] },
    { role: "STUDENT" }, { id: "other" },
  ])("denies invalid current authority %j", async extra => {
    account([key], extra); await expect(invoke()).rejects.toMatchObject({ statusCode: 403 }); expect(work).not.toHaveBeenCalled();
  });
  it("reloads grants on next invocation", async () => {
    account([key]); await invoke(); account([]); work.mockClear();
    await expect(invoke()).rejects.toMatchObject({ statusCode: 403 }); expect(work).not.toHaveBeenCalled();
  });
});

describe("FACULTY-9 safe settings and exclusions", () => {
  it.each(ORDINARY_SETTING_KEYS)("allows only exact ordinary key %s", async key => {
    account(["settings.manage"]); db.systemSetting.findUnique.mockResolvedValue({ settingKey: key });
    await settings.updateSetting(key, "stored value", "actor");
    expect(db.systemSetting.update).toHaveBeenCalledWith(expect.objectContaining({ where: { settingKey: key, NOT: { settingKey: EXAM_CONFIGURATION_KEY } } }));
  });
  it.each(["UNKNOWN", "administrator_access.manage", "ADMIN_ACCESS", "SESSION_TIMEOUT", "JWT_SECRET", EXAM_CONFIGURATION_KEY, "academic_year", "ACADEMIC_YEAR ", "__proto__", "ÁCADEMIC_YEAR"])("rejects sensitive/unknown/alias key %s", async key => {
    account([], { administratorAccess: { level: "FULL" } });
    await expect(settings.updateSetting(key, "value", "actor")).rejects.toMatchObject({ statusCode: 403 });
    expect(db.systemSetting.update).not.toHaveBeenCalled();
  });
  it("rejects a mismatched DB canonical key even if DB collation matched the request", async () => {
    account(["settings.manage"]); db.systemSetting.findUnique.mockResolvedValue({ settingKey: "academic_year" });
    await expect(settings.updateSetting("ACADEMIC_YEAR", "value", "actor")).rejects.toMatchObject({ statusCode: 403 });
    expect(db.systemSetting.update).not.toHaveBeenCalled();
  });
  it("filters read results even under case-insensitive DB collation", async () => {
    account(["settings.view"]); db.systemSetting.findMany.mockResolvedValue([
      { settingKey: "ACADEMIC_YEAR" }, { settingKey: "academic_year" }, { settingKey: "JWT_SECRET" }, { settingKey: EXAM_CONFIGURATION_KEY },
    ]);
    expect(await settings.getAllSettings("actor")).toEqual([{ settingKey: "ACADEMIC_YEAR" }]);
    expect(db.systemSetting.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { settingKey: { not: EXAM_CONFIGURATION_KEY, in: [...ORDINARY_SETTING_KEYS] } } }));
  });
  it("template update is awaited and returns the persisted result", async () => {
    account(["email.configuration.manage"]);
    expect(await settings.updateEmailTemplate("memo_broadcast", "subject", "body", "actor")).toEqual({ templateKey: "memo_broadcast" });
    db.emailTemplate.update.mockRejectedValue(new Error("persistence failed"));
    await expect(settings.updateEmailTemplate("memo_broadcast", "subject", "body", "actor")).rejects.toThrow("persistence failed");
  });
  it("template, log, storage, audit read and destructive authority remain separate", async () => {
    account(["email.logs.view"]); await expect(settings.getAllEmailTemplates("actor")).rejects.toMatchObject({ statusCode: 403 });
    account(["email.configuration.manage"]); await expect(email.getLogs("actor", 1, 20)).rejects.toMatchObject({ statusCode: 403 });
    account(["storage.health.view"]); await expect(storage.runIntegrityScan("actor")).rejects.toMatchObject({ statusCode: 403 });
    for (const keys of [["audit.view"], ["settings.manage"]]) {
      account(keys); await expect(settings.deleteAuditLog("id", "actor")).rejects.toMatchObject({ statusCode: 403 });
      await expect(settings.deleteAuditLogs(["id"], "actor")).rejects.toMatchObject({ statusCode: 403 });
    }
    account([], { administratorAccess: { level: "FULL" } });
    await expect(settings.deleteAuditLogs(["id"], "actor")).rejects.toMatchObject({ statusCode: 403 });
  });
  it("deferred Expert and Faculty administration cannot execute even for Full", async () => {
    account([], { administratorAccess: { level: "FULL" } });
    await expect(new EvaluationService(auth).assignExpert("id", { assignedById: "actor" })).rejects.toMatchObject({ statusCode: 403 });
    const faculty = new AdminPanelistService(auth);
    for (const call of [() => faculty.getAllPanelists(), () => faculty.getPanelistById("id"),
      () => faculty.createPanelist({}, "actor"), () => faculty.updatePanelist("id", {}, "actor")]) {
      await expect(call()).rejects.toMatchObject({ statusCode: 403 });
    }
  });
  it("direct omitted actors fail closed", async () => {
    account([], { administratorAccess: { level: "FULL" } });
    for (const call of [() => settings.getAllSettings(), () => settings.getAllEmailTemplates(),
      () => settings.getAuditLogs({}), () => storage.getHealth(), () => storage.runIntegrityScan()]) {
      await expect(call()).rejects.toMatchObject({ statusCode: 403 });
    }
  });
  it("rechecks authority after the shared fence, before mutation", async () => {
    account(["settings.manage"]);
    db.$queryRaw.mockImplementation(async (sql: TemplateStringsArray) => {
      if (sql.join("").includes("administrator_access_lock")) { account([]); return [{ id: 1 }]; }
      return [];
    });
    await expect(settings.updateSetting("ACADEMIC_YEAR", "value", "actor")).rejects.toMatchObject({ statusCode: 403 });
    expect(db.$queryRaw.mock.calls[0][0].join("")).toContain("administrator_access_lock");
    expect(db.$queryRaw.mock.calls[1][0].join("")).toContain("FROM users");
    expect(db.systemSetting.update).not.toHaveBeenCalled();
  });
  it("missing access fence denies the write", async () => {
    account(["settings.manage"]); db.$queryRaw.mockResolvedValue([]);
    await expect(settings.updateSetting("ACADEMIC_YEAR", "value", "actor")).rejects.toMatchObject({ statusCode: 503 });
    expect(db.systemSetting.update).not.toHaveBeenCalled();
  });
  it("code-owned production enforcement remains dormant", () => {
    expect(OPERATIONAL_ENFORCEMENT_ENABLED).toBe(false); expect(DIRECT_ACCESS_ENFORCEMENT_ENABLED).toBe(false);
    expect(new OperationalAuthorization().enabled).toBe(false);
  });
});
