import type { EntranceExamApplication } from "@prisma/client";
import { AppError } from "../utils/AppError";
import { manilaCalendarDate, scheduleStartInstant } from "./exam-schedule-time";
import { scheduleIdentifier } from "./exam-schedule.rules";

export const AMENDMENT_REASON_LIMIT = 2000;
export function amendmentBody(value: unknown, needsTarget = false) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new AppError("Provide a reason for this action.", 400);
  const data = value as Record<string, unknown>;
  if (
    Object.keys(data).some(
      (key) =>
        !["reason", ...(needsTarget ? ["targetSlotId"] : [])].includes(key),
    )
  )
    throw new AppError("This action contains unsupported fields.", 400);
  if (
    typeof data.reason !== "string" ||
    !data.reason.trim() ||
    data.reason.trim().length > AMENDMENT_REASON_LIMIT
  )
    throw new AppError(
      `A reason of 1 to ${AMENDMENT_REASON_LIMIT} characters is required.`,
      400,
    );
  return {
    reason: data.reason.trim(),
    targetSlotId: needsTarget
      ? scheduleIdentifier(data.targetSlotId, "targetSlotId")
      : null,
  };
}

type UnstartedApplication = Pick<
  EntranceExamApplication,
  | "status"
  | "actualStartedAt"
  | "deadlineAt"
  | "contentRevisionId"
  | "executionConfiguration"
  | "finalizedAt"
  | "finalizationReason"
  | "finalizationReceiptId"
  | "finalizationAnsweredCount"
  | "finalizationQuestionCount"
  | "startAuthorizedAt"
  | "startAuthorizedById"
> & {
  _count: { answers: number };
  score: unknown;
};
export function requireNeverStarted(app: UnstartedApplication) {
  if (
    [
      app.actualStartedAt,
      app.deadlineAt,
      app.contentRevisionId,
      app.executionConfiguration,
      app.finalizedAt,
      app.finalizationReason,
      app.finalizationReceiptId,
      app.finalizationAnsweredCount,
      app.finalizationQuestionCount,
      app.score,
    ].some((value) => value != null) ||
    !Number.isInteger(app._count.answers) ||
    app._count.answers !== 0 ||
    Boolean(app.startAuthorizedAt) !== Boolean(app.startAuthorizedById)
  ) {
    throw new AppError(
      "This record has examination or incomplete authority evidence. Its appointment cannot be amended; staff review is required.",
      409,
    );
  }
}

export function originalAppointment(app: {
  examDate: Date | null;
  examTime: Date | null;
  slot: { examDate: Date; examTime: Date };
}) {
  if (
    !app.examDate ||
    !app.examTime ||
    app.examDate.getTime() !== app.slot.examDate.getTime() ||
    app.examTime.getTime() !== app.slot.examTime.getTime()
  )
    throw new AppError(
      "Original appointment evidence requires staff review.",
      409,
    );
  scheduleStartInstant(app.examDate, app.examTime);
  return app.examDate.toISOString().slice(0, 10);
}
export function requireMissedDate(
  app: Parameters<typeof originalAppointment>[0],
  now = new Date(),
) {
  if (originalAppointment(app) >= manilaCalendarDate(now))
    throw new AppError(
      "A missed-exam appeal is available only after the original appointment's Manila calendar date. Same-day late arrival follows Start Examination.",
      409,
    );
}

export function canAmendAppointment(
  app: UnstartedApplication &
    Parameters<typeof originalAppointment>[0] & {
      seatReleasedAt: Date | null;
      scheduleAmendment?: unknown;
    },
) {
  try {
    requireNeverStarted(app);
    originalAppointment(app);
    return (
      ["PENDING", "APPROVED"].includes(app.status) &&
      app.seatReleasedAt === null &&
      !app.scheduleAmendment
    );
  } catch {
    return false;
  }
}
