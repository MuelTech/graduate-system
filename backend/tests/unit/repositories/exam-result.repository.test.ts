import { evaluationAuthoritySelect } from "../../../src/repositories/exam-essay-evaluation.projection";
import { evaluationApplication } from "../../fixtures/exam-essay-evaluation";
import { executionIds as ids } from "../../fixtures/exam-execution";
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  entranceExamApplication: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  user: { findUnique: vi.fn() }, $queryRaw: vi.fn(), entranceExamScore: { update: vi.fn() }, examQuestion: { count: vi.fn() }, $transaction: vi.fn(),
}));
vi.mock("../../../src/config/database", () => ({ default: db }));
import { ExamRepository } from "../../../src/repositories/exam.repository";
const repo = new ExamRepository();
beforeEach(() => {
  vi.resetAllMocks();
  db.$transaction.mockImplementation(callback => callback(db));
});

describe("B0B bounded result queries and B7 superseded legacy grading", () => {
  it("selects the authenticated user's latest scored application, retaining PENDING for service checks", async () => {
    db.entranceExamApplication.findFirst.mockResolvedValue({ id: "owned-app", status: "TAKEN", score: { status: "PENDING" } });
    db.examQuestion.count.mockResolvedValue(72);
    const result = await repo.getLatestResult("jwt-user");
    expect(db.entranceExamApplication.findFirst).toHaveBeenCalledWith({ where: { student: { userId: "jwt-user" }, score: { isNot: null } }, include: { score: true, slot: true, resultDecision: true }, orderBy: { createdAt: "desc" } });
    expect(result?.score.status).toBe("PENDING");
    // B8 never consults or invents a mutable denominator.
    expect(result).not.toHaveProperty("program");
    expect(db.examQuestion.count).not.toHaveBeenCalled();
  });

  it("returns no record without computing denominator data", async () => {
    db.entranceExamApplication.findFirst.mockResolvedValue(null);
    expect(await repo.getLatestResult("no-result-user")).toBeNull();
    expect(db.examQuestion.count).not.toHaveBeenCalled();
  });

  it("loads only the exact application's result agreement and authoritative recipient", async () => {
    await repo.getApplicationDetailsForEmail("exact-app");
    expect(db.entranceExamApplication.findUnique).toHaveBeenCalledWith({ where: { id: "exact-app" }, select: {
      id: true, status: true, ...evaluationAuthoritySelect, score: true, student: { select: { user: { select: { email: true, firstName: true } } } },
    } });
    expect(JSON.stringify(db.entranceExamApplication.findUnique.mock.calls)).not.toMatch(/passwordHash|answers|isCorrect|storageKey/);
  });

  it.each([[63, 20], [10, 5]])("B7 rejects legacy MCQ %i / essay %i instead of immediately computing PASS/FAIL", async (mcq, essay) => {
    const application = evaluationApplication();
    Object.assign(application, { finalizedAt: null, finalizationReason: null, finalizationReceiptId: null, finalizationAnsweredCount: null, finalizationQuestionCount: null });
    application.score.multipleChoiceScore = mcq;
    db.$queryRaw.mockResolvedValue([{ status: "TAKEN" }]);
    db.user.findUnique.mockResolvedValue({ role: "ADMIN", isActive: true });
    db.entranceExamApplication.findUnique.mockResolvedValue(application);
    await expect(repo.gradeEssay(ids.app, essay, ids.admin)).rejects.toMatchObject({ statusCode: 409 });
    expect(db.entranceExamScore.update).not.toHaveBeenCalled();
    expect(db.entranceExamApplication.update).not.toHaveBeenCalled();
    expect(db.examQuestion.count).not.toHaveBeenCalled();
  });
});
