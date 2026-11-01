import { beforeEach, describe, expect, it, vi } from "vitest";
import { EXAM_CONFIGURATION_KEY } from "../../../src/services/exam-configuration.rules";

const db = vi.hoisted(() => ({
  systemSetting: { findUnique: vi.fn(), findMany: vi.fn(), upsert: vi.fn(), update: vi.fn() },
  program: { update: vi.fn() }, entranceExamApplication: { update: vi.fn() }, entranceExamScore: { update: vi.fn() },
}));
vi.mock("../../../src/config/database", () => ({ default: db }));
import { ExamConfigurationService } from "../../../src/services/exam-configuration.service";
import { SettingsRepository } from "../../../src/repositories/settings.repository";

const settings = new Map<string, { settingKey: string; settingType: string; settingValue: string | null; lastModifiedById?: string }>();
const service = new ExamConfigurationService();
beforeEach(() => {
  vi.resetAllMocks(); settings.clear();
  db.systemSetting.findUnique.mockImplementation(async ({ where }) => settings.get(where.settingKey) ?? null);
  db.systemSetting.upsert.mockImplementation(async ({ where, create, update }) => {
    const row = settings.has(where.settingKey) ? { ...settings.get(where.settingKey)!, ...update } : create;
    settings.set(where.settingKey, row); return row;
  });
});

describe("B1 persisted current document with bounded projection", () => {
  it("reads absence without creating an authoritative/default record", async () => {
    expect(await service.getCurrent()).toMatchObject({ examDurationMinutes: null, essayMaximumScore: null, mcqPointsPerCorrectItem: null, isComplete: false });
    expect(db.systemSetting.upsert).not.toHaveBeenCalled();
    expect(db.systemSetting.findUnique).toHaveBeenCalledWith({ where: { settingKey: EXAM_CONFIGURATION_KEY }, select: { settingType: true, settingValue: true } });
  });

  it("round-trips exact values and actor, keeping full replacement omissions unconfigured", async () => {
    const result = await service.replaceCurrent({ examDurationMinutes: 95, mcqPointsPerCorrectItem: 2.5, essayMaximumScore: 42 }, "admin-1");
    expect(await service.getCurrent()).toEqual(result);
    expect(result).toMatchObject({ examDurationMinutes: 95, mcqPointsPerCorrectItem: 2.5, essayMaximumScore: 42 });
    expect(settings.get(EXAM_CONFIGURATION_KEY)).toMatchObject({ settingType: "JSON", lastModifiedById: "admin-1", isEditableByAdmin: false });
    await service.replaceCurrent({ essayMaximumScore: null }, "admin-2");
    expect(await service.getCurrent()).toMatchObject({ examDurationMinutes: null, mcqPointsPerCorrectItem: null, essayMaximumScore: null });
    expect(settings.get(EXAM_CONFIGURATION_KEY)?.lastModifiedById).toBe("admin-2");
    expect(result).not.toHaveProperty("settingKey");
  });

  it("does not update unrelated settings, legacy Programs, or historical finalized records", async () => {
    const history = {
      program: { examMcqTotal: 72, examEssayTotal: 30, examPassingScore: 76 },
      application: { id: "finalized-app", status: "PASSED" },
      score: { applicationId: "finalized-app", status: "PASSED", multipleChoiceScore: 63, essayScore: 20, totalScore: 83 },
    };
    const before = structuredClone(history);
    db.program.update.mockImplementation(async ({ data }) => Object.assign(history.program, data));
    db.entranceExamApplication.update.mockImplementation(async ({ data }) => Object.assign(history.application, data));
    db.entranceExamScore.update.mockImplementation(async ({ data }) => Object.assign(history.score, data));
    const unrelated = { settingKey: "unrelated", settingType: "STRING", settingValue: "preserve" };
    settings.set("unrelated", unrelated);
    await service.replaceCurrent({ mcqPointsPerCorrectItem: 4 }, "admin-1");
    expect(settings.get("unrelated")).toEqual(unrelated);
    expect(db.systemSetting.upsert.mock.calls[0][0].where).toEqual({ settingKey: EXAM_CONFIGURATION_KEY });
    expect(db.program.update).not.toHaveBeenCalled();
    expect(db.entranceExamApplication.update).not.toHaveBeenCalled();
    expect(db.entranceExamScore.update).not.toHaveBeenCalled();
    expect(history).toEqual(before);
    // No raw SQL/transaction/other model exists on this gateway; any such write fails this actual service/repository execution.
  });

  it.each([{ settingType: "STRING", settingValue: "95" }, { settingType: "JSON", settingValue: null }, { settingType: "JSON", settingValue: "broken-json" }, { settingType: "JSON", settingValue: '{"passingThreshold":75}' }])("fails closed on corrupt persistence %#", async row => {
    db.systemSetting.findUnique.mockResolvedValue(row);
    await expect(service.getCurrent()).rejects.toMatchObject({ statusCode: 500, message: "Exam configuration could not be read. Contact the system administrator." });
  });

  it("rejects invalid writes without replacing the persisted document", async () => {
    await expect(service.replaceCurrent({ passingThreshold: 75 }, "admin-1")).rejects.toMatchObject({ statusCode: 400 });
    expect(db.systemSetting.upsert).not.toHaveBeenCalled();
  });
});

describe("B1 cannot be bypassed through generic System Settings", () => {
  it("excludes the reserved document from generic settings UI data", async () => {
    await new SettingsRepository().getAllSettings();
    expect(db.systemSetting.findMany).toHaveBeenCalledWith({ where: { settingKey: { not: EXAM_CONFIGURATION_KEY } }, orderBy: { settingKey: "asc" } });
  });

  it.each([EXAM_CONFIGURATION_KEY, EXAM_CONFIGURATION_KEY.toUpperCase(), "entrance_éxam_configuration"])("rejects generic updates, including DB collation aliases %s", async key => {
    db.systemSetting.findUnique.mockResolvedValue({ settingKey: EXAM_CONFIGURATION_KEY });
    await expect(new SettingsRepository().updateSetting(key, "unvalidated", "admin-1")).rejects.toMatchObject({ statusCode: 409 });
    expect(db.systemSetting.update).not.toHaveBeenCalled();
  });

  it("retains unrelated generic setting updates with a DB-side reserved-key exclusion", async () => {
    await new SettingsRepository().updateSetting("unrelated", "next", "admin-1");
    expect(db.systemSetting.update).toHaveBeenCalledWith({ where: { settingKey: "unrelated", NOT: { settingKey: EXAM_CONFIGURATION_KEY } }, data: { settingValue: "next", lastModifiedById: "admin-1" } });
  });
});
