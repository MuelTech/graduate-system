import { beforeEach, describe, expect, it, vi } from "vitest";
import { evaluationApplication, evaluationRevision } from "../../fixtures/exam-essay-evaluation";
import { executionIds as ids } from "../../fixtures/exam-execution";
const db = vi.hoisted(() => ({ $transaction: vi.fn(), $queryRaw: vi.fn(), user: { findUnique: vi.fn() },
  entranceExamApplication: { findUnique: vi.fn(), update: vi.fn() }, entranceExamScore: { update: vi.fn() },
  applicantAnswer: { findUnique: vi.fn(), findMany: vi.fn() }, examContentRevision: { findUnique: vi.fn() },
  examResultDecision: { create: vi.fn() }, auditLog: { create: vi.fn() },
  systemSetting: { findUnique: vi.fn(), upsert: vi.fn() }, examQuestion: { findMany: vi.fn() },
}));
vi.mock("../../../src/config/database", () => ({ default: db }));
import { ExamAdministrationAuthorization } from "../../../src/access/exam-administration-authorization";
import { ExamRepository } from "../../../src/repositories/exam.repository";
import { ExamAmendmentRepository } from "../../../src/repositories/exam-amendment.repository";
import { ExamConfigurationService } from "../../../src/services/exam-configuration.service";
import { validatedResultBasis } from "../../../src/services/exam-result.rules";
let app: any, actor: any;
const access = new ExamAdministrationAuthorization(true, async () => actor);
const results = new ExamRepository(access), amendments = new ExamAmendmentRepository(access);
const configuration = new ExamConfigurationService(access);
function grant(key: string) { actor.capabilityGrants = [{ capabilityKey: key }]; }
beforeEach(() => {
  vi.resetAllMocks(); actor = { id: ids.admin, role: "ADMIN", isActive: true, mustChangePassword: false, panelist: null,
    administratorAccess: { level: "RESTRICTED" }, capabilityGrants: [{ capabilityKey: "exam.results.finalize" }] };
  app = evaluationApplication();
  Object.assign(app.score, { id: ids.student, essayScore: 10, gradedById: ids.user,
    gradedBy: { id: ids.user, firstName: "Synthetic", lastName: "Evaluator" }, essayEvaluatedAt: new Date("2026-11-01T02:05:00Z") });
  const essay = evaluationRevision().questions.find((q: any) => q.content.type === "ESSAY")!;
  const answer = { applicationId: ids.app, questionId: essay.questionId, essayAnswer: "Final response", selectedOptionId: null };
  db.$transaction.mockImplementation(fn => fn(db)); db.$queryRaw.mockResolvedValue([{ id: 1 }]);
  db.user.findUnique.mockImplementation(async () => actor);
  db.entranceExamApplication.findUnique.mockImplementation(async () => app);
  db.entranceExamApplication.update.mockImplementation(async ({ data }) => { Object.assign(app, data); return app; });
  db.entranceExamScore.update.mockImplementation(async ({ data }) => { Object.assign(app.score, data); return app.score; });
  db.applicantAnswer.findUnique.mockResolvedValue(answer); db.applicantAnswer.findMany.mockResolvedValue([answer]);
  db.examContentRevision.findUnique.mockResolvedValue(evaluationRevision());
  db.examResultDecision.create.mockImplementation(async ({ data }) => { app.resultDecision = { id: ids.revision, ...data }; return app.resultDecision; });
  db.systemSetting.upsert.mockImplementation(async ({ create }) => create);
});
describe("FACULTY-6 exact grants retain B8/B9 frozen-result authority", () => {
  it("finalizes deterministically from the frozen content/configuration and evaluated essay, without mutable settings or bank", async () => {
    const response = await results.finalizeResult(ids.app, ids.admin);
    expect(response).toMatchObject({ provenance: "B8", status: "failed", mcqScore: "0", essayScore: "10", totalScore: "10", totalPossible: "27.5", passingThreshold: "75" });
    expect(validatedResultBasis(app)).toMatchObject({ mcqCorrectCount: 0, mcqQuestionCount: 1, mcqPointsPerCorrectItem: "2", essayMaximum: "25.5", result: "FAILED" });
    expect(db.systemSetting.findUnique).not.toHaveBeenCalled(); expect(db.examQuestion.findMany).not.toHaveBeenCalled();
    const frozen = JSON.stringify(app.executionConfiguration), result = JSON.stringify(app.score);
    grant("exam.configuration.manage");
    await configuration.replaceCurrent({ examDurationMinutes: 30, mcqPointsPerCorrectItem: 100, essayMaximumScore: 100, passingThreshold: 1 }, ids.admin);
    expect(JSON.stringify(app.executionConfiguration)).toBe(frozen);
    grant("exam.results.finalize"); await results.finalizeResult(ids.app, ids.admin);
    expect(JSON.stringify(app.score)).toBe(result); expect(db.entranceExamScore.update).toHaveBeenCalledTimes(1);
  });
  it("reconsideration records a separate decision and preserves computed FAILED, score, basis and scoring time", async () => {
    await results.finalizeResult(ids.app, ids.admin); const computed = JSON.stringify(app.score);
    grant("exam.results.reconsider");
    expect(await amendments.reconsider(ids.app, { reason: "Institutional review" }, ids.admin)).toMatchObject({ computedStatus: "failed", effectiveStatus: "passed_reconsidered" });
    expect(app.status).toBe("FAILED"); expect(JSON.stringify(app.score)).toBe(computed);
    expect(app.resultDecision).toMatchObject({ decision: "PASSED_RECONSIDERED", reason: "Institutional review", decidedById: ids.admin, decidedAt: expect.any(Date), scoreId: ids.student });
    await expect(amendments.reconsider(ids.app, { reason: "Again" }, ids.admin)).rejects.toMatchObject({ statusCode: 409 });
    expect(db.examResultDecision.create).toHaveBeenCalledTimes(1); expect(db.auditLog.create).toHaveBeenCalledTimes(1);
  });
  it("a pending essay remains pending and cannot be finalized as FAILED", async () => {
    Object.assign(app.score, { essayScore: null, gradedById: null, gradedBy: null, essayEvaluatedAt: null });
    await expect(results.finalizeResult(ids.app, ids.admin)).rejects.toMatchObject({ statusCode: 409 });
    expect(app.status).toBe("TAKEN"); expect(app.score.status).toBe("PENDING"); expect(db.entranceExamScore.update).not.toHaveBeenCalled();
  });
});
