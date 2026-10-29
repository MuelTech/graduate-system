import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const db = vi.hoisted(() => ({
  examQuestion: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  examOption: { deleteMany: vi.fn(), create: vi.fn(), update: vi.fn() },
  applicantAnswer: { count: vi.fn(), upsert: vi.fn() },
  entranceExamApplication: { findUnique: vi.fn(), update: vi.fn() },
  entranceExamScore: { upsert: vi.fn() },
  $transaction: vi.fn(),
}));
vi.mock("../../../src/config/database", () => ({ default: db }));

import { ExamEngineRepository } from "../../../src/repositories/exam-engine.repository";
import { applicantQuestionSelect, toApplicantQuestion } from "../../../src/repositories/exam-content.projection";
import { validateExamQuestion } from "../../../src/services/exam-content.rules";

const mediaId = "c523f44d-c5ae-4b82-91bf-ccaf165ad567";
function row() {
  return {
    id: "q1", questionText: "Choose.", type: "MULTIPLE_CHOICE" as const, order: 1,
    stimulusType: "IMAGE" as const, stimulusMediaId: mediaId, structuredStimulus: null,
    storageKey: "private/question", provider: "local", answerKeyCandidate: "SECRET",
    options: [
      { id: "opt1", questionId: "q1", optionText: null, mediaId, order: 2, label: "F", isCorrect: true, storageKey: "private/option", filePath: "/private/image.png" },
      { id: "opt2", questionId: "q1", optionText: "Other", mediaId: null, order: 7, label: "K", isCorrect: false, storageKey: null, filePath: null },
    ],
  };
}
function editable() {
  const current = row();
  const { id: _id, storageKey: _key, provider: _provider, answerKeyCandidate: _answer, ...data } = current;
  return { ...data, options: current.options.map(({ questionId: _qid, storageKey: _storage, filePath: _path, ...opt }) => opt) };
}

beforeEach(() => {
  vi.resetAllMocks();
  db.$transaction.mockImplementation(async callback => callback(db));
  db.examQuestion.findMany.mockResolvedValue([row()]);
  db.examQuestion.findUnique.mockResolvedValue(row());
  db.examQuestion.create.mockResolvedValue(row());
  db.examQuestion.update.mockResolvedValue(row());
  db.applicantAnswer.count.mockResolvedValue(0);
});

describe("ExamEngineRepository content boundaries", () => {
  it("selects only explicit Applicant fields, including label/order/media identity", async () => {
    const result = await new ExamEngineRepository().getQuestionsForApplicant();
    expect(db.examQuestion.findMany).toHaveBeenCalledWith({ select: applicantQuestionSelect, orderBy: [{ order: "asc" }, { id: "asc" }] });
    const projection = JSON.stringify(applicantQuestionSelect);
    expect(projection).not.toContain("isCorrect");
    expect(projection).not.toContain("storageKey");
    expect(result[0].options.map(opt => [opt.id, opt.label, opt.order])).toEqual([["opt1", "F", 2], ["opt2", "K", 7]]);
  });

  it("strips correctness and internal metadata even if handed a wider row", () => {
    const safe = toApplicantQuestion(row());
    const serialized = JSON.stringify(safe);
    for (const forbidden of ["isCorrect", "storageKey", "provider", "filePath", "answerKeyCandidate", "SECRET", "/private/"]) expect(serialized).not.toContain(forbidden);
    expect(safe.stimulusMediaId).toBe(mediaId);
    expect(safe.options[0].optionText).toBeNull();
  });

  it("fails closed on a raw storage path masquerading as a media ID", () => {
    expect(() => toApplicantQuestion({ ...row(), stimulusMediaId: "assets/private.png" })).toThrow();
    const current = row();
    current.options[0].mediaId = "private/key";
    expect(() => toApplicantQuestion(current)).toThrow();
  });

  it("fails closed on unknown structured fields from persistence", () => {
    expect(() => toApplicantQuestion({ ...row(), stimulusType: "STRUCTURED", structuredStimulus: { type: "WORD_BANK", items: ["a"], correctAnswer: "F" } })).toThrow();
  });

  it("retains correct-answer state for Admin only", async () => {
    const result = await new ExamEngineRepository().getAllQuestionsForAdmin();
    expect(result[0].options.map(opt => opt.isCorrect)).toEqual([true, false]);
    expect(JSON.stringify(result)).not.toContain("storageKey");
  });

  it("writes validated label/order/image content without question-level answer authority", async () => {
    const input = editable();
    const options = input.options.map(({ id: _id, ...opt }) => opt);
    await new ExamEngineRepository().createQuestion(validateExamQuestion({ ...input, options }));
    const call = db.examQuestion.create.mock.calls[0][0];
    expect(call.data.options.create[0]).toMatchObject({ label: "F", order: 2, optionText: null, mediaId, isCorrect: true });
    expect(call.data.structuredStimulus).toBe(Prisma.DbNull);
    expect(call.data).not.toHaveProperty("correctAnswer");
  });

  it("rejects caller-supplied option IDs on creation", async () => {
    await expect(new ExamEngineRepository().createQuestion(validateExamQuestion(editable()))).rejects.toMatchObject({ statusCode: 400 });
    expect(db.examQuestion.create).not.toHaveBeenCalled();
  });

  it("round trips structured JSON through question persistence and both DTOs", async () => {
    const structuredStimulus = { type: "MATRIX", rows: [[1, "?"], [2, 4]] };
    const persisted = { ...row(), stimulusType: "STRUCTURED", stimulusMediaId: null, structuredStimulus };
    db.examQuestion.create.mockResolvedValue(persisted);
    db.examQuestion.findMany.mockResolvedValue([persisted]);
    const { id: _id, ...first } = editable().options[0];
    const { id: _id2, ...second } = editable().options[1];
    const created = await new ExamEngineRepository().createQuestion(validateExamQuestion({ ...editable(), stimulusType: "STRUCTURED", stimulusMediaId: null, structuredStimulus, options: [first, second] }));
    expect(created.structuredStimulus).toEqual(structuredStimulus);
    expect(db.examQuestion.create.mock.calls[0][0].data.structuredStimulus).toEqual(structuredStimulus);
    expect((await new ExamEngineRepository().getQuestionsForApplicant())[0].structuredStimulus).toEqual(structuredStimulus);
  });

  it("updates question metadata without touching option identities", async () => {
    await new ExamEngineRepository().updateQuestion("q1", { questionText: "Updated." });
    expect(db.examQuestion.update.mock.calls[0][0].data.questionText).toBe("Updated.");
    expect(db.examOption.deleteMany).not.toHaveBeenCalled();
    expect(db.examOption.update).not.toHaveBeenCalled();
    expect(db.examOption.create).not.toHaveBeenCalled();
  });

  it("preserves supplied option IDs and their selectedOptionId references", async () => {
    await new ExamEngineRepository().updateQuestion("q1", { options: editable().options });
    expect(db.examOption.update).toHaveBeenCalledTimes(2);
    expect(db.examOption.update.mock.calls[0][0].where).toEqual({ id: "opt1" });
    expect(db.examOption.deleteMany).not.toHaveBeenCalled();
    expect(db.examOption.create).not.toHaveBeenCalled();
  });

  it("allows metadata-only edits of legacy rows whose option orders all defaulted to zero", async () => {
    const current = { ...row(), options: row().options.map(opt => ({ ...opt, order: 0, label: null })) };
    db.examQuestion.findUnique.mockResolvedValue(current);
    await new ExamEngineRepository().updateQuestion("q1", { questionText: "Legacy update." });
    expect(db.examQuestion.update).toHaveBeenCalled();
    expect(db.examOption.update).not.toHaveBeenCalled();
    expect(db.examOption.deleteMany).not.toHaveBeenCalled();
  });

  it("rejects destructive replacement of options used by historical answers", async () => {
    db.applicantAnswer.count.mockResolvedValue(1);
    const options = editable().options.map(({ id: _id, ...opt }) => opt);
    await expect(new ExamEngineRepository().updateQuestion("q1", { options })).rejects.toMatchObject({ statusCode: 409 });
    expect(db.examOption.deleteMany).not.toHaveBeenCalled();
    expect(db.examQuestion.update).not.toHaveBeenCalled();
  });

  it("keeps legacy replacement compatible when options have no answer references", async () => {
    const options = editable().options.map(({ id: _id, ...opt }) => opt);
    await new ExamEngineRepository().updateQuestion("q1", { options });
    expect(db.examOption.deleteMany).toHaveBeenCalledWith({ where: { questionId: "q1", id: { in: ["opt1", "opt2"] } } });
    expect(db.examOption.create).toHaveBeenCalledTimes(2);
  });

  it("rejects foreign option IDs and invalid effective partial updates before writes", async () => {
    await expect(new ExamEngineRepository().updateQuestion("q1", { options: [{ ...editable().options[0], id: "foreign" }, editable().options[1]] })).rejects.toMatchObject({ statusCode: 400 });
    await expect(new ExamEngineRepository().updateQuestion("q1", { type: "ESSAY" })).rejects.toMatchObject({ statusCode: 400 });
    expect(db.examQuestion.update).not.toHaveBeenCalled();
    expect(db.examOption.deleteMany).not.toHaveBeenCalled();
  });

  it("returns 404 for missing questions", async () => {
    db.examQuestion.findUnique.mockResolvedValue(null);
    await expect(new ExamEngineRepository().updateQuestion("missing", {})).rejects.toMatchObject({ statusCode: 404 });
  });

  it("continues scoring and persisting image choices by selectedOptionId", async () => {
    db.entranceExamApplication.findUnique.mockResolvedValue({ id: "app1", status: "SCHEDULED" });
    const result = await new ExamEngineRepository().submitAnswers("app1", [{ questionId: "q1", selectedOptionId: "opt1" }]);
    expect(result.mcqScore).toBe(1);
    expect(db.applicantAnswer.upsert.mock.calls[0][0]).toMatchObject({
      create: { applicationId: "app1", questionId: "q1", selectedOptionId: "opt1" },
      update: { selectedOptionId: "opt1" },
    });
    expect(db.entranceExamScore.upsert.mock.calls[0][0].create.multipleChoiceScore).toBe(1);
  });
});
