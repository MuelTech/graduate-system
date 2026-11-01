import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  $transaction: vi.fn(), $queryRaw: vi.fn(),
  examQuestion: { findUnique: vi.fn() },
  applicantAnswer: { upsert: vi.fn() },
  entranceExamApplication: { update: vi.fn() },
  entranceExamScore: { upsert: vi.fn() },
}));
vi.mock("../../../src/config/database", () => ({ default: db }));
import { ExamEngineRepository } from "../../../src/repositories/exam-engine.repository";

const q1 = "aaaaaaaa-1111-4111-8111-111111111111";
const q2 = "22222222-2222-4222-8222-222222222222";
const essayId = "33333333-3333-4333-8333-333333333333";
const o1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const o2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const missing = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const repo = new ExamEngineRepository();
const correct = { questionId: q1, selectedOptionId: o1 };

beforeEach(() => {
  vi.resetAllMocks();
  db.$transaction.mockImplementation(callback => callback(db));
  db.$queryRaw.mockResolvedValue([{ status: "PENDING" }]);
  db.examQuestion.findUnique.mockImplementation(async ({ where }) => ({
    [q1]: { type: "MULTIPLE_CHOICE", options: [{ id: o1, isCorrect: true }] },
    [q2]: { type: "MULTIPLE_CHOICE", options: [{ id: o2, isCorrect: false }] },
    [essayId]: { type: "ESSAY", options: [] },
  })[where.id] ?? null);
});

function noWrites() {
  expect(db.applicantAnswer.upsert).not.toHaveBeenCalled();
  expect(db.entranceExamApplication.update).not.toHaveBeenCalled();
  expect(db.entranceExamScore.upsert).not.toHaveBeenCalled();
}

describe("B0A validated unique answer persistence", () => {
  it.each([
    [undefined], [null], [{}], ["answers"], [[null]], [[[]]], [[5]],
    [[{}]], [[{ questionId: "", selectedOptionId: o1 }]],
    [[{ questionId: "not-an-id", selectedOptionId: o1 }]],
    [[correct, correct]], [[correct, { ...correct, questionId: q1.toUpperCase() }]],
    [[correct, { ...correct, selectedOptionId: o2 }]],
    [[{ questionId: q1, selectedOptionId: null }]],
    [[{ questionId: q1, selectedOptionId: o1, essayAnswer: "contradiction" }]],
    [[{ questionId: q1, selectedOptionId: o1, essayAnswer: null }]],
    [[{ questionId: essayId, essayAnswer: 3 }]],
    [[{ questionId: essayId, essayAnswer: "😀".repeat(16384) }]],
    [[{ ...correct, isCorrect: true }]],
    [[{ questionId: q1 }]],
    [Array(1001).fill(correct)],
  ])("rejects malformed/duplicate payload %# before writes", async payload => {
    await expect(repo.submitAnswers("app", payload)).rejects.toMatchObject({ statusCode: 400 });
    noWrites();
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it.each([
    { questionId: missing, selectedOptionId: o1 },
    { questionId: q2, selectedOptionId: missing },
    { questionId: q2, selectedOptionId: o1 },
    { questionId: q2, essayAnswer: "essay on MCQ" },
    { questionId: essayId, selectedOptionId: o1 },
  ])("rejects invalid database/type membership without partial finalization %#", async invalid => {
    await expect(repo.submitAnswers("app", [correct, invalid])).rejects.toMatchObject({ statusCode: 400 });
    noWrites();
  });

  it("fails closed on an unsupported persisted question type", async () => {
    db.examQuestion.findUnique.mockResolvedValue({ type: "UNKNOWN", options: [] });
    await expect(repo.submitAnswers("app", [correct])).rejects.toMatchObject({ statusCode: 400 });
    noWrites();
  });

  it("accepts UUID case aliases while storing one canonical identity", async () => {
    await repo.submitAnswers("app", [{ questionId: q1.toUpperCase(), selectedOptionId: o1.toUpperCase() }]);
    expect(db.applicantAnswer.upsert.mock.calls[0][0].create).toMatchObject(correct);
  });

  it("scores each distinct persisted choice once and writes essays separately", async () => {
    const result = await repo.submitAnswers("app", [correct, { questionId: q2, selectedOptionId: o2 }, { questionId: essayId, essayAnswer: "Final essay" }]);
    expect(result).toEqual({ success: true, mcqScore: 1 });
    expect(db.applicantAnswer.upsert).toHaveBeenCalledTimes(3);
    expect(db.applicantAnswer.upsert.mock.calls.map(([arg]) => arg.create)).toEqual([
      { applicationId: "app", ...correct, essayAnswer: null },
      { applicationId: "app", questionId: q2, selectedOptionId: o2, essayAnswer: null },
      { applicationId: "app", questionId: essayId, essayAnswer: "Final essay", selectedOptionId: null },
    ]);
    expect(db.entranceExamScore.upsert).toHaveBeenCalledWith({ where: { applicationId: "app" }, update: { multipleChoiceScore: 1 }, create: { applicationId: "app", multipleChoiceScore: 1, status: "PENDING" } });
    expect(JSON.stringify(result)).not.toMatch(/isCorrect|storageKey|answerKey/);
  });

  it.each([{ answers: [] }, { answers: [correct] }, { answers: [{ questionId: essayId, essayAnswer: "" }] }])("continues allowing omitted unanswered questions %#", async ({ answers }) => {
    await expect(repo.submitAnswers("app", answers)).resolves.toHaveProperty("success", true);
    expect(db.applicantAnswer.upsert).toHaveBeenCalledTimes(answers.length);
  });

  it.each(["PENDING", "APPROVED"])("admits %s to both write paths under the exact application lock", async status => {
    db.$queryRaw.mockResolvedValue([{ status }]);
    await repo.autoSaveAnswer("owned-app", essayId, "Draft");
    await repo.submitAnswers("owned-app", [correct]);
    for (const [sql, id] of db.$queryRaw.mock.calls) {
      expect(sql.join("?")).toMatch(/SELECT status FROM entrance_exam_applications\s+WHERE application_id = \? FOR UPDATE/);
      expect(id).toBe("owned-app");
    }
    expect(db.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(db.examQuestion.findUnique.mock.invocationCallOrder[0]);
  });

  it.each(["TAKEN", "PASSED", "FAILED", "APPEALED", "DISQUALIFIED", "UNKNOWN"])("rejects %s in both paths before question lookup or writes", async status => {
    db.$queryRaw.mockResolvedValue([{ status }]);
    await expect(repo.submitAnswers("app", [correct])).rejects.toMatchObject({ statusCode: 409 });
    await expect(repo.autoSaveAnswer("app", essayId, "Late")).rejects.toMatchObject({ statusCode: 409 });
    noWrites();
    expect(db.examQuestion.findUnique).not.toHaveBeenCalled();
  });

  it("rejects missing applications", async () => {
    db.$queryRaw.mockResolvedValue([]);
    await expect(repo.submitAnswers("missing", [])).rejects.toMatchObject({ statusCode: 404 });
    await expect(repo.autoSaveAnswer("missing", essayId, "x")).rejects.toMatchObject({ statusCode: 404 });
    noWrites();
  });

  it.each([q1, missing])("rejects autosave to a non-essay or missing question %s", async questionId => {
    await expect(repo.autoSaveAnswer("app", questionId, "Draft")).rejects.toMatchObject({ statusCode: 400 });
    noWrites();
  });

  it("autosaves valid essay text, including empty text, without a selected option", async () => {
    await repo.autoSaveAnswer("app", essayId, "");
    expect(db.applicantAnswer.upsert).toHaveBeenCalledWith({
      where: { applicationId_questionId: { applicationId: "app", questionId: essayId } },
      update: { essayAnswer: "", selectedOptionId: null },
      create: { applicationId: "app", questionId: essayId, essayAnswer: "", selectedOptionId: null },
    });
  });
});
