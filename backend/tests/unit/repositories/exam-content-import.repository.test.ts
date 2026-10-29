import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { validateExamQuestion } from "../../../src/services/exam-content.rules";
const db = vi.hoisted(() => ({
  examContentImport: { findUnique: vi.fn(), create: vi.fn() },
  examQuestion: { create: vi.fn() },
  $transaction: vi.fn(),
}));
vi.mock("../../../src/config/database", () => ({ default: db }));
import { ExamContentImportRepository } from "../../../src/repositories/exam-content-import.repository";

const question = () => ({ sourceQuestionNumber: 5, input: validateExamQuestion({ questionText: "Synthetic.", type: "MULTIPLE_CHOICE", order: 5, options: [{ label: "F", optionText: "One", isCorrect: false }, { label: "K", optionText: "Two", isCorrect: true }] }) });
beforeEach(() => {
  vi.resetAllMocks();
  db.$transaction.mockImplementation(async callback => callback(db));
});

describe("atomic import repository", () => {
  it("reads explicit package fingerprint and actual question count for duplicate checks", async () => {
    db.examContentImport.findUnique.mockResolvedValue({ fingerprint: "hash", questionCount: 72, _count: { questions: 72 } });
    expect(await new ExamContentImportRepository().find("olsat")).toEqual({ fingerprint: "hash", questionCount: 72, actualQuestionCount: 72 });
    expect(db.examContentImport.findUnique.mock.calls[0][0]).toEqual({ where: { id: "olsat" }, select: { fingerprint: true, questionCount: true, _count: { select: { questions: true } } } });
  });

  it("persists package marker and all questions/options inside one bounded transaction", async () => {
    await new ExamContentImportRepository().commit("olsat", "hash", [question()]);
    expect(db.$transaction).toHaveBeenCalledExactlyOnceWith(expect.any(Function), { maxWait: 10000, timeout: 60000 });
    expect(db.examContentImport.create).toHaveBeenCalledWith({ data: { id: "olsat", fingerprint: "hash", questionCount: 1 } });
    const data = db.examQuestion.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ sourceImportId: "olsat", sourceQuestionNumber: 5, order: 5, stimulusType: "NONE", structuredStimulus: Prisma.DbNull });
    expect(data.options.create.map((opt: { label: string; isCorrect: boolean }) => [opt.label, opt.isCorrect])).toEqual([["F", false], ["K", true]]);
    expect(data).not.toHaveProperty("correctAnswer");
    expect(data).not.toHaveProperty("sourceFile");
  });

  it("validates accepted content invariants before starting any transaction", async () => {
    const invalid = question();
    invalid.input.options[0].isCorrect = true;
    await expect(new ExamContentImportRepository().commit("olsat", "hash", [invalid])).rejects.toThrow();
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("rejects the transaction on a question failure instead of swallowing partial-bank errors", async () => {
    db.examQuestion.create.mockRejectedValue(new Error("insert failed"));
    await expect(new ExamContentImportRepository().commit("olsat", "hash", [question(), question()])).rejects.toThrow("insert failed");
    expect(db.examQuestion.create).toHaveBeenCalledTimes(1);
  });
});
