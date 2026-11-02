import { beforeEach, describe, expect, it, vi } from "vitest";
const execution = vi.hoisted(() => ({ read: vi.fn() }));
const repo = vi.hoisted(() => ({ submitAnswers: vi.fn(), autoSaveAnswer: vi.fn() }));
vi.mock("../../../src/config/database", () => ({ default: {} }));
vi.mock("../../../src/repositories/exam-execution.repository", () => ({ ExamExecutionRepository: class { read = execution.read; } }));
vi.mock("../../../src/repositories/exam-engine.repository", () => ({ ExamEngineRepository: class { submitAnswers = repo.submitAnswers; autoSaveAnswer = repo.autoSaveAnswer; } }));
import { ExamEngineService } from "../../../src/services/exam-engine.service";
beforeEach(() => { vi.resetAllMocks(); execution.read.mockResolvedValue({ state: "ACTIVE" }); });
describe("B0A writes now delegate through exact B4 execution", () => {
  it("checks exact JWT ownership/execution then uses the locked answer repository", async () => {
    const service = new ExamEngineService();
    await service.submitAnswers("owned-app", [], "jwt-user"); await service.autoSaveAnswer("owned-app", "essay-id", "Draft", "jwt-user", 0);
    expect(execution.read).toHaveBeenCalledWith("jwt-user", "owned-app");
    expect(repo.submitAnswers).toHaveBeenCalledWith("owned-app", []); expect(repo.autoSaveAnswer).toHaveBeenCalledWith("owned-app", "essay-id", "Draft", 0, "jwt-user");
  });
  it.each(["READY", "BLOCKED", "EXPIRED", "TERMINAL", "LEGACY_UNBOUND"])("rejects %s before persistence", async state => {
    execution.read.mockResolvedValue({ state }); const service = new ExamEngineService();
    await expect(service.submitAnswers("app", [], "u")).rejects.toMatchObject({ statusCode: 409 }); await expect(service.autoSaveAnswer("app", "essay", "x", "u", 0)).rejects.toThrow();
    expect(repo.submitAnswers).not.toHaveBeenCalled(); expect(repo.autoSaveAnswer).not.toHaveBeenCalled();
  });
});
