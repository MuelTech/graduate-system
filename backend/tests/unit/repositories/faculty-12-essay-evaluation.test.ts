import { beforeEach, describe, expect, it, vi } from "vitest";
import { evaluationApplication, evaluationRevision } from "../../fixtures/exam-essay-evaluation";
import { executionIds as ids } from "../../fixtures/exam-execution";
import { essayId, mediaId, otherId, setEssay } from "../../fixtures/exam-question-set";
const db = vi.hoisted(() => ({
  user: { findUnique: vi.fn() }, entranceExamApplication: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
  entranceExamScore: { update: vi.fn() }, examContentRevision: { findUnique: vi.fn() },
  applicantAnswer: { findUnique: vi.fn(), findMany: vi.fn() }, $transaction: vi.fn(), $queryRaw: vi.fn(),
}));
vi.mock("../../../src/config/database", () => ({ default: db }));
vi.mock("../../../src/services/email.service", () => ({ EmailService: { sendTemplateEmail: vi.fn() } }));
import { FacultyEssayAuthorization, FACULTY_ESSAY_EVALUATION_ENABLED } from "../../../src/access/faculty-essay-authorization";
import { FacultyEssayEvaluationRepository } from "../../../src/repositories/faculty-essay-evaluation.repository";
import { FacultyEssayEvaluationService } from "../../../src/services/faculty-essay-evaluation.service";
import { ExamService } from "../../../src/services/exam.service";
import { ExamRepository } from "../../../src/repositories/exam.repository";
import { ExamAdministrationAuthorization } from "../../../src/access/exam-administration-authorization";

let actor: any, app: any, revision: any, answer: any;
const access = new FacultyEssayAuthorization(true, async id => id === actor?.id ? actor : null);
const repo = new FacultyEssayEvaluationRepository(access, db as any);
const service = new FacultyEssayEvaluationService(repo, access);
function academic(role = "FACULTY", extra = {}) {
  return { id: ids.admin, role, isActive: true, mustChangePassword: false,
    panelist: { id: "academic-profile", userId: ids.admin, isActive: true, isExternal: false },
    administratorAccess: null, capabilityGrants: [{ capabilityKey: "essay.evaluate" }], ...extra };
}
beforeEach(() => {
  vi.resetAllMocks(); actor = academic(); app = evaluationApplication(); revision = evaluationRevision();
  app.student.user = { firstName: "Applicant", lastName: "Synthetic", email: "private-email", passwordHash: "private-hash" };
  answer = { essayAnswer: "Exact finalized\nresponse  ", selectedOptionId: null };
  db.user.findUnique.mockImplementation(async ({ where }) => where.id === actor?.id ? actor : null);
  db.entranceExamApplication.findUnique.mockImplementation(async ({ where }) => where.id === app.id ? app : null);
  db.entranceExamApplication.findMany.mockImplementation(async () => [app]);
  db.examContentRevision.findUnique.mockImplementation(async () => revision);
  db.applicantAnswer.findUnique.mockImplementation(async () => answer);
  db.applicantAnswer.findMany.mockImplementation(async () => answer ? [{ ...answer, questionId: essayId }] : []);
  db.$queryRaw.mockResolvedValue([{ id: 1 }]);
  db.entranceExamScore.update.mockImplementation(async ({ data }) => Object.assign(app.score, data, {
    gradedBy: { id: data.gradedById ?? app.score.gradedById, firstName: "Academic", lastName: "Evaluator" },
  }));
  db.entranceExamApplication.update.mockImplementation(async ({ data }) => Object.assign(app, data));
  // Models rollback only; actual InnoDB contention is a separate opt-in evidence class.
  db.$transaction.mockImplementation(async operation => {
    const status = app.status, score = app.score && { ...app.score };
    try { return await operation(db); } catch (error) { app.status = status; app.score = score; throw error; }
  });
});
const actions = [
  ["queue", () => service.queue(actor.id)], ["detail", () => service.detail(ids.app, actor.id)],
  ["grade", () => service.grade(ids.app, { essayScore: 0 }, actor.id)],
] as const;

describe.each(actions)("FACULTY-12 %s current authority", (_name, invoke) => {
  it.each(["FACULTY", "PANELIST"])("permits active %s with exact grant, including External", async role => {
    actor = academic(role, { panelist: { id: "profile", userId: ids.admin, isActive: true, isExternal: true } });
    await expect(invoke()).resolves.toBeDefined();
  });
  it.each([
    { capabilityGrants: [] }, { capabilityGrants: [{ capabilityKey: "faculty.view" }] },
    { capabilityGrants: [{ capabilityKey: "unknown" }] }, { capabilityGrants: null },
    { capabilityGrants: [{ capabilityKey: "essay.evaluate" }, { capabilityKey: "essay.evaluate" }] },
    { capabilityGrants: [{ capabilityKey: "essay.evaluate" }, { capabilityKey: "exam.records.view" }] },
    { isActive: false }, { mustChangePassword: true }, { mustChangePassword: null },
    { panelist: null }, { panelist: { id: "profile", userId: ids.admin, isActive: false } },
    { panelist: { id: "profile", userId: ids.user, isActive: true } },
    { administratorAccess: { level: "FULL" } },
    ...["STUDENT", "APPLICANT", "CUSTOM", "ADMIN"].map(role => ({ role })),
    { role: "ADMIN", administratorAccess: { level: "FULL" }, capabilityGrants: [] },
    { role: "ADMIN", administratorAccess: { level: "RESTRICTED" }, capabilityGrants: [{ capabilityKey: "exam.records.view" }] },
  ])("denies invalid/revoked/wrong-category state %#", async extra => {
    actor = academic("FACULTY", extra);
    await expect(invoke()).rejects.toMatchObject({ statusCode: 403 });
    expect(db.entranceExamApplication.findMany).not.toHaveBeenCalled();
    expect(db.entranceExamScore.update).not.toHaveBeenCalled();
  });
});

describe("FACULTY-12 shared B7 pending projection", () => {
  it("sees eligible work across Programs; projections contain only the allowed fields", async () => {
    const another = { ...app, id: otherId, program: { programName: "Different Program" } };
    db.entranceExamApplication.findMany.mockResolvedValue([app, another]);
    const queue = await service.queue(actor.id);
    expect(queue.items.map(row => row.programName)).toEqual([app.program.programName, "Different Program"]);
    expect(Object.keys(queue.items[0]).sort()).toEqual(["applicationId", "applicant", "programName", "examDate", "finalizedAt", "status"].sort());
    const where = db.entranceExamApplication.findMany.mock.calls[0][0].where;
    expect(JSON.stringify(where)).not.toMatch(/program|office|faculty|studentId/i);
    const detail = await service.detail(ids.app, actor.id);
    expect(detail).toMatchObject({ status: "PENDING", responseText: answer.essayAnswer, responseState: "SUBMITTED", maximumScore: 25.5 });
    expect(detail.question.questionText).toBe(setEssay().questionText);
    expect(Object.keys(detail).sort()).toEqual(["applicationId", "applicant", "programName", "examDate", "finalizedAt", "status", "questionId", "question", "responseText", "responseState", "maximumScore"].sort());
    for (const value of [queue, detail]) expect(JSON.stringify(value)).not.toMatch(/isCorrect|answerKey|correctOption|multipleChoiceScore|mcq|totalScore|scoringBasis|passingThreshold|resultDecision|reconsideration|storageKey|executionConfiguration|email|passwordHash|contentRevisionId/);
  });
  const invalid = [
    ["non-finalized", () => { app.finalizedAt = null; }],
    ...["finalizationReceiptId", "finalizationReason", "finalizationAnsweredCount", "finalizationQuestionCount", "actualStartedAt", "deadlineAt", "contentRevisionId", "executionConfiguration"].map(key => [key, () => { app[key] = null; }]),
    ["invalid receipt", () => { app.finalizationReceiptId = ""; }],
    ["wrong reason", () => { app.finalizationReason = "UNKNOWN"; }],
    ["wrong timing", () => { app.finalizedAt = new Date("2000-01-01"); }],
    ["invalid timeout", () => { app.finalizationReason = "TIME_EXPIRED"; }],
    ["invalid maximum", () => { app.executionConfiguration.essayMaximumScore = 0; }],
    ["missing maximum", () => { app.executionConfiguration.essayMaximumScore = null; }],
    ["wrong count", () => { app.finalizationQuestionCount = 99; }],
    ["missing revision", () => { revision = null; }],
    ["invalid revision", () => { revision.questions[0].content = {}; }],
    ["null revision content", () => { revision.questions[0].content = null; }],
    ["invalid frozen option", () => { revision.questions[0].content.options = [null]; }],
    ["zero essays", () => { revision.questions.pop(); }],
    ["multiple essays", () => { revision.questions[0].content = setEssay(otherId); revision.questions[0].questionId = otherId; }],
    ["missing score", () => { app.score = null; }],
    ["non-pending score", () => { app.score.status = "PASSED"; }],
    ["non-null total", () => { app.score.totalScore = 1; }],
    ["partial evaluated score", () => { app.score.essayScore = 0; }],
    ["partial evaluator", () => { app.score.gradedById = actor.id; }],
    ["partial time", () => { app.score.essayEvaluatedAt = new Date(); }],
    ["partial scoring", () => { app.score.scoredAt = new Date(); }],
    ["legacy terminal", () => { app.status = "PASSED"; app.score.status = "PASSED"; app.score.totalScore = 10; }],
    ["corrupt response", () => { answer.selectedOptionId = otherId; }],
    ["invalid response text", () => { answer.essayAnswer = null; }],
  ] as const;
  it.each(invalid)("excludes %s from queue and rejects guessed detail/write", async (_name, corrupt) => {
    corrupt(); expect((await service.queue(actor.id)).items).toEqual([]);
    await expect(service.detail(ids.app, actor.id)).rejects.toBeDefined();
    await expect(service.grade(ids.app, { essayScore: 0 }, actor.id)).rejects.toBeDefined();
    expect(db.entranceExamScore.update).not.toHaveBeenCalled();
  });
  it.each([null, "", " \n ", "Exact finalized\nanswer  "])("preserves missing/blank/exact response %#", async value => {
    answer = value === null ? null : { essayAnswer: value, selectedOptionId: null };
    app.finalizationAnsweredCount = value?.trim() ? 1 : 0;
    const detail = await service.detail(ids.app, actor.id);
    expect(detail.responseText).toBe(value);
    expect(detail.responseState).toBe(value === null ? "MISSING" : value.trim() ? "SUBMITTED" : "BLANK");
    await expect(service.grade(ids.app, { essayScore: 0 }, actor.id)).resolves.toMatchObject({ essayScore: 0 });
  });
  it("uses the recorded revision and maximum even after mutable bank/Program/config changes", async () => {
    app.program.examEssayTotal = 1; app.program.currentConfiguration = { essayMaximumScore: 1 };
    const result = await service.detail(ids.app, actor.id);
    expect(result.maximumScore).toBe(25.5); expect(result.question.questionText).toBe(setEssay().questionText);
    expect(db.examContentRevision.findUnique.mock.calls.every(call => call[0].where.id === ids.revision)).toBe(true);
    await expect(service.grade(ids.app, { essayScore: 25.5 }, actor.id)).resolves.toMatchObject({ essayScore: 25.5 });
  });
  it("paginates candidate scans without losing later valid rows behind invalid evidence", async () => {
    const candidates = Array.from({ length: 51 }, (_, i) => ({ ...app, id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`, score: null }));
    db.entranceExamApplication.findMany.mockResolvedValue(candidates);
    const page = await service.queue(actor.id); expect(page.items).toEqual([]); expect(page.nextCursor).toBe(candidates[49].id);
    db.entranceExamApplication.findMany.mockResolvedValue([app]);
    expect((await service.queue(actor.id, page.nextCursor)).items).toHaveLength(1);
    expect(db.entranceExamApplication.findMany.mock.lastCall?.[0].where.id).toEqual({ gt: page.nextCursor });
  });
  it("unexpected database failure is not a successful empty queue", async () => {
    db.examContentRevision.findUnique.mockRejectedValue(new Error("database private details"));
    await expect(service.queue(actor.id)).rejects.toThrow();
  });
  it("rejects malformed/missing exact identities without accidental grading", async () => {
    await expect(service.detail("bad", actor.id)).rejects.toMatchObject({ statusCode: 400 });
    await expect(service.grade("bad", { essayScore: 0 }, actor.id)).rejects.toMatchObject({ statusCode: 400 });
    await expect(service.queue(actor.id, "bad")).rejects.toMatchObject({ statusCode: 400 });
    await expect(service.detail(otherId, actor.id)).rejects.toMatchObject({ statusCode: 404 });
    db.$queryRaw.mockImplementation(async strings => String(strings).includes("entrance_exam_applications") ? [] : [{ id: 1 }]);
    await expect(service.grade(otherId, { essayScore: 0 }, actor.id)).rejects.toMatchObject({ statusCode: 404 });
    expect(db.entranceExamScore.update).not.toHaveBeenCalled();
  });
  it("media is bound only to the pending essay image, not other revision/MCQ media", async () => {
    await expect(repo.mediaContext(ids.app, mediaId, actor.id)).rejects.toMatchObject({ statusCode: 404 });
    Object.assign(revision.questions[1].content, { stimulusType: "IMAGE", stimulusMediaId: mediaId });
    expect(await repo.mediaContext(ids.app, mediaId, actor.id)).toBe(ids.revision);
    await expect(repo.mediaContext(ids.app, otherId, actor.id)).rejects.toMatchObject({ statusCode: 404 });
    await service.grade(ids.app, { essayScore: 1 }, actor.id);
    await expect(repo.mediaContext(ids.app, mediaId, actor.id)).rejects.toMatchObject({ statusCode: 409 });
  });
});

describe("FACULTY-12 immutable B7/B8 write", () => {
  it.each([null, {}, [], { essayScore: "1" }, { essayScore: null }, { essayScore: -1 },
    ...["remarks", "rubric", "multipleChoiceScore", "totalScore", "result", "evaluatorId", "programId", "regrade", "sendEmail"].map(key => ({ essayScore: 1, [key]: true })),
  ])("accepts only the strict existing body %#", async body => {
    await expect(service.grade(ids.app, body, actor.id)).rejects.toMatchObject({ statusCode: 400 });
    expect(db.entranceExamScore.update).not.toHaveBeenCalled();
  });
  it.each([NaN, Infinity, -Infinity, "1", null, -1, 25.6, 1e-31])("repository rejects invalid number/bounds/precision %s", async score => {
    await expect(repo.grade(ids.app, score as number, actor.id)).rejects.toMatchObject({ statusCode: 400 });
    expect(db.entranceExamScore.update).not.toHaveBeenCalled();
  });
  it.each([0, 18.25, 25.5])("grades %s once, invokes real B8 atomically, returns a narrow receipt", async value => {
    const result = await service.grade(ids.app, { essayScore: value }, actor.id);
    expect(result).toMatchObject({ applicationId: ids.app, status: "COMPLETED", essayScore: value, maximumScore: 25.5, evaluator: { id: actor.id } });
    expect(result.evaluatedAt).toBeTruthy();
    expect(Object.keys(result).sort()).toEqual(["applicationId", "status", "essayScore", "maximumScore", "evaluator", "evaluatedAt"].sort());
    expect(Object.keys(db.entranceExamScore.update.mock.calls[0][0].data).sort()).toEqual(["essayScore", "gradedById", "essayEvaluatedAt"].sort());
    expect(app.score.scoringBasis).toMatchObject({ version: 1, essayScore: String(value), essayMaximum: "25.5", passingThreshold: "75" });
    expect(["PASSED", "FAILED"]).toContain(app.status); expect(app.score.status).toBe(app.status);
    const persisted = { ...app.score };
    expect((await service.queue(actor.id)).items).toHaveLength(0);
    await expect(service.detail(ids.app, actor.id)).rejects.toMatchObject({ statusCode: 409 });
    for (const score of [value, 1]) await expect(service.grade(ids.app, { essayScore: score }, actor.id)).rejects.toMatchObject({ statusCode: 409 });
    expect(app.score).toEqual(persisted);
    const locks = db.$queryRaw.mock.calls.slice(0, 4).map(call => String(call[0]));
    expect(locks[0]).toContain("administrator_access_lock"); expect(locks[1]).toContain("FROM users");
    expect(locks[2]).toContain("FROM panelists"); expect(locks[3]).toContain("entrance_exam_applications");
    expect(db.$transaction.mock.calls[0][1].isolationLevel).toBe("ReadCommitted");
    expect(db.user.findUnique.mock.invocationCallOrder[0]).toBeGreaterThan(db.$queryRaw.mock.invocationCallOrder[2]);
  });
  it.each(["revoke", "disable User", "disable profile", "require password change", "change identity"])("rechecks %s after waiting on the fence", async scenario => {
    let release!: () => void, arrived!: () => void;
    const wait = new Promise<void>(resolve => { release = resolve; });
    const waiting = new Promise<void>(resolve => { arrived = resolve; });
    db.$queryRaw.mockImplementation(async strings => {
      if (String(strings).includes("administrator_access_lock")) { arrived(); await wait; }
      return [{ id: 1 }];
    });
    const result = service.grade(ids.app, { essayScore: 5 }, actor.id).then(value => ({ value }), error => ({ error }));
    await waiting;
    if (scenario === "revoke") actor.capabilityGrants = [];
    if (scenario === "disable User") actor.isActive = false;
    if (scenario === "disable profile") actor.panelist.isActive = false;
    if (scenario === "require password change") actor.mustChangePassword = true;
    if (scenario === "change identity") actor.role = "ADMIN";
    release(); expect(await result).toMatchObject({ error: { statusCode: 403 } });
    expect(db.entranceExamScore.update).not.toHaveBeenCalled();
  });
  it("modeled distinct Faculty/PANELIST graders produce one winner and one conflict", async () => {
    const second = academic("PANELIST", { id: ids.user, panelist: { id: "other-profile", userId: ids.user, isActive: true } });
    const raceAccess = new FacultyEssayAuthorization(true, async id => id === actor.id ? actor : id === second.id ? second : null);
    const raceService = new FacultyEssayEvaluationService(new FacultyEssayEvaluationRepository(raceAccess, db as any), raceAccess);
    db.user.findUnique.mockImplementation(async ({ where }) => where.id === actor.id ? actor : second);
    let tail: Promise<unknown> = Promise.resolve();
    db.$transaction.mockImplementation(work => {
      const result = tail.then(() => work(db)); tail = result.catch(() => {}); return result;
    });
    const outcomes = await Promise.allSettled([raceService.grade(ids.app, { essayScore: 5 }, actor.id), raceService.grade(ids.app, { essayScore: 7 }, second.id)]);
    expect(outcomes.filter(outcome => outcome.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.find(outcome => outcome.status === "rejected")).toMatchObject({ reason: { statusCode: 409 } });
    expect(app.score.essayScore).toBe(5); expect(app.score.gradedById).toBe(actor.id);
  });
  it("B8 failure after the evaluation write rolls back evaluation/result together in the modeled transaction", async () => {
    const before = { ...app.score };
    db.entranceExamApplication.update.mockRejectedValue(new Error("injected scoring write failure"));
    await expect(service.grade(ids.app, { essayScore: 5 }, actor.id)).rejects.toThrow();
    expect(db.entranceExamScore.update).toHaveBeenCalledTimes(2);
    expect(app.score).toEqual(before); expect(app.status).toBe("TAKEN");
  });
  it("missing access sentinel and dormant normal composition fail closed", async () => {
    expect(FACULTY_ESSAY_EVALUATION_ENABLED).toBe(false);
    db.$queryRaw.mockResolvedValue([]);
    await expect(service.grade(ids.app, { essayScore: 0 }, actor.id)).rejects.toMatchObject({ statusCode: 503 });
    for (const operation of [() => new FacultyEssayEvaluationRepository().queue(actor.id),
      () => new FacultyEssayEvaluationRepository().detail(ids.app, actor.id),
      () => new FacultyEssayEvaluationRepository().grade(ids.app, 0, actor.id)]) await expect(operation()).rejects.toMatchObject({ statusCode: 503 });
  });
  it("target composition closes both legacy Admin service/repository writers even with the older exam gate off", async () => {
    const legacyExamAccess = new ExamAdministrationAuthorization(false);
    await expect(new ExamService(legacyExamAccess, access).gradeEssay(ids.app, 0, ids.admin)).rejects.toMatchObject({ statusCode: 403 });
    await expect(new ExamRepository(legacyExamAccess, access).gradeEssay(ids.app, 0, ids.admin)).rejects.toMatchObject({ statusCode: 403 });
    expect(db.$transaction).not.toHaveBeenCalled(); expect(db.entranceExamScore.update).not.toHaveBeenCalled();
  });
});
