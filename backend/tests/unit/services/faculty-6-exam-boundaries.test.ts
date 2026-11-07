import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Readable } from "node:stream";
import { executionApplication, executionIds as ids } from "../../fixtures/exam-execution";
import { qid, mediaId } from "../../fixtures/exam-question-set";
import { EXAM_PNG } from "../../fixtures/exam-images";
import { calculateSha256 } from "../../../src/utils/checksum";
const state = vi.hoisted(() => ({ actor: null as any, revokeAtTransaction: false, target: vi.fn() }));
const db = vi.hoisted(() => {
  const target = () => vi.fn(async () => { state.target(); throw new Error("DOMAIN_BOUNDARY"); });
  return { $transaction: vi.fn(), $queryRaw: vi.fn(), user: { findUnique: vi.fn() },
    student: { findUnique: target() }, examSlot: { findUnique: target(), findMany: target(), create: target() },
    entranceExamApplication: { findUnique: target(), findMany: target(), count: target(), update: vi.fn() },
    examQuestion: { findUnique: target(), findMany: target(), create: target() },
    applicantAnswer: { count: target() }, examQuestionSelection: { findMany: target() },
    systemSetting: { findUnique: target(), upsert: target() },
  };
});
vi.mock("../../../src/config/database", () => ({ default: db }));
vi.mock("../../../src/services/email.service", () => ({ EmailService: { sendTemplateEmail: vi.fn() } }));
import { ExamAdministrationAuthorization } from "../../../src/access/exam-administration-authorization";
import { ExamService } from "../../../src/services/exam.service";
import { ExamEngineService } from "../../../src/services/exam-engine.service";
import { ExamConfigurationService } from "../../../src/services/exam-configuration.service";
import { ExamMediaService } from "../../../src/services/exam-media.service";
import { ExamRepository } from "../../../src/repositories/exam.repository";
import { ExamAmendmentRepository } from "../../../src/repositories/exam-amendment.repository";
import { ExamExecutionRepository } from "../../../src/repositories/exam-execution.repository";
import { ExamEngineRepository } from "../../../src/repositories/exam-engine.repository";
import { ExamQuestionSetRepository } from "../../../src/repositories/exam-question-set.repository";
import { resolveConfiguredAccountAccess } from "../../../src/access/account-access";
const access = new ExamAdministrationAuthorization(true, async () => state.actor);
const exam = new ExamService(access), bank = new ExamEngineService(access), execution = new ExamExecutionRepository(access);
const amendments = new ExamAmendmentRepository(access), sets = new ExamQuestionSetRepository(access);
const config = new ExamConfigurationService(access), results = new ExamRepository(access), content = new ExamEngineRepository(access);
const slot = { programId: ids.program, examDate: "2026-11-09", examTime: "1970-01-01T16:00:00.000Z", maxSlots: 2 };
const question = { questionText: "Essay", type: "ESSAY", options: [] };
const configBody = { examDurationMinutes: 120, mcqPointsPerCorrectItem: 2, essayMaximumScore: 25, passingThreshold: 75 };
function grant(keys: string[]) {
  state.actor = { id: ids.admin, email: "synthetic@example.test", role: "ADMIN", isActive: true, mustChangePassword: false,
    panelist: null, administratorAccess: { level: "RESTRICTED" }, capabilityGrants: keys.map(capabilityKey => ({ capabilityKey })) };
}
beforeEach(() => {
  vi.clearAllMocks(); grant([]); state.revokeAtTransaction = false;
  db.$transaction.mockImplementation(async fn => { if (state.revokeAtTransaction) grant([]); return fn(db); });
  db.$queryRaw.mockResolvedValue([{ id: 1 }]); db.user.findUnique.mockImplementation(async () => state.actor);
});
afterEach(() => vi.useRealTimers());
const transactional = [
  ["assignment", "exam.schedules.manage", () => exam.assignApplicant(ids.student, ids.slot, ids.admin)],
  ["slot edit", "exam.schedules.manage", () => exam.updateSlot(ids.slot, slot, ids.admin)],
  ["slot status", "exam.schedules.manage", () => exam.toggleSlotStatus(ids.slot, false, ids.admin)],
  ["Start Now", "exam.starts.authorize", () => execution.authorize(ids.admin, ids.app)],
  ["appeal approve", "exam.schedules.manage", () => amendments.amend(ids.app, "APPROVE_APPEAL", { reason: "Review", targetSlotId: ids.slot }, ids.admin)],
  ["appeal reject", "exam.schedules.manage", () => amendments.amend(ids.app, "REJECT_APPEAL", { reason: "Review" }, ids.admin)],
  ["reschedule", "exam.schedules.manage", () => amendments.amend(ids.app, "ADMIN_RESCHEDULE", { reason: "Review", targetSlotId: ids.slot }, ids.admin)],
  ["cancellation", "exam.schedules.manage", () => amendments.amend(ids.app, "ADMIN_CANCELLATION", { reason: "Review" }, ids.admin)],
  ["finalization", "exam.results.finalize", () => results.finalizeResult(ids.app, ids.admin)],
  ["reconsideration", "exam.results.reconsider", () => amendments.reconsider(ids.app, { reason: "Review" }, ids.admin)],
  ["question edit", "exam.questions.manage", () => content.updateQuestion(qid, {}, ids.admin)],
  ["question deletion", "exam.questions.manage", () => content.deleteQuestion(qid, ids.admin)],
  ["question selection", "exam.questions.manage", () => sets.replaceSelection({ questionIds: [] }, ids.admin)],
  ["publication", "exam.questions.manage", () => sets.publish({ questionIds: [] }, ids.admin)],
] as const;
const entries = [
  ...transactional,
  ["slot creation", "exam.schedules.manage", () => exam.createSlot(slot, ids.admin)],
  ["slot list", "exam.schedules.view", () => exam.getAllSlots(ids.admin)],
  ["bookings", "exam.schedules.view", () => exam.getSlotBookings(ids.slot, ids.admin)],
  ["assignment context", "exam.schedules.view", () => exam.getAssignmentOptions(ids.student, ids.admin)],
  ["records", "exam.records.view", () => exam.getAllApplications(ids.admin)],
  ["record detail", "exam.records.view", () => exam.getApplicationDetail(ids.app, ids.admin)],
  ["appeals", "exam.schedules.view", () => exam.getAppealedExams(ids.admin)],
  ["legacy approve", "exam.schedules.manage", () => exam.approveAppeal(ids.app, ids.admin)],
  ["legacy reject", "exam.schedules.manage", () => exam.rejectAppeal(ids.app, ids.admin)],
  ["execution read", "exam.records.view", () => execution.adminRead(ids.app, ids.admin)],
  ["bank read", "exam.questions.view", () => bank.getAllQuestionsForAdmin(ids.admin)],
  ["question creation", "exam.questions.manage", () => bank.createQuestion(question, ids.admin)],
  ["bank service edit", "exam.questions.manage", () => bank.updateQuestion(qid, {}, ids.admin)],
  ["bank service delete", "exam.questions.manage", () => bank.deleteQuestion(qid, ids.admin)],
  ["question-set read", "exam.questions.view", () => sets.getCurrent(ids.admin)],
  ["configuration read", "exam.configuration.manage", () => config.getCurrent(ids.admin)],
  ["configuration replacement", "exam.configuration.manage", () => config.replaceCurrent(configBody, ids.admin)],
] as const;
describe("FACULTY-6 real business boundaries", () => {
  it.each(entries)("%s denies unrelated capabilities before target work", async (_name, _key, operation) => {
    grant(["students.view"]);
    await expect(operation()).rejects.toMatchObject({ statusCode: 403 }); expect(state.target).not.toHaveBeenCalled();
    expect(db.entranceExamApplication.update).not.toHaveBeenCalled();
  });
  it.each(transactional)("%s revalidates a revoked actor inside the existing transaction", async (_name, key, operation) => {
    grant([key]); await access.assert(ids.admin, key); state.revokeAtTransaction = true;
    await expect(operation()).rejects.toMatchObject({ statusCode: 403 }); expect(state.target).not.toHaveBeenCalled();
    expect(db.$queryRaw.mock.calls[0][0].join("?")).toContain("administrator_access_lock");
  });
  it.each(transactional)("%s allows its exact key before retaining domain authority", async (_name, key, operation) => {
    grant([key]);
    await expect(operation()).rejects.toThrow("DOMAIN_BOUNDARY"); expect(state.target).toHaveBeenCalled();
    expect(db.$queryRaw.mock.calls[0][0].join("?")).toContain("administrator_access_lock");
    expect(db.user.findUnique.mock.calls[0][0]).toMatchObject({ where: { id: ids.admin }, select: { mustChangePassword: true, capabilityGrants: { select: { capabilityKey: true } } } });
  });
  it("scheduling access cannot authorize the Applicant registry", () => {
    grant(["exam.schedules.manage"]);
    expect(resolveConfiguredAccountAccess(state.actor).capabilities).not.toContain("applicants.view");
  });
  it("excludes direct legacy grading and result-email business paths even for Full", async () => {
    state.actor.administratorAccess = { level: "FULL" };
    for (const operation of [() => exam.gradeEssay(ids.app, 1, ids.admin), () => exam.confirmResultAndEmail(ids.app, ids.admin),
      () => results.gradeEssay(ids.app, 1, ids.admin), () => results.queueResultEmail(ids.app, vi.fn())]) {
      await expect(operation()).rejects.toMatchObject({ statusCode: 403 });
    }
    expect(db.$transaction).not.toHaveBeenCalled(); expect(state.target).not.toHaveBeenCalled();
  });
  it("Start Now with its exact grant keeps Student/Slot/Application ordering and does not start the timer", async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-02T23:00:00Z"));
    grant(["exam.starts.authorize"]); const app = executionApplication();
    db.entranceExamApplication.findUnique.mockImplementation(async () => app);
    db.entranceExamApplication.count.mockResolvedValue(1);
    db.entranceExamApplication.update.mockImplementation(async ({ data }) => { Object.assign(app, data); return app; });
    await execution.authorize(ids.admin, ids.app);
    expect(app).toMatchObject({ actualStartedAt: null, deadlineAt: null, contentRevisionId: null, startAuthorizedById: ids.admin, startAuthorizedAt: new Date("2026-11-02T23:00:00Z") });
    expect(db.$queryRaw.mock.calls.map(([sql]) => sql.join("?"))).toEqual([
      expect.stringContaining("administrator_access_lock"), expect.stringContaining("FROM users"),
      expect.stringContaining("FROM students"), expect.stringContaining("FROM exam_slots"), expect.stringContaining("FROM entrance_exam_applications"),
    ]);
  });
});

describe("FACULTY-6 exact private media and upload boundary", () => {
  function media() {
    const record = { storageKey: "exam-media/synthetic.png", storageProvider: "synthetic", verifiedMimeType: "image/png", sizeBytes: EXAM_PNG.length, checksum: calculateSha256(EXAM_PNG), checksumAlgorithm: "sha256" };
    const repo = { findForAdmin: vi.fn(async () => record), findForApplicant: vi.fn(async () => record), create: vi.fn() };
    const provider = { name: "synthetic", stat: vi.fn(async () => ({ sizeBytes: EXAM_PNG.length })), openRead: vi.fn(async () => Readable.from([EXAM_PNG])), resolveStorageKeyReadPath: vi.fn() };
    const applicant = { assertApplicantQuestionAccess: vi.fn(async () => ids.revision) };
    const service = new ExamMediaService(repo as never, provider as never, applicant, access);
    return { service, repo, provider, applicant };
  }
  it("denies direct upload before file validation, persistence or storage work", async () => {
    grant(["exam.questions.view"]); const f = media();
    await expect(f.service.registerPromotedImage({} as never, ids.admin)).rejects.toMatchObject({ statusCode: 403 });
    expect(f.repo.create).not.toHaveBeenCalled(); expect(f.provider.resolveStorageKeyReadPath).not.toHaveBeenCalled();
  });
  it("requires question-bank read for Admin bytes, independently of record access", async () => {
    const f = media(); grant(["exam.records.view"]);
    await expect(f.service.getContent(mediaId, { userId: ids.admin, role: "ADMIN" })).rejects.toMatchObject({ statusCode: 403 });
    expect(f.repo.findForAdmin).not.toHaveBeenCalled(); grant(["exam.questions.view"]);
    expect((await f.service.getContent(mediaId, { userId: ids.admin, role: "ADMIN" })).bytes).toEqual(EXAM_PNG);
  });
  it("uses current Applicant identity and exact bound revision even when supplied role says ADMIN", async () => {
    const f = media(); state.actor.role = "APPLICANT"; state.actor.administratorAccess = null;
    await f.service.getContent(mediaId, { userId: ids.admin, role: "ADMIN" }, ids.app);
    expect(f.applicant.assertApplicantQuestionAccess).toHaveBeenCalledWith(ids.admin, ids.app, mediaId);
    expect(f.repo.findForApplicant).toHaveBeenCalledWith(mediaId, ids.revision); expect(f.repo.findForAdmin).not.toHaveBeenCalled();
    f.applicant.assertApplicantQuestionAccess.mockRejectedValue(new Error("foreign/expired/unbound"));
    await expect(f.service.getContent(mediaId, { userId: ids.admin, role: "APPLICANT" }, "other")).rejects.toMatchObject({ statusCode: 404 });
  });
});
