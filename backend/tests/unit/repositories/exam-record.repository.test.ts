import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  entranceExamApplication: { findUnique: vi.fn() },
}));

vi.mock("../../../src/config/database", () => ({ default: prismaMock }));

import { ExamRepository } from "../../../src/repositories/exam.repository";

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.entranceExamApplication.findUnique.mockResolvedValue(null);
});

describe("ExamRepository.getApplicationDetail bounded read model", () => {
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
