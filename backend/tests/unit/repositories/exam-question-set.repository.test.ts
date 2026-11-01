import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { qid, otherId, mediaId, setQuestion } from "../../fixtures/exam-question-set";
import { selectionIds } from "../../../src/services/exam-question-set.rules";
import { applicantQuestionSelect } from "../../../src/repositories/exam-content.projection";
const db = vi.hoisted(() => ({
  $transaction: vi.fn(), examQuestion: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
  examQuestionSelection: { findMany: vi.fn(), deleteMany: vi.fn(), createMany: vi.fn() },
  examContentRevision: { findFirst: vi.fn(), create: vi.fn(), findUnique: vi.fn() },
  examRevisionQuestion: { count: vi.fn() }, examRevisionOption: { count: vi.fn() },
  applicantAnswer: { count: vi.fn() }, examOption: { deleteMany: vi.fn() },
}));
vi.mock("../../../src/config/database", () => ({ default: db }));
import { ExamQuestionSetRepository } from "../../../src/repositories/exam-question-set.repository";
import { ExamEngineRepository } from "../../../src/repositories/exam-engine.repository";
const repo = new ExamQuestionSetRepository();
let bank: any[]; let membership: string[]; let revisions: any[];
beforeEach(() => {
  vi.resetAllMocks(); bank = [setQuestion(qid), setQuestion(otherId, 3)]; membership = []; revisions = [];
  db.$transaction.mockImplementation(fn => fn(db));
  db.examQuestion.findMany.mockImplementation(({ where }) => bank.filter(q => where?.id ? where.id.in.includes(q.id) : membership.includes(q.id)).slice().sort((a, b) => a.order - b.order || a.id.localeCompare(b.id)));
  db.examQuestionSelection.findMany.mockImplementation(() => membership.map(questionId => ({ questionId })));
  db.examQuestionSelection.deleteMany.mockImplementation(() => { membership = []; });
  db.examQuestionSelection.createMany.mockImplementation(({ data }) => { membership = data.map((m: any) => m.questionId); });
  db.examContentRevision.findFirst.mockImplementation(() => revisions.at(-1) ?? null);
  db.examContentRevision.create.mockImplementation(({ data }) => {
    const rev = { id: `revision-${revisions.length}`, publishedAt: new Date(), _count: { questions: data.questions.create.length }, questions: data.questions.create.map((q: any) => ({ ...q, content: structuredClone(q.content) })), media: data.media.create };
    revisions.push(rev); return rev;
  });
  db.examContentRevision.findUnique.mockImplementation(({ where }) => revisions.find(r => r.id === where.id) ?? null);
  db.applicantAnswer.count.mockResolvedValue(0); db.examRevisionQuestion.count.mockResolvedValue(0); db.examRevisionOption.count.mockResolvedValue(0);
  db.examQuestion.findUnique.mockImplementation(() => bank[0]);
});

describe("B2 explicit selection, publication and exact binding", () => {
  it("starts empty without creating membership or history", async () => {
    expect(await repo.getCurrent()).toEqual({ questionIds: [], questions: [], latestPublication: null });
    expect(db.examQuestionSelection.createMany).not.toHaveBeenCalled(); expect(db.examContentRevision.create).not.toHaveBeenCalled();
  });
  it.each([undefined, null, [], {}, { questionIds: [qid, qid.toUpperCase()] }, { questionIds: [4] }, { questionIds: ["unknown"] }, { questionIds: [], isComplete: true }])("rejects malformed/duplicate selections %#", async payload => {
    await expect(repo.replaceSelection(payload)).rejects.toThrow(); expect(db.$transaction).not.toHaveBeenCalled();
  });
  it("normalizes UUID aliases without allowing duplicate identities", () => expect(selectionIds({ questionIds: [qid.toUpperCase()] })).toEqual([qid]));
  it("rejects unknown existing IDs before selection writes", async () => {
    await expect(repo.replaceSelection({ questionIds: [mediaId] })).rejects.toThrow("no longer exist"); expect(db.examQuestionSelection.deleteMany).not.toHaveBeenCalled();
  });
  it("selects, deterministically orders and deselects without mutating content", async () => {
    const before = structuredClone(bank);
    expect((await repo.replaceSelection({ questionIds: [qid, otherId] })).questionIds).toEqual([otherId, qid]);
    expect((await repo.replaceSelection({ questionIds: [qid] })).questionIds).toEqual([qid]);
    expect((await repo.replaceSelection({ questionIds: [] })).questionIds).toEqual([]);
    expect(bank).toEqual(before); expect(db.examQuestion.update).not.toHaveBeenCalled();
  });
  it("breaks tied question orders by identity and freezes exact membership and all option identities", async () => {
    bank[1].order = 7; await repo.replaceSelection({ questionIds: [otherId, qid] });
    await repo.publish({ questionIds: [otherId, qid] }, "admin");
    expect(revisions[0].questions.map((q: any) => q.questionId)).toEqual([qid, otherId]);
    expect(revisions[0].questions[0].options.create).toEqual(bank[0].options.map((o: any) => ({ optionId: o.id })));
    expect(db.$transaction).toHaveBeenLastCalledWith(expect.any(Function), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  });
  it("rejects empty publication and a stale expected selection", async () => {
    await expect(repo.publish({ questionIds: [] }, "admin")).rejects.toThrow("Select and save");
    membership = [qid]; await expect(repo.publish({ questionIds: [otherId] }, "admin")).rejects.toThrow("selection changed"); expect(revisions).toHaveLength(0);
  });
  it("does not publish missing or invalid content", async () => {
    membership = [mediaId]; await expect(repo.publish({ questionIds: membership }, "admin")).rejects.toThrow("content changed");
    membership = [qid]; bank[0].options[1].isCorrect = true;
    await expect(repo.publish({ questionIds: membership }, "admin")).rejects.toThrow(); expect(revisions).toHaveLength(0);
  });
  it("old content/key/order/media/emphasis remains unchanged after source edits, deselection and later publication", async () => {
    bank[0].stimulusType = "IMAGE"; bank[0].stimulusMediaId = mediaId;
    membership = [qid]; const first = await repo.publish({ questionIds: membership }, "admin");
    const before = await repo.getForBinding(first.id);
    bank[0].questionText = "Different text"; bank[0].questionTextEmphasis = null;
    bank[0].options[0].isCorrect = false; bank[0].options[1].isCorrect = true;
    bank[0].options[0].optionText = "Edited"; bank[0].options[0].order = 50;
    bank[0].options.reverse(); bank[0].order = 22; bank[0].stimulusType = "NONE"; bank[0].stimulusMediaId = null;
    await repo.replaceSelection({ questionIds: [otherId] }); const second = await repo.publish({ questionIds: [otherId] }, "admin");
    expect(await repo.getForBinding(first.id)).toEqual(before);
    expect((await repo.getForBinding(second.id)).questions.map(q => q.id)).toEqual([otherId]);
    expect(before.answerKey[0].correctOptionIds).toEqual([`${qid.slice(0, -1)}1`]); expect(before.mediaIds).toEqual([mediaId]);
    expect(JSON.stringify(before.applicantQuestions)).not.toMatch(/isCorrect|correctOption|storageKey|checksum|sourceImport|publishedBy|position/);
    expect(before.applicantQuestions[0].questionTextEmphasis).toEqual(setQuestion().questionTextEmphasis);
    expect(before.applicantQuestions[0].options.map(o => [o.id, o.label, o.order])).toEqual(setQuestion().options.map(o => [o.id, o.label, o.order]));
  });
  it.each(["MATRIX", "GROUPED_NUMBER_ROWS", "NUMBER_SEQUENCE", "WORD_BANK", "ALPHANUMERIC_SEQUENCE", "WORD_SERIES", "LETTER_SEQUENCE", "LOGICAL_PREMISES"])("preserves generic %s structured content and emphasis", async type => {
    const structured = type === "MATRIX" ? { type, rows: [["alpha", "bravo"]] } : type === "GROUPED_NUMBER_ROWS" ? { type, groups: [["1", "2"]] } : { type, items: type === "NUMBER_SEQUENCE" ? ["1", "2"] : type === "LETTER_SEQUENCE" ? ["A", "B"] : ["alpha", "bravo"] };
    bank[0].stimulusType = "STRUCTURED"; bank[0].structuredStimulus = structured;
    const marks = [{ index: 0, ...(type === "MATRIX" || type === "GROUPED_NUMBER_ROWS" ? { row: 0, column: 0 } : {}), spans: [{ start: 0, end: 1, style: "BOLD" }] }];
    // Cell layouts use row/column addresses rather than item indexes.
    bank[0].structuredStimulusEmphasis = type === "MATRIX" || type === "GROUPED_NUMBER_ROWS" || type === "NUMBER_SEQUENCE" ? null : marks;
    membership = [qid]; const pub = await repo.publish({ questionIds: membership }, "admin");
    const safe = (await repo.getForBinding(pub.id)).applicantQuestions[0];
    expect(safe.structuredStimulus).toEqual(structured); expect(safe.structuredStimulusEmphasis).toEqual(bank[0].structuredStimulusEmphasis);
    expect(JSON.stringify(safe)).not.toContain("isCorrect");
  });
  it("preserves image option IDs without storage/key leakage", async () => {
    bank[0].options[0].mediaId = mediaId; bank[0].options[0].optionText = null; bank[0].options[0].optionTextEmphasis = null;
    bank[0].storageKey = "secret"; bank[0].sourceImportId = "secret";
    membership = [qid]; const pub = await repo.publish({ questionIds: membership }, "admin");
    expect((await repo.getForBinding(pub.id)).applicantQuestions[0].options[0]).toMatchObject({ mediaId, label: "F", optionText: null });
    expect(JSON.stringify(revisions)).not.toContain("secret");
  });
  it("resolves exact revisions only and fails for a missing identity", async () => { await expect(repo.getForBinding("missing")).rejects.toThrow("not found"); });
  it("preserves a synthetic essay without inventing options or key authority", async () => {
    bank[0] = { ...bank[0], type: "ESSAY", options: [] }; membership = [qid];
    const publication = await repo.publish({ questionIds: membership }, "admin");
    const revision = await repo.getForBinding(publication.id);
    expect(revision.applicantQuestions[0]).toMatchObject({ id: qid, type: "ESSAY", options: [] });
    expect(revision.answerKey[0].correctOptionIds).toEqual([]);
  });
  it("retains tied legacy option order and manual labels exactly", async () => {
    bank[0].options[1].order = bank[0].options[0].order; membership = [qid];
    const publication = await repo.publish({ questionIds: membership }, "admin");
    expect((await repo.getForBinding(publication.id)).applicantQuestions[0].options.map(o => [o.label, o.order])).toEqual([["F", 2], ["K", 2]]);
  });
  it("intentionally leaves live Applicant question reads on the entire legacy bank despite selection/publication", async () => {
    membership = [qid]; await repo.publish({ questionIds: membership }, "admin");
    await repo.replaceSelection({ questionIds: [] }); db.examQuestion.findMany.mockResolvedValue(bank);
    const questions = await new ExamEngineRepository().getQuestionsForApplicant();
    expect(questions.map(q => q.id)).toEqual(bank.map(q => q.id));
    expect(db.examQuestion.findMany).toHaveBeenLastCalledWith({ orderBy: [{ order: "asc" }, { id: "asc" }], select: applicantQuestionSelect });
    expect(db.examContentRevision.findUnique).not.toHaveBeenCalled();
  });
  it("contains transaction conflicts without leaking database details", async () => {
    db.$transaction.mockRejectedValue(new Prisma.PrismaClientKnownRequestError("secret", { code: "P2034", clientVersion: "test" }));
    await expect(repo.replaceSelection({ questionIds: [] })).rejects.toMatchObject({ statusCode: 409 });
  });
});

describe("B2 destructive history guards", () => {
  const engine = new ExamEngineRepository();
  it("blocks question deletion with ApplicantAnswer history", async () => {
    db.applicantAnswer.count.mockResolvedValue(1); await expect(engine.deleteQuestion(qid)).rejects.toMatchObject({ statusCode: 409 }); expect(db.examQuestion.delete).not.toHaveBeenCalled();
  });
  it("blocks revision-linked question deletion and allows unrelated unused questions", async () => {
    db.examRevisionQuestion.count.mockResolvedValue(1); await expect(engine.deleteQuestion(qid)).rejects.toThrow("Deselect");
    db.examRevisionQuestion.count.mockResolvedValue(0); await engine.deleteQuestion(qid); expect(db.examQuestion.delete).toHaveBeenCalledWith({ where: { id: qid } });
  });
  it("blocks removal of published options while preserving the ApplicantAnswer guard", async () => {
    db.examRevisionOption.count.mockResolvedValue(1);
    await expect(engine.updateQuestion(qid, { options: bank[0].options.map(({ id: _id, questionId: _qid, ...o }: any) => o) })).rejects.toThrow("published question set");
    expect(db.examOption.deleteMany).not.toHaveBeenCalled();
  });
});
