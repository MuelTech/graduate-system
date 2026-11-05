import prisma from "../config/database";
import { Prisma } from "@prisma/client";
import { AppError } from "../utils/AppError";
import { ExamConfigurationRepository } from "./exam-configuration.repository";
import { ExamQuestionSetRepository } from "./exam-question-set.repository";
import { examConfigurationDto, validateExamConfiguration } from "../services/exam-configuration.rules";
import { BLOCKING_EXAM_STATUSES, requireConsistentCapacity, scheduleIdentifier } from "../services/exam-schedule.rules";
import { manilaCalendarDate, scheduleStartInstant } from "../services/exam-schedule-time";
import { finalizationReceipt } from "../services/exam-finalization.rules";
import { singleEssay } from "../services/exam-essay-evaluation.rules";

const include = {
  student: { include: { user: { select: { role: true, isActive: true } } } }, slot: true, program: true,
  score: { select: { id: true } }, _count: { select: { answers: true } },
  startAuthorizedBy: { select: { id: true, firstName: true, lastName: true } },
} satisfies Prisma.EntranceExamApplicationInclude;
type Application = Prisma.EntranceExamApplicationGetPayload<{ include: typeof include }>;
const writable = (status: string) => status === "PENDING" || status === "APPROVED";

export function validateExecutionIdentity(app: Application, requireActiveSlot = false) {
  if (app.seatReleasedAt != null) throw new AppError("This appointment's seat has been released. Reload the current examination record.",409);
  if (app.student.user.role !== "APPLICANT" || !app.student.user.isActive ||
      app.student.admissionStatus !== "APPLICANT" || !app.student.pinnacleApplicantId?.trim() ||
      !["ALIGNED", "CLEARED"].includes(app.student.alignmentStatus ?? "") ||
      app.student.programId !== app.programId || app.slot.programId !== app.programId) {
    throw new AppError("Applicant eligibility or Program no longer permits examination access.", 409);
  }
  // Booking closure cannot revoke an already established execution or its time.
  if (requireActiveSlot && !app.slot.isActive) throw new AppError("The assigned examination schedule is closed. Contact Graduate School staff.", 409);
  const scheduled = scheduleStartInstant(app.slot.examDate, app.slot.examTime);
  if (!app.examDate || !app.examTime || app.examDate.getTime() !== app.slot.examDate.getTime() || app.examTime.getTime() !== app.slot.examTime.getTime()) {
    throw new AppError("The application and original appointment disagree. Contact Graduate School staff.", 409);
  }
  return scheduled;
}

export function binding(app: Pick<Application, "actualStartedAt" | "deadlineAt" | "contentRevisionId" | "executionConfiguration">) {
  if (!app.actualStartedAt || !app.deadlineAt || !app.contentRevisionId || !app.executionConfiguration) {
    throw new AppError("No authoritative examination start is recorded. Start Examination first, or contact Graduate School staff for a legacy record.", 409);
  }
  const snapshot = app.executionConfiguration as Record<string, unknown>;
  const { timezone, passingThresholdUnit, ...values } = snapshot;
  const config = validateExamConfiguration(values);
  // Historical B4 attempts may retain the original null threshold/unit pair.
  // Timing, drafts, receipts and B7 reads must keep working for those records.
  if (timezone !== "Asia/Manila" ||
      !(passingThresholdUnit === "PERCENT" || (passingThresholdUnit === null && config.passingThreshold === null)) || !config.examDurationMinutes ||
      app.deadlineAt.getTime() !== app.actualStartedAt.getTime() + config.examDurationMinutes * 60_000) {
    throw new AppError("Examination timing authority is invalid. Contact Graduate School staff.", 409);
  }
  return config;
}

function requireTime(app: Application, now = new Date()) {
  if (!writable(app.status) || app.score) throw new AppError("This application cannot accept examination access or answer writes.", 409);
  binding(app);
  if (now.getTime() >= app.deadlineAt!.getTime()) throw new AppError("Your examination time has expired.", 409);
}

function requireNewStart(app: Application, now: Date, bypassScheduledTime = false) {
  if (!writable(app.status) || app.score) throw new AppError("This application cannot start an examination.", 409);
  if (app._count.answers > 0) throw new AppError("This legacy record has answers without a recorded start. Contact Graduate School staff.", 409);
  if (app.deadlineAt || app.contentRevisionId || app.executionConfiguration) throw new AppError("Incomplete examination authority requires staff review.", 409);
  const scheduled = validateExecutionIdentity(app, true);
  if (app.slot.examDate.toISOString().slice(0, 10) !== manilaCalendarDate(now)) {
    throw new AppError("Start is limited to the original appointment date. Contact Graduate School staff about a different-date appointment.", 409);
  }
  const authorized = !!app.startAuthorizedById && !!app.startAuthorizedAt && manilaCalendarDate(app.startAuthorizedAt) === manilaCalendarDate(now);
  if (now < scheduled && !authorized && !bypassScheduledTime) throw new AppError("Your scheduled start time has not arrived. Start Now authorization is required for early entry.", 409);
}

/** B4 persisted timing/content authority, also consumed by B6 after expiry. */
export async function startedBoundExecution(tx: Prisma.TransactionClient, applicationId: string) {
  const app = await tx.entranceExamApplication.findUnique({ where: { id: applicationId }, include });
  if (!app) throw new AppError("Exam application not found.", 404);
  binding(app);
  const content = await new ExamQuestionSetRepository().getForBinding(app.contentRevisionId!, tx);
  return { app, content };
}

/** Called inside the B0A application lock by every existing answer writer. */
export async function activeBoundExecution(tx: Prisma.TransactionClient, applicationId: string) {
  const { app, content } = await startedBoundExecution(tx, applicationId);
  validateExecutionIdentity(app);
  requireTime(app);
  return { app, content, assertTime: () => requireTime(app) };
}

export class ExamExecutionRepository {
  /** Discovery only: never chooses a different identity after a client pins one. */
  async current(userId: string) {
    const student = await prisma.student.findUnique({ where: { userId }, select: { id: true } });
    if (!student) throw new AppError("Student profile not found.", 404);
    const candidates = await prisma.entranceExamApplication.findMany({
      where: { studentId: student.id, status: { in: [...BLOCKING_EXAM_STATUSES] } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: { id: true }, take: 2,
    });
    if (candidates.length > 1) throw new AppError("Multiple examination records require Graduate School review.", 409);
    const app = candidates[0] ?? await prisma.entranceExamApplication.findFirst({ where: { studentId: student.id, status: { notIn: ["RESCHEDULED","CANCELLED"] } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { id: true } });
    return app ? this.read(userId, app.id) : null;
  }

  private async locked<T>(applicationId: string, userId: string | null, operation: (app: Application, tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    const id = scheduleIdentifier(applicationId, "applicationId");
    return prisma.$transaction(async tx => {
      // Preliminary read supplies lock identities only; all authority is reread.
      const target = await tx.entranceExamApplication.findUnique({ where: { id }, select: { studentId: true, slotId: true, student: { select: { userId: true } } } });
      if (!target || (userId !== null && target.student.userId !== userId)) throw new AppError("Exam application not found.", 404);
      await tx.$queryRaw`SELECT student_id FROM students WHERE student_id = ${target.studentId} FOR UPDATE`;
      await tx.$queryRaw`SELECT slot_id FROM exam_slots WHERE slot_id = ${target.slotId} FOR UPDATE`;
      await tx.$queryRaw`SELECT application_id FROM entrance_exam_applications WHERE application_id = ${id} FOR UPDATE`;
      const app = await tx.entranceExamApplication.findUnique({ where: { id }, include });
      if (!app || app.studentId !== target.studentId || app.slotId !== target.slotId || (userId !== null && app.student.userId !== userId)) throw new AppError("Exam application changed. Reload the record.", 409);
      return operation(app, tx);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
  }

  private dto(app: Application, now = new Date()) {
    let reason: string | null = null;
    let state: "READY" | "BLOCKED" | "ACTIVE" | "EXPIRED" | "TERMINAL" | "LEGACY_UNBOUND";
    const hasAuthority = !!(app.actualStartedAt || app.deadlineAt || app.contentRevisionId || app.executionConfiguration);
    if (!writable(app.status)) state = hasAuthority ? "TERMINAL" : "LEGACY_UNBOUND";
    else if (app.actualStartedAt) {
      try { validateExecutionIdentity(app); binding(app); if (app.score) throw new AppError("Examination assessment state requires staff review.", 409); state = now >= app.deadlineAt! ? "EXPIRED" : "ACTIVE"; }
      catch (error) { state = "BLOCKED"; reason = error instanceof AppError ? error.message : "Examination authority requires staff review."; }
    } else if (app._count.answers || app.score || hasAuthority) {
      state = "LEGACY_UNBOUND"; reason = "This record has no authoritative examination start. Contact Graduate School staff.";
    } else {
      try { requireNewStart(app, now); state = "READY"; }
      catch (error) { state = "BLOCKED"; reason = error instanceof AppError ? error.message : "Examination start is unavailable."; }
    }
    return {
      applicationId: app.id, applicationStatus: app.status, state, reason, canStart: state === "READY",
      serverNow: now.toISOString(), actualStartedAt: app.actualStartedAt?.toISOString() ?? null,
      deadlineAt: app.deadlineAt?.toISOString() ?? null,
      remainingSeconds: state === "ACTIVE" ? Math.max(0, Math.ceil((app.deadlineAt!.getTime() - now.getTime()) / 1000)) : 0,
      contentRevisionId: app.contentRevisionId,
      finalization: finalizationReceipt(app),
      durationMinutes: app.actualStartedAt && app.executionConfiguration ? (app.executionConfiguration as Record<string, unknown>).examDurationMinutes : null,
      authorization: app.startAuthorizedAt ? { authorizedAt: app.startAuthorizedAt.toISOString(), authorizedBy: app.startAuthorizedBy } : null,
      appointment: { examDate: app.slot.examDate.toISOString(), examTime: app.slot.examTime.toISOString(), programName: app.program.programName },
    };
  }

  read(userId: string, id: string) { return this.locked(id, userId, async app => this.dto(app)); }
  adminRead(id: string) { return this.locked(id, null, async app => {
    const dto = this.dto(app);
    let canAuthorize = false;
    try { requireNewStart(app, new Date(), true); canAuthorize = !app.actualStartedAt; } catch { /* fail closed */ }
    return { ...dto, canAuthorize };
  }); }

  authorize(adminId: string, id: string) {
    return this.locked(id, null, async (app, tx) => {
      const admin = await tx.user.findUnique({ where: { id: adminId }, select: { role: true, isActive: true } });
      if (admin?.role !== "ADMIN" || !admin.isActive) throw new AppError("Only an active Admin may authorize Start Now.", 403);
      if (app.actualStartedAt) throw new AppError("The Applicant has already started this examination.", 409);
      requireNewStart(app, new Date(), true);
      requireConsistentCapacity(app.slot, await tx.entranceExamApplication.count({ where: { slotId: app.slotId, seatReleasedAt: null } }));
      const now = new Date();
      requireNewStart(app, now, true); // Recheck Manila date immediately before writing.
      // Repeated authorization retains its original actor/time; never starts time.
      if (!app.startAuthorizedAt) await tx.entranceExamApplication.update({ where: { id: app.id }, data: { startAuthorizedById: adminId, startAuthorizedAt: now } });
      return this.dto((await tx.entranceExamApplication.findUnique({ where: { id: app.id }, include }))!);
    });
  }

  start(userId: string, id: string) {
    return this.locked(id, userId, async (app, tx) => {
      if (app.actualStartedAt) {
        validateExecutionIdentity(app); requireTime(app);
        await new ExamQuestionSetRepository().getForBinding(app.contentRevisionId!, tx);
        return this.dto(app);
      }
      requireNewStart(app, new Date());
      requireConsistentCapacity(app.slot, await tx.entranceExamApplication.count({ where: { slotId: app.slotId, seatReleasedAt: null } }));
      const config = await new ExamConfigurationRepository().getCurrent(tx);
      if (!examConfigurationDto(config).isComplete) throw new AppError("Complete Exam Configuration, including the passing percentage, before starting.", 409);
      if (!config.examDurationMinutes) throw new AppError("Configure a valid examination duration before starting.", 409);
      const revision = await tx.examContentRevision.findFirst({ orderBy: [{ publishedAt: "desc" }, { id: "desc" }], select: { id: true } });
      if (!revision) throw new AppError("Publish a valid Question Set before starting.", 409);
      const content = await new ExamQuestionSetRepository().getForBinding(revision.id, tx);
      singleEssay(content.questions);
      const actualStartedAt = new Date();
      requireNewStart(app, actualStartedAt); // Includes midnight/lock-wait boundary.
      const deadlineAt = new Date(actualStartedAt.getTime() + config.examDurationMinutes * 60_000);
      if (!Number.isFinite(deadlineAt.getTime()) || deadlineAt.getUTCFullYear() > 9999) throw new AppError("Configured duration exceeds supported deadline storage.", 409);
      const { isComplete: _isComplete, ...snapshot } = examConfigurationDto(config);
      const updated = await tx.entranceExamApplication.update({ where: { id: app.id }, data: {
        actualStartedAt, deadlineAt, contentRevisionId: revision.id,
        executionConfiguration: snapshot as unknown as Prisma.InputJsonValue,
      }, include });
      return this.dto(updated);
    });
  }

  questions(userId: string, id: string) {
    return this.locked(id, userId, async (app, tx) => {
      const bound = await activeBoundExecution(tx, app.id);
      bound.assertTime();
      return bound.content.applicantQuestions;
    });
  }

  async media(userId: string, id: string, mediaId: string) {
    return this.locked(id, userId, async (app, tx) => {
      const bound = await activeBoundExecution(tx, app.id);
      if (!bound.content.mediaIds.includes(mediaId)) throw new AppError("Exam media not found.", 404);
      bound.assertTime();
      return bound.app.contentRevisionId!;
    });
  }
}
