import { beforeEach, describe, expect, it, vi } from "vitest";

// Avoid importing the Redis-backed email service during this unit test.
vi.mock("../../../src/services/email.service", () => ({
  EmailService: { sendTemplateEmail: vi.fn(), sendBatch: vi.fn() },
}));

const repo = vi.hoisted(() => ({
  getApplicationDetail: vi.fn(),
}));

vi.mock("../../../src/repositories/exam.repository", () => ({
  ExamRepository: class {
    getApplicationDetail = repo.getApplicationDetail;
  },
}));

import { ExamService } from "../../../src/services/exam.service";

function applicationDetail(overrides: Record<string, unknown> = {}) {
  return {
    id: "app-1",
    status: "TAKEN",
    student: {
      id: "stu-1",
      pinnacleApplicantId: "PIN-1",
      user: { firstName: "Ana", lastName: "Dela", email: "ana@example.com" },
    },
    program: {
      id: "prog-1",
      programName: "MSIT",
      examMcqTotal: 20,
      examEssayTotal: 30,
    },
    slot: {
      id: "slot-1",
      examDate: new Date("2026-10-15T00:00:00.000Z"),
      examTime: new Date("1970-01-01T09:00:00.000Z"),
    },
    score: {
      multipleChoiceScore: 18,
      essayScore: null,
      totalScore: null,
      status: "PENDING",
      gradedBy: null,
    },
    answers: [
      {
        questionId: "q1",
        essayAnswer: "First response",
        question: { id: "q1", questionText: "Question 1", order: 1, type: "ESSAY" },
      },
      {
        questionId: "q2",
        essayAnswer: "Second response",
        question: { id: "q2", questionText: "Question 2", order: 2, type: "ESSAY" },
      },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ExamService.getApplicationDetail", () => {
  it("throws a 404 AppError when the record does not exist", async () => {
    repo.getApplicationDetail.mockResolvedValue(null);

    await expect(
      new ExamService().getApplicationDetail("missing"),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("maps authoritative fields and preserves deterministic essay answer order", async () => {
    repo.getApplicationDetail.mockResolvedValue(applicationDetail());

    const detail = await new ExamService().getApplicationDetail("app-1");

    expect(detail.student).toEqual({
      id: "stu-1",
      pinnacleApplicantId: "PIN-1",
      user: { firstName: "Ana", lastName: "Dela", email: "ana@example.com" },
    });
    expect(detail.program).toEqual({
      id: "prog-1",
      programName: "MSIT",
      examMcqTotal: 20,
      examEssayTotal: 30,
    });
    expect(detail.slot).toEqual({
      id: "slot-1",
      examDate: "2026-10-15T00:00:00.000Z",
      examTime: "1970-01-01T09:00:00.000Z",
    });
    expect(detail.score?.multipleChoiceScore).toBe(18);
    expect(detail.score?.essayScore).toBeNull();
    expect(detail.essayAnswers).toEqual([
      {
        questionId: "q1",
        questionText: "Question 1",
        order: 1,
        essayAnswer: "First response",
      },
      {
        questionId: "q2",
        questionText: "Question 2",
        order: 2,
        essayAnswer: "Second response",
      },
    ]);
  });

  it("exposes grader identity only from the safe related user", async () => {
    repo.getApplicationDetail.mockResolvedValue(
      applicationDetail({
        score: {
          multipleChoiceScore: 18,
          essayScore: 25,
          totalScore: 43,
          status: "PASSED",
          gradedBy: { id: "admin-1", firstName: "Maria", lastName: "Santos" },
        },
      }),
    );

    const detail = await new ExamService().getApplicationDetail("app-1");

    expect(detail.score?.gradedBy).toEqual({
      id: "admin-1",
      firstName: "Maria",
      lastName: "Santos",
    });
  });

  it("does not leak correct-answer or option data", async () => {
    repo.getApplicationDetail.mockResolvedValue(applicationDetail());

    const detail = await new ExamService().getApplicationDetail("app-1");
    const serialized = JSON.stringify(detail);

    expect(serialized).not.toContain("isCorrect");
    expect(serialized).not.toContain("selectedOption");
    expect(serialized).not.toContain("options");
  });
});
