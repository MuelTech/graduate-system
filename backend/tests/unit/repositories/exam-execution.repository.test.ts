import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { executionApplication, executionRevision, executionIds as ids, configuration } from "../../fixtures/exam-execution";
import { qid, mediaId } from "../../fixtures/exam-question-set";
const db = vi.hoisted(() => ({ $transaction: vi.fn(), $queryRaw: vi.fn(),
  student: { findUnique: vi.fn() }, user: { findUnique: vi.fn() },
  entranceExamApplication: { findUnique: vi.fn(), findMany: vi.fn(), findFirst: vi.fn(), count: vi.fn(), update: vi.fn() },
  systemSetting: { findUnique: vi.fn() }, examContentRevision: { findFirst: vi.fn(), findUnique: vi.fn() },
}));
vi.mock("../../../src/config/database", () => ({ default: db }));
import { ExamExecutionRepository, activeBoundExecution } from "../../../src/repositories/exam-execution.repository";
let app: any;
const repo = new ExamExecutionRepository();
beforeEach(() => {
  vi.resetAllMocks(); vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-03T02:17:00Z")); app = executionApplication();
  db.$transaction.mockImplementation((fn: any) => fn(db)); db.$queryRaw.mockResolvedValue([{}]);
  db.entranceExamApplication.findUnique.mockImplementation(async () => app);
  db.entranceExamApplication.update.mockImplementation(async ({ data }) => { Object.assign(app, data); return app; });
  db.entranceExamApplication.count.mockResolvedValue(1); db.user.findUnique.mockResolvedValue({ role: "ADMIN", isActive: true });
  db.systemSetting.findUnique.mockResolvedValue({ settingType: "JSON", settingValue: JSON.stringify(configuration) });
  db.examContentRevision.findFirst.mockResolvedValue({ id: ids.revision }); db.examContentRevision.findUnique.mockResolvedValue(executionRevision(ids.revision, true));
  db.student.findUnique.mockResolvedValue({ id: ids.student }); db.entranceExamApplication.findMany.mockResolvedValue([{ id: ids.app }]);
});
afterEach(() => vi.useRealTimers());

describe("B4 exact server-owned execution", () => {
  it.each([0, 2])("B7 independently rejects a historical latest revision with %s essays before new start authority", async count => {
    const revision = executionRevision(ids.revision, true);
    if (count === 0) revision.questions.pop();
    else revision.questions.push({ ...revision.questions[1], questionId: ids.admin, position: 2, content: { ...revision.questions[1].content, id: ids.admin } });
    db.examContentRevision.findUnique.mockResolvedValue(revision);
    await expect(repo.start(ids.user, ids.app)).rejects.toMatchObject({ statusCode: 409, message: expect.stringContaining("exactly one essay") });
    expect(db.entranceExamApplication.update).not.toHaveBeenCalled(); expect(app.actualStartedAt).toBeNull();
  });
  it("starts normally after schedule, records actual server instant and full configured duration", async () => {
    const result = await repo.start(ids.user, ids.app);
    expect(result).toMatchObject({ state: "ACTIVE", actualStartedAt: "2026-11-03T02:17:00.000Z", deadlineAt: "2026-11-03T04:17:00.000Z", remainingSeconds: 7200, contentRevisionId: ids.revision });
    expect(app.executionConfiguration).toEqual({ ...configuration, timezone: "Asia/Manila", passingThresholdUnit: "PERCENT" });
    expect(db.$transaction.mock.calls[0][1]).toEqual({ isolationLevel: "ReadCommitted" });
    expect(db.$queryRaw.mock.calls.map(call => String(call[0]))).toEqual([expect.stringContaining("FROM students"), expect.stringContaining("FROM exam_slots"), expect.stringContaining("FROM entrance_exam_applications")]);
  });
  it("allows same-day late start without inventing a new cutoff or school-closing cap", async () => {
    vi.setSystemTime(new Date("2026-11-03T15:50:00Z"));
    const result = await repo.start(ids.user, ids.app);
    expect(result.deadlineAt).toBe("2026-11-03T17:50:00.000Z");
  });
  it("early same-day rejects without authorization; authorizing records actor/time without starting the timer", async () => {
    vi.setSystemTime(new Date("2026-11-02T23:00:00Z"));
    await expect(repo.start(ids.user, ids.app)).rejects.toMatchObject({ statusCode: 409 });
    await repo.authorize(ids.admin, ids.app);
    expect(app).toMatchObject({ startAuthorizedById: ids.admin, startAuthorizedAt: new Date("2026-11-02T23:00:00Z"), actualStartedAt: null, deadlineAt: null, contentRevisionId: null });
    expect((await repo.start(ids.user, ids.app)).state).toBe("ACTIVE");
  });
  it("late authorization retains original appointment and never starts time", async () => {
    const before = JSON.stringify(app.slot);
    await repo.authorize(ids.admin, ids.app); vi.advanceTimersByTime(1000); await repo.authorize(ids.admin, ids.app);
    expect(app.startAuthorizedAt.toISOString()).toBe("2026-11-03T02:17:00.000Z"); expect(app.actualStartedAt).toBeNull(); expect(JSON.stringify(app.slot)).toBe(before);
  });
  it.each(["APPLICANT", "STUDENT", "PANELIST", "CUSTOM"])("rejects %s authorization at the repository boundary", async role => {
    db.user.findUnique.mockResolvedValue({ role, isActive: true });
    await expect(repo.authorize(ids.admin, ids.app)).rejects.toMatchObject({ statusCode: 403 }); expect(db.entranceExamApplication.update).not.toHaveBeenCalled();
  });
  it.each(["2026-11-02T10:00:00Z", "2026-11-03T16:00:00Z"])("cross-date start and authorization reject at %s", async now => {
    vi.setSystemTime(new Date(now));
    await expect(repo.start(ids.user, ids.app)).rejects.toMatchObject({ statusCode: 409 });
    await expect(repo.authorize(ids.admin, ids.app)).rejects.toMatchObject({ statusCode: 409 });
  });
  it.each(["TAKEN", "PASSED", "FAILED", "APPEALED", "DISQUALIFIED"])("rejects incompatible %s start and authorization", async status => {
    app.status = status;
    await expect(repo.start(ids.user, ids.app)).rejects.toMatchObject({ statusCode: 409 });
    await expect(repo.authorize(ids.admin, ids.app)).rejects.toMatchObject({ statusCode: 409 });
    expect((await repo.read(ids.user, ids.app)).state).toBe("LEGACY_UNBOUND");
  });
  it("rejects another Applicant's exact application and missing records", async () => {
    await expect(repo.start(ids.admin, ids.app)).rejects.toMatchObject({ statusCode: 404 });
    db.entranceExamApplication.findUnique.mockResolvedValue(null); await expect(repo.authorize(ids.admin, ids.app)).rejects.toMatchObject({ statusCode: 404 });
    expect(db.entranceExamApplication.update).not.toHaveBeenCalled();
  });
  it.each(["", "bad", "1 OR 1", [ids.app], null])("rejects malformed identity %#", async id => {
    await expect(repo.start(ids.user, id as string)).rejects.toMatchObject({ statusCode: 400 }); expect(db.$transaction).not.toHaveBeenCalled();
  });
  it.each([null, 0, -1, 1.5, "120", 1e15])("rejects missing/invalid duration %#", async duration => {
    db.systemSetting.findUnique.mockResolvedValue({ settingType: "JSON", settingValue: JSON.stringify({ ...configuration, examDurationMinutes: duration }) });
    await expect(repo.start(ids.user, ids.app)).rejects.toThrow(); expect(app.actualStartedAt).toBeNull();
  });
  it("rejects absent configuration, missing publication and invalid/empty published content", async () => {
    db.systemSetting.findUnique.mockResolvedValueOnce(null); await expect(repo.start(ids.user, ids.app)).rejects.toMatchObject({ statusCode: 409 });
    db.examContentRevision.findFirst.mockResolvedValueOnce(null); await expect(repo.start(ids.user, ids.app)).rejects.toMatchObject({ statusCode: 409 });
    db.examContentRevision.findUnique.mockResolvedValueOnce({ ...executionRevision(ids.revision, true), questions: [] }); await expect(repo.start(ids.user, ids.app)).rejects.toMatchObject({ statusCode: 409 });
    db.examContentRevision.findUnique.mockResolvedValueOnce({ ...executionRevision(ids.revision, true), questions: [{ questionId: qid, content: { bad: true } }] }); await expect(repo.start(ids.user, ids.app)).rejects.toThrow();
    expect(app.actualStartedAt).toBeNull();
  });
  it.each(["program", "alignment", "role", "inactive", "admission", "pinnacle", "slot", "copy", "counter", "capacity"])("retains the %s guard", async guard => {
    if (guard === "program") app.student.programId = ids.admin;
    if (guard === "alignment") app.student.alignmentStatus = "PENDING_WAIVER";
    if (guard === "role") app.student.user.role = "STUDENT";
    if (guard === "inactive") app.student.user.isActive = false;
    if (guard === "admission") app.student.admissionStatus = "ENROLLED";
    if (guard === "pinnacle") app.student.pinnacleApplicantId = "";
    if (guard === "slot") app.slot.isActive = false;
    if (guard === "copy") app.examTime = new Date("1970-01-01T08:00:00Z");
    if (guard === "counter") db.entranceExamApplication.count.mockResolvedValue(2);
    if (guard === "capacity") app.slot.maxSlots = 0;
    await expect(repo.start(ids.user, ids.app)).rejects.toThrow(); await expect(repo.authorize(ids.admin, ids.app)).rejects.toThrow();
  });
  it("repeated start, refresh and a fresh repository instance preserve timestamps/config/content", async () => {
    const first = await repo.start(ids.user, ids.app); vi.advanceTimersByTime(61_000);
    db.systemSetting.findUnique.mockRejectedValue(new Error("must not read changed config")); db.examContentRevision.findFirst.mockRejectedValue(new Error("must not pick latest again"));
    const second = await new ExamExecutionRepository().start(ids.user, ids.app);
    expect(second.actualStartedAt).toBe(first.actualStartedAt); expect(second.deadlineAt).toBe(first.deadlineAt); expect(second.contentRevisionId).toBe(first.contentRevisionId); expect(second.remainingSeconds).toBe(7139);
    expect((await repo.read(ids.user, ids.app)).deadlineAt).toBe(first.deadlineAt); expect(db.entranceExamApplication.update).toHaveBeenCalledTimes(1);
    await expect(repo.authorize(ids.admin, ids.app)).rejects.toMatchObject({ statusCode: 409 });
  });
  it("question and media reads require the exact active binding and project no key", async () => {
    await expect(repo.questions(ids.user, ids.app)).rejects.toThrow(); await expect(repo.media(ids.user, ids.app, mediaId)).rejects.toThrow();
    await repo.start(ids.user, ids.app);
    const questions = await repo.questions(ids.user, ids.app); expect(questions[0].id).toBe(qid); expect(JSON.stringify(questions)).not.toMatch(/isCorrect|answerKey|storage|sourceImport/);
    expect(await repo.media(ids.user, ids.app, mediaId)).toBe(ids.revision);
    await expect(repo.media(ids.user, ids.app, ids.admin)).rejects.toMatchObject({ statusCode: 404 });
    await expect(repo.questions(ids.admin, ids.app)).rejects.toMatchObject({ statusCode: 404 });
  });
  it("locks at the exact deadline without claiming finalization, including after midnight", async () => {
    vi.setSystemTime(new Date("2026-11-03T15:50:00Z")); const result = await repo.start(ids.user, ids.app);
    vi.setSystemTime(new Date("2026-11-03T16:30:00Z")); expect((await repo.read(ids.user, ids.app)).state).toBe("ACTIVE");
    vi.setSystemTime(new Date(result.deadlineAt!)); expect((await repo.read(ids.user, ids.app)).state).toBe("EXPIRED");
    await expect(activeBoundExecution(db as never, ids.app)).rejects.toMatchObject({ statusCode: 409 });
    await expect(repo.start(ids.user, ids.app)).rejects.toThrow(); expect(app.status).toBe("PENDING");
  });
  it("closing booking does not revoke an established execution or alter its deadline", async () => {
    const first = await repo.start(ids.user, ids.app); app.slot.isActive = false;
    expect((await repo.read(ids.user, ids.app)).state).toBe("ACTIVE");
    expect((await repo.start(ids.user, ids.app)).deadlineAt).toBe(first.deadlineAt);
    expect((await repo.questions(ids.user, ids.app))[0].id).toBe(qid);
  });
  it("does not retain the old one-minute early grace", async () => {
    vi.setSystemTime(new Date("2026-11-03T00:59:30Z"));
    await expect(repo.start(ids.user, ids.app)).rejects.toMatchObject({ statusCode: 409 });
  });
  it("never fabricates legacy bindings for existing answers or scores", async () => {
    app._count.answers = 1; expect((await repo.read(ids.user, ids.app)).state).toBe("LEGACY_UNBOUND");
    await expect(repo.start(ids.user, ids.app)).rejects.toThrow(); expect(app.actualStartedAt).toBeNull(); expect(app.contentRevisionId).toBeNull();
  });
  it("discovery fails closed for ambiguous records and returns null when no booking exists", async () => {
    db.entranceExamApplication.findMany.mockResolvedValueOnce([{ id: ids.app }, { id: ids.admin }]); await expect(repo.current(ids.user)).rejects.toMatchObject({ statusCode: 409 });
    db.entranceExamApplication.findMany.mockResolvedValueOnce([]); db.entranceExamApplication.findFirst.mockResolvedValue(null); expect(await repo.current(ids.user)).toBeNull();
  });
});
