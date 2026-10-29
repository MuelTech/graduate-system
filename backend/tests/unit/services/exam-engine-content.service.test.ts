import { beforeEach, describe, expect, it, vi } from "vitest";

const repo = vi.hoisted(() => ({ createQuestion: vi.fn(), updateQuestion: vi.fn() }));
vi.mock("../../../src/config/database", () => ({ default: {} }));
vi.mock("../../../src/repositories/exam-engine.repository", () => ({
  ExamEngineRepository: class {
    createQuestion = repo.createQuestion;
    updateQuestion = repo.updateQuestion;
  },
}));
import { ExamEngineService } from "../../../src/services/exam-engine.service";

beforeEach(() => vi.resetAllMocks());

describe("ExamEngineService question input boundary", () => {
  it("normalizes legacy input before persistence", async () => {
    await new ExamEngineService().createQuestion({
      questionText: "Pick one.", type: "MULTIPLE_CHOICE",
      options: [{ optionText: "One", isCorrect: true }, { optionText: "Two", isCorrect: false }],
    });
    expect(repo.createQuestion.mock.calls[0][0]).toMatchObject({ stimulusType: "NONE", stimulusMediaId: null, structuredStimulus: null, order: 0 });
  });

  it("rejects invalid raw input before persistence", async () => {
    await expect(new ExamEngineService().createQuestion({ questionText: "Pick one.", type: "MULTIPLE_CHOICE", options: [] })).rejects.toMatchObject({ statusCode: 400 });
    expect(repo.createQuestion).not.toHaveBeenCalled();
  });

  it("passes partial updates to the transactional effective-question validator", async () => {
    await new ExamEngineService().updateQuestion("q1", { order: 4 });
    expect(repo.updateQuestion).toHaveBeenCalledWith("q1", { order: 4 });
  });
});
