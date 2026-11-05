import { beforeEach, describe, expect, it, vi } from "vitest";
const db = vi.hoisted(() => ({ $transaction: vi.fn(), $queryRaw: vi.fn(), bound: vi.fn(),
  entranceExamApplication: { findUnique: vi.fn() }, applicantAnswer: { findUnique: vi.fn(), upsert: vi.fn() } }));
vi.mock("../../../src/config/database", () => ({ default: db }));
vi.mock("../../../src/repositories/exam-execution.repository", () => ({ activeBoundExecution: db.bound }));
import { ExamEngineRepository } from "../../../src/repositories/exam-engine.repository";
const id = "11111111-1111-4111-8111-111111111111", essay = "33333333-3333-4333-8333-333333333333";
const repo = new ExamEngineRepository();
beforeEach(() => {
  vi.resetAllMocks(); db.$transaction.mockImplementation(fn => fn(db));
  db.$queryRaw.mockResolvedValue([{ status: "PENDING" }]);
  db.entranceExamApplication.findUnique.mockResolvedValue({ student: { userId: "u" } });
  db.applicantAnswer.findUnique.mockResolvedValue(null);
  db.bound.mockResolvedValue({ app: { student: { userId: "u" } }, assertTime: vi.fn(), content: { questions: [{ id: essay, type: "ESSAY", options: [] }] } });
});
describe("B0A/B5 application locking preserved by B6", () => {
  it.each(["PENDING", "APPROVED"])("admits %s under exact current application lock", async status => {
    db.$queryRaw.mockResolvedValue([{ status }]); await repo.autoSaveAnswer(id, essay, "", 0, "u");
    const [sql, applicationId] = db.$queryRaw.mock.calls[0]; expect(sql.join("?")).toMatch(/SELECT status FROM entrance_exam_applications\s+WHERE application_id = \? FOR UPDATE/); expect(applicationId).toBe(id);
    expect(db.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(db.bound.mock.invocationCallOrder[0]);
    expect(db.applicantAnswer.upsert.mock.calls[0][0].create).toMatchObject({ essayAnswer: "", selectedOptionId: null, draftRevision: 1 });
  });
  it.each(["TAKEN", "PASSED", "FAILED", "APPEALED", "DISQUALIFIED", "UNKNOWN"])("rejects terminal %s before any draft write", async status => {
    db.$queryRaw.mockResolvedValue([{ status }]); await expect(repo.autoSaveAnswer(id, essay, "late", 0, "u")).rejects.toMatchObject({ statusCode: 409 });
    expect(db.bound).not.toHaveBeenCalled(); expect(db.applicantAnswer.upsert).not.toHaveBeenCalled();
  });
  it("missing application fails before writes", async () => { db.$queryRaw.mockResolvedValue([]); await expect(repo.autoSaveAnswer(id, essay, "x", 0, "u")).rejects.toMatchObject({ statusCode: 404 }); expect(db.applicantAnswer.upsert).not.toHaveBeenCalled(); });
});
