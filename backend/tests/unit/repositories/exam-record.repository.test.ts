import { beforeEach, describe, expect, it, vi } from "vitest";
import { evaluationApplication } from "../../fixtures/exam-essay-evaluation";

const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(),
  entranceExamApplication: { findUnique: vi.fn(), findMany: vi.fn() },
}));

vi.mock("../../../src/config/database", () => ({ default: prismaMock }));

import { ExamRepository } from "../../../src/repositories/exam.repository";

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.$transaction.mockImplementation(fn => fn(prismaMock));
  prismaMock.entranceExamApplication.findUnique.mockResolvedValue(null);
});

describe("ExamRepository.getApplicationDetail bounded read model", () => {
  it("list completion is presentation only and requires complete evidence, never a legacy essay score alone", async () => {
    const pending = evaluationApplication(), completed = evaluationApplication(), partial = evaluationApplication();
    Object.assign(completed.score, { essayScore: 0, gradedById: "admin", essayEvaluatedAt: new Date() });
    Object.assign(partial.score, completed.score); partial.finalizationReceiptId = null;
    prismaMock.entranceExamApplication.findMany.mockResolvedValue([pending, completed, partial]);
    const rows = await new ExamRepository().getAllApplications();
    expect(rows.map(row => row.essayEvaluationCompleted)).toEqual([false, true, false]);
    expect(rows.every(row => !("score" in row))).toBe(true);
  });
  it("looks up a single application by id", async () => {
    const repo = new ExamRepository();

    await repo.getApplicationDetail("app-9");

    expect(prismaMock.entranceExamApplication.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "app-9" } }),
    );
  });

  it("returns only essay answers, deterministically ordered by question order then id", async () => {
    const repo = new ExamRepository();

    await repo.getApplicationDetail("app-9");

    const select =
      prismaMock.entranceExamApplication.findUnique.mock.calls[0][0].select;
    expect(select.answers.where).toEqual({ question: { type: "ESSAY" } });
    expect(select.answers.orderBy).toEqual([
      { question: { order: "asc" } },
      { questionId: "asc" },
    ]);
  });

  it("exposes safe grader identity fields", async () => {
    const repo = new ExamRepository();

    await repo.getApplicationDetail("app-9");

    const select =
      prismaMock.entranceExamApplication.findUnique.mock.calls[0][0].select;
    expect(select.score.select.gradedBy.select).toEqual({
      id: true,
      firstName: true,
      lastName: true,
    });
  });

  it("exposes configured program maximums and the schedule slot", async () => {
    const repo = new ExamRepository();

    await repo.getApplicationDetail("app-9");

    const select =
      prismaMock.entranceExamApplication.findUnique.mock.calls[0][0].select;
    expect(select.program.select).toEqual({
      id: true,
      programName: true,
      examMcqTotal: true,
      examEssayTotal: true,
    });
    expect(select.slot.select).toEqual({
      id: true,
      examDate: true,
      examTime: true,
    });
    expect(select.student.select.id).toBe(true);
    expect(select.student.select.pinnacleApplicantId).toBe(true);
  });

  it("never exposes correct answers or option data", async () => {
    const repo = new ExamRepository();

    await repo.getApplicationDetail("app-9");

    const select =
      prismaMock.entranceExamApplication.findUnique.mock.calls[0][0].select;
    const serialized = JSON.stringify(select);
    expect(serialized).not.toContain("isCorrect");
    expect(serialized).not.toContain("options");
    expect(serialized).not.toContain("selectedOption");
  });
});
