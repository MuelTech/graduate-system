import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ entranceExamApplication: { findUnique: vi.fn() } }));
const repo = vi.hoisted(() => ({ submitAnswers: vi.fn(), autoSaveAnswer: vi.fn() }));
vi.mock("../../../src/config/database", () => ({ default: db }));
vi.mock("../../../src/repositories/exam-engine.repository", () => ({ ExamEngineRepository: class {
  submitAnswers = repo.submitAnswers;
  autoSaveAnswer = repo.autoSaveAnswer;
} }));
import { ExamEngineService } from "../../../src/services/exam-engine.service";

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 10, 2, 10));
  db.entranceExamApplication.findUnique.mockResolvedValue({ slot: { examDate: new Date(2026, 10, 2), examTime: new Date(1970, 0, 1, 9) } });
});
afterEach(() => vi.useRealTimers());

describe("B0A retains schedule gates and delegates write authority", () => {
  it("routes valid-window writes to the guarded repository", async () => {
    const service = new ExamEngineService();
    await service.submitAnswers("owned-app", []);
    await service.autoSaveAnswer("owned-app", "essay-id", "Draft");
    expect(repo.submitAnswers).toHaveBeenCalledWith("owned-app", []);
    expect(repo.autoSaveAnswer).toHaveBeenCalledWith("owned-app", "essay-id", "Draft");
  });

  it.each([8, 13])("keeps existing before/after window rejection at hour %i", async hour => {
    vi.setSystemTime(new Date(2026, 10, 2, hour));
    const service = new ExamEngineService();
    await expect(service.submitAnswers("app", [])).rejects.toMatchObject({ statusCode: 400 });
    await expect(service.autoSaveAnswer("app", "essay-id", "Draft")).rejects.toMatchObject({ statusCode: 400 });
    expect(repo.submitAnswers).not.toHaveBeenCalled();
    expect(repo.autoSaveAnswer).not.toHaveBeenCalled();
  });
});
