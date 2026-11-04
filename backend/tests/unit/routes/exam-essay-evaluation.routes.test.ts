import express from "express";
import { createServer, type Server } from "node:http";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import jwt from "jsonwebtoken";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { evaluationApplication, evaluationRevision } from "../../fixtures/exam-essay-evaluation";
import { setEssay, essayId } from "../../fixtures/exam-question-set";
import { executionIds as ids } from "../../fixtures/exam-execution";
const db = vi.hoisted(() => ({ $transaction: vi.fn(), $queryRaw: vi.fn(),
  entranceExamApplication: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  entranceExamScore: { update: vi.fn() }, user: { findUnique: vi.fn() },
  examContentRevision: { findUnique: vi.fn() }, applicantAnswer: { findUnique: vi.fn() }, examQuestion: { count: vi.fn() },
}));
const email = vi.hoisted(() => vi.fn());
vi.mock("../../../src/config/database", () => ({ default: db }));
vi.mock("../../../src/services/email.service", () => ({ EmailService: { sendTemplateEmail: email } }));
import router from "../../../src/routes/exam.routes";
import { ExamRepository } from "../../../src/repositories/exam.repository";
import { essayScoreValue } from "../../../src/services/exam-essay-evaluation.rules";
let server: Server, base: string, app: any, revision: any, answer: any;
const secret = "b7-synthetic-http-secret";
beforeAll(async () => {
  const http = express(); http.use(express.json()); http.use(router); server = createServer(http);
  server.listen(0, "127.0.0.1"); await once(server, "listening"); base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => { server.closeAllConnections(); server.close(); vi.unstubAllEnvs(); });
beforeEach(() => {
  vi.resetAllMocks(); vi.stubEnv("JWT_SECRET", secret); app = evaluationApplication(); revision = evaluationRevision();
  app.student.user = { firstName: "Applicant", lastName: "Fixture", email: "fixture@example.invalid" };
  app.program = { id: ids.program, programName: "Synthetic", examMcqTotal: 99, examEssayTotal: 1000 };
  answer = { essayAnswer: "Exact finalized\nresponse  ", selectedOptionId: null };
  db.$transaction.mockImplementation(fn => fn(db)); db.$queryRaw.mockResolvedValue([{ status: "TAKEN" }]);
  db.entranceExamApplication.findUnique.mockImplementation(() => app);
  db.entranceExamApplication.findFirst.mockImplementation(() => app);
  db.examContentRevision.findUnique.mockImplementation(() => revision);
  db.applicantAnswer.findUnique.mockImplementation(() => answer);
  db.user.findUnique.mockResolvedValue({ role: "ADMIN", isActive: true });
  db.entranceExamScore.update.mockImplementation(({ data }) => Object.assign(app.score, data, { gradedBy: { id: data.gradedById, firstName: "Admin", lastName: "Fixture" } }));
});
function request(body: unknown = { essayScore: 18 }, role: string | null = "ADMIN", id = ids.app, method = "POST", suffix = "grade") {
  const token = role === "invalid" ? "invalid" : role ? jwt.sign({ userId: ids.admin, role }, secret) : null;
  return fetch(`${base}${method === "GET" ? `/applications/${id}` : `/scores/${id}/${suffix}`}`, {
    method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(method === "GET" ? {} : { body: JSON.stringify(body) }),
  });
}
const noWrites = () => expect(db.entranceExamScore.update).not.toHaveBeenCalled();
describe("B7 actual HTTP/transaction authority", () => {
  it.each([[null, 401], ["invalid", 403], ["APPLICANT", 403], ["STUDENT", 403], ["PANELIST", 403]])("denies %s before DB access", async (role, status) => {
    expect((await request(undefined, role as string | null)).status).toBe(status); expect(db.$transaction).not.toHaveBeenCalled();
  });
  it.each([null, "", "0", [], {}, { essayScore: null }, { essayScore: "18" }, { essayScore: "" }, { essayScore: -1 }, { essayScore: 18, totalScore: 20 }, { essayScore: 26 }, { essayScore: 1e-31 }])("rejects malformed/unsupported/out-of-bound input %#", async body => {
    expect((await request(body)).status).toBe(400); noWrites();
  });
  it.each([NaN, Infinity, -Infinity, undefined, null, "0", -0.1])("repository numeric boundary rejects %s", value => expect(() => essayScoreValue(value)).toThrow());
  it.each([0, 18.25, 25.5])("evaluates %s once, writes only essay/evaluator/time, keeps final result pending", async value => {
    const response = await request({ essayScore: value }); expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("private, no-store");
    const result = await response.json(); expect(result).toMatchObject({ status: "COMPLETED", essayScore: value, maximumScore: 25.5, evaluator: { id: ids.admin }, responseText: answer.essayAnswer });
    expect(result.evaluatedAt).toBeTruthy(); expect(app.status).toBe("TAKEN"); expect(app.score.status).toBe("PENDING"); expect(app.score.totalScore).toBeNull();
    expect(Object.keys(db.entranceExamScore.update.mock.calls[0][0].data).sort()).toEqual(["essayEvaluatedAt", "essayScore", "gradedById"]);
    expect(db.$transaction.mock.calls[0][1]).toEqual({ isolationLevel: "ReadCommitted" });
    expect(String(db.$queryRaw.mock.calls[0][0])).toContain("FOR UPDATE"); expect(db.entranceExamApplication.update).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toMatch(/isCorrect|answerKey|correctOption|executionConfiguration|storageKey/);
    expect((await request({ essayScore: value })).status).toBe(409); expect((await request({ essayScore: value + 1 })).status).toBe(409);
    expect(db.entranceExamScore.update).toHaveBeenCalledTimes(1);
  });
  it.each(["PENDING", "APPROVED", "PASSED", "FAILED", "APPEALED", "DISQUALIFIED"])("rejects application %s", async status => {
    app.status = status; expect((await request()).status).toBe(409); noWrites();
  });
  it.each(["finalizedAt", "finalizationReceiptId", "finalizationReason", "finalizationQuestionCount", "actualStartedAt", "deadlineAt", "contentRevisionId", "executionConfiguration"])("fails closed for missing %s", async field => {
    app[field] = null; expect((await request()).status).toBe(409); noWrites();
  });
  it.each([null, 0, -1, "25", {}, 1e100])("fails closed for invalid captured maximum %#", async maximum => {
    app.executionConfiguration.essayMaximumScore = maximum; expect((await request()).status).toBe(409); noWrites();
  });
  it.each(["essayScore", "gradedById", "essayEvaluatedAt"])("partial evaluation %s never permits overwrite", async field => {
    app.score[field] = field === "essayScore" ? 0 : field === "essayEvaluatedAt" ? new Date() : ids.admin;
    expect((await request()).status).toBe(409); noWrites();
    expect((await (await request(undefined, "ADMIN", ids.app, "GET")).json()).essayEvaluation.status).toBe("STAFF_REVIEW");
  });
  it("requires an existing pending score and current active ADMIN", async () => {
    app.score = null; expect((await request()).status).toBe(409); app = evaluationApplication(); app.score.status = "PASSED";
    expect((await request()).status).toBe(409); app.score.status = "PENDING";
    db.user.findUnique.mockResolvedValue({ role: "PANELIST", isActive: true }); expect((await request()).status).toBe(403); noWrites();
  });
  it("validates exact identity and missing record", async () => {
    expect((await request({}, "ADMIN", "bad")).status).toBe(400);
    db.$queryRaw.mockResolvedValue([]); expect((await request()).status).toBe(404); noWrites();
  });
  it("rejects inactive evaluator, non-null total, missing revision and bounded unexpected errors", async () => {
    db.user.findUnique.mockResolvedValue({ role: "ADMIN", isActive: false }); expect((await request()).status).toBe(403);
    db.user.findUnique.mockResolvedValue({ role: "ADMIN", isActive: true }); app.score.totalScore = 10; expect((await request()).status).toBe(409);
    app.score.totalScore = null; db.examContentRevision.findUnique.mockResolvedValue(null); expect((await request()).status).toBe(404); noWrites();
    db.$transaction.mockRejectedValue(new Error("secret-database-detail"));
    const response = await request(); expect(response.status).toBe(500); expect(await response.text()).not.toContain("secret-database-detail");
  });
  it.each([0, 2])("invalid frozen essay count %s requires staff review", async count => {
    revision.questions = revision.questions.filter((q: any) => q.content.type !== "ESSAY");
    for (let i = 0; i < count; i++) revision.questions.push({ questionId: i ? ids.admin : essayId, position: i + 1, content: setEssay(i ? ids.admin : essayId) });
    expect((await request()).status).toBe(409); noWrites();
    expect((await (await request(undefined, "ADMIN", ids.app, "GET")).json()).essayEvaluation.status).toBe("STAFF_REVIEW");
  });
  it.each([null, "", "   \n", "actual\nresponse  "])("reads missing/blank/exact finalized response truthfully %#", async value => {
    answer = value === null ? null : { essayAnswer: value, selectedOptionId: null };
    const dto = await (await request(undefined, "ADMIN", ids.app, "GET")).json();
    expect(dto.essayEvaluation).toMatchObject({ status: "PENDING", questionId: essayId, responseText: value, maximumScore: 25.5, essayScore: null, evaluatedAt: null });
    expect(dto.essayEvaluation.responseState).toBe(value === null ? "MISSING" : value.trim() ? "SUBMITTED" : "BLANK");
    expect(dto.essayEvaluation.question.questionText).toBe(setEssay().questionText); expect(dto.essayAnswers).toEqual([]);
    expect(db.applicantAnswer.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { applicationId_questionId: { applicationId: ids.app, questionId: essayId } } }));
    noWrites(); expect((await request({ essayScore: 0 })).status).toBe(200);
  });
  it("rejects inconsistent saved response, finalization counts/reason/time, and unsafe partial score evidence", async () => {
    answer.selectedOptionId = ids.admin; expect((await request()).status).toBe(409); answer.selectedOptionId = null;
    app.finalizationQuestionCount = 5; expect((await request()).status).toBe(409); app.finalizationQuestionCount = 2;
    app.finalizationReason = "UNKNOWN"; expect((await request()).status).toBe(409); app.finalizationReason = "TIME_EXPIRED";
    expect((await request()).status).toBe(409); app.finalizedAt = app.deadlineAt; expect((await request()).status).toBe(200);
  });
  it("Program mutation cannot change captured grading bounds", async () => {
    app.program.examEssayTotal = 1; expect((await request({ essayScore: 25.5 })).status).toBe(200);
    expect(db.examQuestion.count).not.toHaveBeenCalled();
  });
  it("historical terminal scores receive no fabricated B7 evidence", async () => {
    app = { ...evaluationApplication(), status: "PASSED", actualStartedAt: null, deadlineAt: null, contentRevisionId: null, executionConfiguration: null,
      finalizedAt: null, finalizationReason: null, finalizationReceiptId: null, finalizationAnsweredCount: null, finalizationQuestionCount: null };
    app.student.user = { firstName: "A", lastName: "B", email: "a@example.invalid" }; app.score.essayScore = new Prisma.Decimal(18); app.score.status = "PASSED";
    const result = await new ExamRepository().getApplicationDetail(ids.app); expect(result?.essayEvaluation.status).toBe("LEGACY"); expect(result?.score?.essayEvaluatedAt).toBeNull();
    expect((await request()).status).toBe(409); noWrites();
  });
  it("B0B Applicant result and result email remain unavailable after evaluation", async () => {
    expect((await request()).status).toBe(200); expect((await request({}, "ADMIN", ids.app, "POST", "send-email")).status).toBe(409); expect(email).not.toHaveBeenCalled();
    const token = jwt.sign({ userId: ids.user, role: "APPLICANT" }, secret);
    const response = await fetch(`${base}/result`, { headers: { Authorization: `Bearer ${token}` } });
    expect(response.status).toBe(409); expect(await response.json()).toMatchObject({ error: expect.stringContaining("not yet available") });
  });
});
