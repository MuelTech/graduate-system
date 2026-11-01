import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  entranceExamApplication: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  entranceExamScore: { update: vi.fn() }, examQuestion: { count: vi.fn() }, $transaction: vi.fn(),
}));
vi.mock("../../../src/config/database", () => ({ default: db }));
import { ExamRepository } from "../../../src/repositories/exam.repository";
const repo = new ExamRepository();
beforeEach(() => {
  vi.resetAllMocks();
  db.$transaction.mockImplementation(callback => callback(db));
});

describe("B0B bounded result queries and retained grading", () => {
  it("selects the authenticated user's latest scored application, retaining PENDING for service checks", async () => {
    db.entranceExamApplication.findFirst.mockResolvedValue({ id: "owned-app", status: "TAKEN", score: { status: "PENDING" }, program: { examMcqTotal: 10, examEssayTotal: 40, examPassingScore: 9 } });
    db.examQuestion.count.mockResolvedValue(72);
    const result = await repo.getLatestResult("jwt-user");
    expect(db.entranceExamApplication.findFirst).toHaveBeenCalledWith({ where: { student: { userId: "jwt-user" }, score: { isNot: null } }, include: { score: true, slot: true, program: true }, orderBy: { createdAt: "desc" } });
    expect(result?.score.status).toBe("PENDING");
    // Explicitly preserve the existing live denominator/30/75% behavior for B8.
    expect(result?.program).toMatchObject({ examMcqTotal: 72, examEssayTotal: 30, examPassingScore: 76 });
  });

  it("returns no record without computing denominator data", async () => {
    db.entranceExamApplication.findFirst.mockResolvedValue(null);
    expect(await repo.getLatestResult("no-result-user")).toBeNull();
    expect(db.examQuestion.count).not.toHaveBeenCalled();
  });

  it("loads only the exact application's result agreement and authoritative recipient", async () => {
    await repo.getApplicationDetailsForEmail("exact-app");
    expect(db.entranceExamApplication.findUnique).toHaveBeenCalledWith({ where: { id: "exact-app" }, select: {
      id: true, status: true, score: { select: { status: true } }, student: { select: { user: { select: { email: true, firstName: true } } } },
    } });
    expect(JSON.stringify(db.entranceExamApplication.findUnique.mock.calls)).not.toMatch(/passwordHash|answers|isCorrect|storageKey/);
  });

  it.each([[63, 20, "PASSED"], [10, 5, "FAILED"]])("retains current grade writes for MCQ %i + essay %i", async (mcq, essay, status) => {
    db.entranceExamApplication.findUnique.mockResolvedValue({ status: "TAKEN", score: { status: "PENDING", multipleChoiceScore: mcq }, program: { examEssayTotal: 30 } });
    db.examQuestion.count.mockResolvedValue(72);
    await repo.gradeEssay("exact-app", essay, "admin-user");
    expect(db.entranceExamScore.update).toHaveBeenCalledWith({ where: { applicationId: "exact-app" }, data: { essayScore: essay, totalScore: mcq + essay, status, gradedById: "admin-user" } });
    expect(db.entranceExamApplication.update).toHaveBeenCalledWith({ where: { id: "exact-app" }, data: { status } });
  });
});
