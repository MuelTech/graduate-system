import { beforeEach, describe, expect, it, vi } from "vitest";
import { calculatePoints } from "../../../src/services/exam-result.rules";
import { validatedInstitutionalDecision } from "../../../src/services/exam-effective-result.rules";
import { executionIds as ids } from "../../fixtures/exam-execution";
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

  it("exposes program identity and schedule without mutable score maximums", async () => {
    const repo = new ExamRepository();

    await repo.getApplicationDetail("app-9");

    const select =
      prismaMock.entranceExamApplication.findUnique.mock.calls[0][0].select;
    expect(select.program.select).toEqual({
      id: true,
      programName: true,
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


/** Apply the query's actual scalar/relation selects so missing predicate evidence fails tests. */
function selectedRow(source: Record<string, any>, select: Record<string, any>): Record<string, any> {
  return Object.fromEntries(Object.entries(select).map(([key, selection]) => [key,
    selection === true || source[key] == null ? source[key] : selectedRow(source[key], selection.select),
  ]));
}
function listApplication(): any {
  const app = evaluationApplication();
  app.student = { pinnacleApplicantId: "PINNACLE-1", user: { firstName: "Ana", lastName: "Cruz", email: "ana@example.test" } };
  app.program = { id: ids.program, programName: "MSIT" };
  app.slot = { examDate: new Date("2026-11-03T00:00:00Z"), examTime: new Date("1970-01-01T09:00:00Z") };
  return app;
}
function completedEssay(): any {
  const app = listApplication();
  Object.assign(app.score, { essayScore: 0, gradedById: ids.admin, essayEvaluatedAt: new Date("2026-11-01T02:05:00Z") });
  return app;
}
function reconsideredApplication(): any {
  const app = completedEssay(); app.status = "FAILED";
  Object.assign(app.score, { id: ids.student, status: "FAILED", essayScore: 10, totalScore: 10,
    scoredAt: new Date("2026-11-01T02:10:00Z"), scoringBasis: {
      version: 1, applicationId: app.id, contentRevisionId: app.contentRevisionId,
      finalizationReceiptId: app.finalizationReceiptId, mcqQuestionCount: 1, mcqCorrectCount: 0,
      mcqPointsPerCorrectItem: "2", essayScore: "10", essayMaximum: "25.5", passingThreshold: "75", passingThresholdUnit: "PERCENT",
      ...calculatePoints(0, 1, "2", "10", "25.5", "75"),
    },
  });
  app.resultDecision = { applicationId: app.id, scoreId: app.score.id, decision: "PASSED_RECONSIDERED",
    reason: "Institutional review", decidedById: ids.admin, decidedAt: new Date("2026-11-01T02:15:00Z") };
  return app;
}
function returnSelected(app: any) {
  prismaMock.entranceExamApplication.findMany.mockImplementation(async ({ select }) => [selectedRow(app, select)]);
}

describe("ExamRepository.getAllApplications bounded list projection", () => {
  it("selects only list display fields and the explicit internal evidence required by the existing flags", async () => {
    prismaMock.entranceExamApplication.findMany.mockResolvedValue([]);
    await new ExamRepository().getAllApplications();
    const query = prismaMock.entranceExamApplication.findMany.mock.calls[0][0];
    expect(query).not.toHaveProperty("include"); expect(query.orderBy).toEqual({ createdAt: "desc" });
    expect(Object.keys(query.select).sort()).toEqual([
      "id", "status", "student", "program", "slot", "score", "resultDecision",
      "actualStartedAt", "deadlineAt", "contentRevisionId", "executionConfiguration", "finalizedAt",
      "finalizationReason", "finalizationReceiptId", "finalizationAnsweredCount", "finalizationQuestionCount",
    ].sort());
    expect(query.select.student).toEqual({ select: { pinnacleApplicantId: true,
      user: { select: { firstName: true, lastName: true, email: true } },
    } });
    expect(query.select.program).toEqual({ select: { id: true, programName: true } });
    expect(query.select.slot).toEqual({ select: { examDate: true, examTime: true } });
    expect(query.select.score).toEqual({ select: { id: true, status: true, multipleChoiceScore: true, essayScore: true,
      totalScore: true, gradedById: true, essayEvaluatedAt: true, scoredAt: true, scoringBasis: true } });
    expect(query.select.resultDecision).toEqual({ select: { applicationId: true, scoreId: true, decision: true,
      reason: true, decidedById: true, decidedAt: true } });
  });
  it("returns exactly the current list UI contract even if persistence supplies overfilled application and relation objects", async () => {
    const app = completedEssay();
    const forbidden = { passwordHash: "SECRET_HASH", mustChangePassword: true, customRoleId: "INTERNAL_ROLE",
      createdById: "INTERNAL_CREATOR", updatedById: "INTERNAL_UPDATER" };
    Object.assign(app, forbidden, { privateApplicationField: "INTERNAL_APPLICATION" });
    Object.assign(app.student, forbidden, { cellphone: "PRIVATE_PHONE", admissionStatus: "APPLICANT" });
    Object.assign(app.student.user, forbidden, { role: "APPLICANT", isActive: true });
    Object.assign(app.program, { examMcqTotal: 99 }); Object.assign(app.slot, { maxSlots: 20, slotsTaken: 10 });
    prismaMock.entranceExamApplication.findMany.mockResolvedValue([app]);
    const [row] = await new ExamRepository().getAllApplications();
    expect(row).toEqual({ id: app.id, status: "TAKEN",
      student: { pinnacleApplicantId: "PINNACLE-1", user: { firstName: "Ana", lastName: "Cruz", email: "ana@example.test" } },
      program: { id: ids.program, programName: "MSIT" },
      slot: { examDate: app.slot.examDate, examTime: app.slot.examTime },
      reconsidered: false, essayEvaluationCompleted: true,
    });
    const serialized = JSON.stringify(row);
    for (const key of [...Object.keys(forbidden), "score", "resultDecision", "actualStartedAt", "deadlineAt", "contentRevisionId",
      "executionConfiguration", "finalizedAt", "finalizationReceiptId", "finalizationReason", "finalizationAnsweredCount",
      "finalizationQuestionCount", "essayEvaluatedAt", "gradedById", "scoringBasis", "cellphone", "privateApplicationField"]) {
      expect(serialized).not.toContain(`"${key}"`);
    }
    expect(serialized).not.toMatch(/SECRET_HASH|INTERNAL_|PRIVATE_PHONE/);
  });
  it("preserves a validated B9 reconsidered flag using only the selected B8/decision evidence", async () => {
    const app = reconsideredApplication(); expect(validatedInstitutionalDecision(app)).toBe(app.resultDecision);
    returnSelected(app);
    const [row] = await new ExamRepository().getAllApplications();
    expect(row).toMatchObject({ id: app.id, status: "FAILED", reconsidered: true, essayEvaluationCompleted: false });
    expect(row).not.toHaveProperty("score"); expect(row).not.toHaveProperty("resultDecision");
    expect(row).not.toHaveProperty("executionConfiguration");
  });
  it.each(["missing decision", "wrong score", "missing basis", "decision before scoring", "ordinary pass"])("retains reconsidered denial for %s", async scenario => {
    const app = reconsideredApplication();
    if (scenario === "missing decision") app.resultDecision = null;
    if (scenario === "wrong score") app.resultDecision.scoreId = "other-score";
    if (scenario === "missing basis") app.score.scoringBasis = null;
    if (scenario === "decision before scoring") app.resultDecision.decidedAt = new Date("2026-11-01T02:00:00Z");
    if (scenario === "ordinary pass") { app.status = "PASSED"; app.resultDecision = null; }
    returnSelected(app);
    expect((await new ExamRepository().getAllApplications())[0].reconsidered).toBe(false);
  });
  it("keeps a completed zero-point essay distinct from pending evaluation", async () => {
    returnSelected(completedEssay()); expect((await new ExamRepository().getAllApplications())[0].essayEvaluationCompleted).toBe(true);
  });
  it.each(["finalizedAt", "finalizationReceiptId", "finalizationReason", "finalizationAnsweredCount", "finalizationQuestionCount",
    "actualStartedAt", "deadlineAt", "contentRevisionId", "executionConfiguration"])("requires %s for the presentation completion flag", async field => {
    const app = completedEssay(); app[field] = null; returnSelected(app);
    expect((await new ExamRepository().getAllApplications())[0].essayEvaluationCompleted).toBe(false);
  });
  it.each(["essayScore", "gradedById", "essayEvaluatedAt"])("requires score.%s for the presentation completion flag", async field => {
    const app = completedEssay(); app.score[field] = null; returnSelected(app);
    expect((await new ExamRepository().getAllApplications())[0].essayEvaluationCompleted).toBe(false);
  });
  it.each(["no score", "not Taken", "score not pending", "already totaled"])("retains completion denial for %s", async scenario => {
    const app = completedEssay();
    if (scenario === "no score") app.score = null;
    if (scenario === "not Taken") app.status = "PENDING";
    if (scenario === "score not pending") app.score.status = "PASSED";
    if (scenario === "already totaled") app.score.totalScore = 0;
    returnSelected(app);
    expect((await new ExamRepository().getAllApplications())[0].essayEvaluationCompleted).toBe(false);
  });
});
