import { examAdministrationAuthorization } from "../access/exam-administration-authorization";
import { Prisma, type ExamAppStatus } from "@prisma/client";
import prisma from "../config/database";
import { AppError } from "../utils/AppError";
import {
  amendmentBody,
  canAmendAppointment,
  originalAppointment,
  requireMissedDate,
  requireNeverStarted,
} from "../services/exam-amendment.rules";
import {
  BLOCKING_EXAM_STATUSES,
  requireConsistentCapacity,
  requireEligibleAlignment,
  scheduleIdentifier,
} from "../services/exam-schedule.rules";
import { requireFutureSchedule } from "../services/exam-schedule-time";
import { validatedResultBasis } from "../services/exam-result.rules";

export const amendmentInclude = {
  requestedBy: { select: { id: true, firstName: true, lastName: true } },
  decidedBy: { select: { id: true, firstName: true, lastName: true } },
  targetSlot: { select: { id: true, examDate: true, examTime: true } },
  replacementApplication: { select: { id: true, status: true } },
} satisfies Prisma.ExamScheduleAmendmentInclude;
const include = {
  student: { include: { user: { select: { role: true, isActive: true } } } },
  slot: true,
  score: true,
  _count: { select: { answers: true } },
  scheduleAmendment: { include: amendmentInclude },
  resultDecision: true,
} satisfies Prisma.EntranceExamApplicationInclude;
type Application = Prisma.EntranceExamApplicationGetPayload<{
  include: typeof include;
}>;
export type AmendmentAction =
  | "MISSED_APPEAL"
  | "APPROVE_APPEAL"
  | "REJECT_APPEAL"
  | "ADMIN_CANCELLATION"
  | "ADMIN_RESCHEDULE";
const replacementAction = (action: AmendmentAction) =>
  action === "APPROVE_APPEAL" || action === "ADMIN_RESCHEDULE";

async function requireAdmin(tx: Prisma.TransactionClient, id: string) {
  const admin = await tx.user.findUnique({
    where: { id },
    select: { role: true, isActive: true },
  });
  if (admin?.role !== "ADMIN" || !admin.isActive)
    throw new AppError(
      "Only a current active Admin may perform this action.",
      403,
    );
}
async function audit(
  tx: Prisma.TransactionClient,
  actorId: string,
  app: Application,
  action: string,
  reason: string,
  next: Record<string, unknown>,
) {
  await tx.auditLog.create({
    data: {
      actorId,
      actionType: action,
      targetTable: "entrance_exam_applications",
      targetId: app.id,
      description: reason,
      oldValue: JSON.stringify({
        status: app.status,
        slotId: app.slotId,
        seatReleasedAt: app.seatReleasedAt,
      }),
      newValue: JSON.stringify(next),
    },
  });
}
async function capacity(
  tx: Prisma.TransactionClient,
  slot: Application["slot"],
) {
  requireConsistentCapacity(
    slot,
    await tx.entranceExamApplication.count({
      where: { slotId: slot.id, seatReleasedAt: null },
    }),
  );
}
function pendingAppeal(app: Application) {
  const a = app.scheduleAmendment;
  if (
    app.status !== "APPEALED" ||
    !a ||
    a.type !== "MISSED_APPEAL" ||
    a.status !== "PENDING" ||
    !app.seatReleasedAt ||
    app.seatReleasedAt.getTime() !== a.requestedAt.getTime() ||
    a.requestedById !== app.student.userId ||
    a.decidedAt !== null ||
    a.decidedById !== null ||
    a.decisionReason !== null ||
    a.targetSlotId !== null ||
    a.replacementApplicationId !== null
  ) {
    throw new AppError(
      "No complete pending missed-exam appeal is available. Reload or request staff review.",
      409,
    );
  }
  requireMissedDate(app, a.requestedAt);
  return a;
}

export class ExamAmendmentRepository {
  constructor(private readonly access = examAdministrationAuthorization) {}
  private locked<T>(
    applicationId: string,
    actorId: string,
    applicant: boolean,
    targetSlotId: string | null,
    capability: "exam.schedules.view" | "exam.schedules.manage",
    operation: (
      tx: Prisma.TransactionClient,
      app: Application,
      slots: Map<string, Application["slot"]>,
    ) => Promise<T>,
  ) {
    const id = scheduleIdentifier(applicationId, "applicationId");
    return prisma.$transaction(
      async (tx) => {
        if (!applicant) await this.access.assertInTransaction(tx, actorId, capability);
        // Preliminary identities only. No eligibility is decided before locks.
        const before = await tx.entranceExamApplication.findUnique({
          where: { id },
          select: {
            studentId: true,
            slotId: true,
            student: { select: { userId: true } },
          },
        });
        if (!before || (applicant && before.student.userId !== actorId))
          throw new AppError("Exam record not found.", 404);
        await tx.$queryRaw`SELECT student_id FROM students WHERE student_id = ${before.studentId} FOR UPDATE`;
        const slots = new Map<string, Application["slot"]>();
        for (const slotId of [
          ...new Set([before.slotId, ...(targetSlotId ? [targetSlotId] : [])]),
        ].sort()) {
          await tx.$queryRaw`SELECT slot_id FROM exam_slots WHERE slot_id = ${slotId} FOR UPDATE`;
          const slot = await tx.examSlot.findUnique({ where: { id: slotId } });
          if (!slot) throw new AppError("Exam slot not found.", 404);
          slots.set(slotId, slot);
        }
        await tx.$queryRaw`SELECT application_id FROM entrance_exam_applications WHERE application_id = ${id} FOR UPDATE`;
        const app = await tx.entranceExamApplication.findUnique({
          where: { id },
          include,
        });
        if (
          !app ||
          app.studentId !== before.studentId ||
          app.slotId !== before.slotId ||
          (applicant && app.student.userId !== actorId)
        )
          throw new AppError(
            "Exam record changed. Reload before continuing.",
            409,
          );
        if (applicant) {
          if (
            app.student.user.role !== "APPLICANT" ||
            !app.student.user.isActive ||
            app.student.admissionStatus !== "APPLICANT"
          )
            throw new AppError("An active Applicant account is required.", 403);
        } else await requireAdmin(tx, actorId);
        return operation(tx, app, slots);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  }

  amend(
    applicationId: string,
    action: AmendmentAction,
    input: unknown,
    actorId: string,
  ) {
    const { reason, targetSlotId } = amendmentBody(
      input,
      replacementAction(action),
    );
    return this.locked(
      applicationId,
      actorId,
      action === "MISSED_APPEAL",
      targetSlotId,
      "exam.schedules.manage",
      async (tx, app, slots) => {
        requireNeverStarted(app);
        originalAppointment(app);
        if (
          app.slot.programId !== app.programId ||
          app.student.programId !== app.programId
        )
          throw new AppError(
            "Original Applicant/Program authority requires staff review.",
            409,
          );
        const oldSlot = slots.get(app.slotId)!;
        await capacity(tx, oldSlot);
        const decidingAppeal =
          action === "APPROVE_APPEAL" || action === "REJECT_APPEAL";
        const appeal = decidingAppeal ? pendingAppeal(app) : null;
        if (!decidingAppeal && !canAmendAppointment(app))
          throw new AppError(
            "Only an eligible never-started appointment can be amended. A pending appeal must use its decision flow.",
            409,
          );
        let target: Application["slot"] | undefined;
        if (replacementAction(action)) {
          target = slots.get(targetSlotId!)!;
          if (target.id === app.slotId)
            throw new AppError(
              "Choose a different replacement appointment.",
              400,
            );
          if (!target.isActive || target.programId !== app.programId)
            throw new AppError(
              "Choose an active future appointment for the same Program.",
              409,
            );
          if (
            app.student.admissionStatus !== "APPLICANT" ||
            app.student.user.role !== "APPLICANT" ||
            !app.student.user.isActive ||
            !app.student.pinnacleApplicantId?.trim()
          )
            throw new AppError(
              "Applicant admission authority no longer permits a replacement appointment.",
              409,
            );
          requireEligibleAlignment(app.student.alignmentStatus);
          requireFutureSchedule(target.examDate, target.examTime);
          await capacity(tx, target);
          if (target.slotsTaken >= target.maxSlots)
            throw new AppError("The replacement appointment is full.", 409);
          const other = await tx.entranceExamApplication.findFirst({
            where: {
              studentId: app.studentId,
              id: { not: app.id },
              status: { in: [...BLOCKING_EXAM_STATUSES] },
            },
          });
          if (other)
            throw new AppError(
              "Another blocking examination record prevents a replacement appointment.",
              409,
            );
        }
        const now = new Date();
        if (action === "MISSED_APPEAL") requireMissedDate(app, now);
        if (target)
          requireFutureSchedule(target.examDate, target.examTime, now);
        const nextStatus: ExamAppStatus =
          action === "MISSED_APPEAL"
            ? "APPEALED"
            : action === "REJECT_APPEAL"
              ? "MISSED"
              : action === "ADMIN_CANCELLATION"
                ? "CANCELLED"
                : "RESCHEDULED";
        if (!decidingAppeal) {
          const release = await tx.entranceExamApplication.updateMany({
            where: { id: app.id, status: app.status, seatReleasedAt: null },
            data: { seatReleasedAt: now, status: nextStatus },
          });
          if (release.count !== 1)
            throw new AppError(
              "The appointment seat was already released. Reload the record.",
              409,
            );
          const decrement = await tx.examSlot.updateMany({
            where: {
              id: oldSlot.id,
              slotsTaken: oldSlot.slotsTaken,
              AND: { slotsTaken: { gt: 0 } },
            },
            data: { slotsTaken: { decrement: 1 } },
          });
          if (decrement.count !== 1)
            throw new AppError("Seat release requires staff review.", 409);
        } else
          await tx.entranceExamApplication.update({
            where: { id: app.id },
            data: { status: nextStatus },
          });
        let replacementId: string | null = null;
        if (target) {
          const reservation = await tx.examSlot.updateMany({
            where: {
              id: target.id,
              isActive: true,
              slotsTaken: target.slotsTaken,
              maxSlots: target.maxSlots,
              AND: { slotsTaken: { lt: target.maxSlots } },
            },
            data: { slotsTaken: { increment: 1 } },
          });
          if (reservation.count !== 1)
            throw new AppError(
              "The replacement appointment is no longer available.",
              409,
            );
          const replacement = await tx.entranceExamApplication.create({
            data: {
              studentId: app.studentId,
              programId: app.programId,
              slotId: target.id,
              examDate: target.examDate,
              examTime: target.examTime,
              status: "PENDING",
            },
          });
          replacementId = replacement.id;
        }
        const decision = {
          status:
            action === "MISSED_APPEAL"
              ? ("PENDING" as const)
              : action === "REJECT_APPEAL"
                ? ("REJECTED" as const)
                : ("APPROVED" as const),
          decisionReason: action === "MISSED_APPEAL" ? null : reason,
          decidedById: action === "MISSED_APPEAL" ? null : actorId,
          decidedAt: action === "MISSED_APPEAL" ? null : now,
          targetSlotId,
          replacementApplicationId: replacementId,
        };
        const amendment = appeal
          ? await tx.examScheduleAmendment.update({
              where: { id: appeal.id },
              data: decision,
            })
          : await tx.examScheduleAmendment.create({
              data: {
                applicationId: app.id,
                type:
                  action === "MISSED_APPEAL"
                    ? "MISSED_APPEAL"
                    : action === "ADMIN_CANCELLATION"
                      ? "ADMIN_CANCELLATION"
                      : "ADMIN_RESCHEDULE",
                reason,
                requestedById: actorId,
                requestedAt: now,
                ...decision,
              },
            });
        await audit(tx, actorId, app, `EXAM_${action}`, reason, {
          status: nextStatus,
          oldSlotId: app.slotId,
          targetSlotId,
          replacementApplicationId: replacementId,
          amendmentId: amendment.id,
        });
        return {
          applicationId: app.id,
          status: nextStatus,
          amendmentId: amendment.id,
          replacementApplicationId: replacementId,
        };
      },
    );
  }

  options(applicationId: string, adminId: string) {
    return this.locked(applicationId, adminId, false, null, "exam.schedules.view", async (tx, app) => {
      requireNeverStarted(app);
      originalAppointment(app);
      if (app.status === "APPEALED") pendingAppeal(app);
      else if (!canAmendAppointment(app))
        throw new AppError("Appointment amendment is unavailable.", 409);
      const candidates = await tx.examSlot.findMany({
        where: {
          programId: app.programId,
          isActive: true,
          id: { not: app.slotId },
        },
        include: {
          _count: {
            select: { examApplications: { where: { seatReleasedAt: null } } },
          },
        },
        orderBy: [{ examDate: "asc" }, { examTime: "asc" }, { id: "asc" }],
      });
      return candidates
        .filter((slot) => {
          try {
            requireFutureSchedule(slot.examDate, slot.examTime);
            requireConsistentCapacity(slot, slot._count.examApplications);
            return slot.slotsTaken < slot.maxSlots;
          } catch {
            return false;
          }
        })
        .map((slot) => ({
          id: slot.id,
          examDate: slot.examDate.toISOString(),
          examTime: slot.examTime.toISOString(),
          remainingSeats: slot.maxSlots - slot.slotsTaken,
        }));
    });
  }

  reconsider(applicationId: string, input: unknown, adminId: string) {
    const id = scheduleIdentifier(applicationId, "applicationId");
    const { reason } = amendmentBody(input);
    return prisma.$transaction(
      async (tx) => {
        await this.access.assertInTransaction(tx, adminId, "exam.results.reconsider");
        await tx.$queryRaw`SELECT application_id FROM entrance_exam_applications WHERE application_id = ${id} FOR UPDATE`;
        await requireAdmin(tx, adminId);
        const app = await tx.entranceExamApplication.findUnique({
          where: { id },
          include: { score: true, resultDecision: true },
        });
        if (!app) throw new AppError("Exam record not found.", 404);
        if (app.resultDecision)
          throw new AppError(
            "An institutional decision is already recorded. A second decision is unavailable.",
            409,
          );
        const basis = validatedResultBasis(app);
        if (
          app.status !== "FAILED" ||
          app.score?.status !== "FAILED" ||
          basis.result !== "FAILED"
        )
          throw new AppError(
            "Only a completed B8 computed FAILED result is eligible for reconsideration.",
            409,
          );
        const decidedAt = new Date();
        if (decidedAt < app.score.scoredAt!)
          throw new AppError(
            "Scoring time requires staff review before reconsideration.",
            409,
          );
        const decision = await tx.examResultDecision.create({
          data: {
            applicationId: id,
            scoreId: app.score.id,
            decision: "PASSED_RECONSIDERED",
            reason,
            decidedById: adminId,
            decidedAt,
          },
        });
        await tx.auditLog.create({
          data: {
            actorId: adminId,
            actionType: "EXAM_RESULT_RECONSIDERED",
            targetTable: "entrance_exam_applications",
            targetId: id,
            description: reason,
            oldValue: JSON.stringify({
              computedStatus: "FAILED",
              scoreId: app.score.id,
            }),
            newValue: JSON.stringify({
              computedStatus: "FAILED",
              institutionalDecision: decision.decision,
              decisionId: decision.id,
            }),
          },
        });
        return {
          applicationId: id,
          computedStatus: "failed",
          effectiveStatus: "passed_reconsidered",
          institutionalDecision: {
            decision: decision.decision,
            decidedAt: decision.decidedAt.toISOString(),
          },
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  }
}
