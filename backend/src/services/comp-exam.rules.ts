import type { CompExamStatus, NotificationType } from "@prisma/client";

/**
 * EARIST Graduate School Manual of Operations (§7.15.4):
 * A student who fails the Written Comprehensive Examination on the third
 * attempt is permanently disqualified from the Graduate School.
 */
export const MAX_COMP_EXAM_ATTEMPTS = 3;

export type CompExamStanding =
  | "NOT_RECORDED"
  | "PENDING"
  | "PASSED"
  | "RETAKE_REQUIRED"
  | "DISMISSED";

export interface CompExamRecordLike {
  id?: string;
  attemptNumber?: number | null;
  status: CompExamStatus | string;
  examDate?: Date | string | null;
  remarks?: string | null;
  certificateNumber?: string | null;
  certificateIssuedAt?: Date | string | null;
  createdAt?: Date | string | null;
}

export interface CompExamSummaryEvaluation<T extends CompExamRecordLike> {
  standing: CompExamStanding;
  isPassed: boolean;
  isDismissed: boolean;
  failedCount: number;
  attemptsUsed: number;
  attemptsRemaining: number;
  maxAttempts: number;
  nextAttemptNumber: number | null;
  passedAttempt: T | null;
  latestAttempt: T | null;
  latestGradedAttempt: T | null;
  orderedRecords: T[];
}

function toTimestamp(value: Date | string | null | undefined): number {
  if (!value) return 0;
  const parsed = value instanceof Date ? value : new Date(value);
  const ms = parsed.getTime();
  return Number.isNaN(ms) ? 0 : ms;
}

export function sortCompExamRecordsDesc<T extends CompExamRecordLike>(
  records: readonly T[],
): T[] {
  return [...records].sort((a, b) => {
    const attemptA = typeof a.attemptNumber === "number" ? a.attemptNumber : 1;
    const attemptB = typeof b.attemptNumber === "number" ? b.attemptNumber : 1;
    if (attemptB !== attemptA) return attemptB - attemptA;
    return toTimestamp(b.createdAt) - toTimestamp(a.createdAt);
  });
}

export function evaluateCompExamSummary<T extends CompExamRecordLike>(
  records: readonly T[],
): CompExamSummaryEvaluation<T> {
  const orderedRecords = sortCompExamRecordsDesc(records);
  const passedAttempt =
    orderedRecords.find((r) => String(r.status).toUpperCase() === "PASSED") ??
    null;
  const failedCount = orderedRecords.filter(
    (r) => String(r.status).toUpperCase() === "FAILED",
  ).length;
  const gradedAttempts = orderedRecords.filter((r) => {
    const upper = String(r.status).toUpperCase();
    return upper === "PASSED" || upper === "FAILED";
  });
  const hasPendingOnly =
    gradedAttempts.length === 0 &&
    orderedRecords.some((r) => String(r.status).toUpperCase() === "PENDING");

  const isPassed = Boolean(passedAttempt);
  const isDismissed = !isPassed && failedCount >= MAX_COMP_EXAM_ATTEMPTS;
  const attemptsUsed = gradedAttempts.length;
  const attemptsRemaining =
    isPassed || isDismissed
      ? 0
      : Math.max(0, MAX_COMP_EXAM_ATTEMPTS - failedCount);
  const nextAttemptNumber =
    isPassed || isDismissed ? null : failedCount + 1;

  let standing: CompExamStanding = "NOT_RECORDED";
  if (isPassed) {
    standing = "PASSED";
  } else if (isDismissed) {
    standing = "DISMISSED";
  } else if (failedCount > 0) {
    standing = "RETAKE_REQUIRED";
  } else if (hasPendingOnly) {
    standing = "PENDING";
  }

  return {
    standing,
    isPassed,
    isDismissed,
    failedCount,
    attemptsUsed,
    attemptsRemaining,
    maxAttempts: MAX_COMP_EXAM_ATTEMPTS,
    nextAttemptNumber,
    passedAttempt,
    latestAttempt: orderedRecords[0] ?? null,
    latestGradedAttempt: gradedAttempts[0] ?? null,
    orderedRecords,
  };
}

export function generateCompExamCertificateNumber(
  referenceDate: Date,
  attemptId: string,
): string {
  const year = referenceDate.getUTCFullYear();
  const token =
    attemptId
      .replace(/[^a-zA-Z0-9]/g, "")
      .slice(0, 8)
      .toUpperCase() || "CERT0001";
  return `WCE-${year}-${token}`;
}

export function buildCompExamNotificationCopy(input: {
  status: "PASSED" | "FAILED";
  attemptNumber: number;
  maxAttempts?: number;
  isDismissed: boolean;
  isCorrection?: boolean;
}): {
  title: string;
  message: string;
  type: NotificationType;
} {
  const maxAttempts = input.maxAttempts ?? MAX_COMP_EXAM_ATTEMPTS;
  const prefix = input.isCorrection ? "Updated Result: " : "";

  if (input.status === "PASSED") {
    return {
      title: `${prefix}Written Comprehensive Examination — Passed`,
      message: `Your Written Comprehensive Examination result (Attempt ${input.attemptNumber} of ${maxAttempts}) has been recorded as PASSED. You are now eligible to apply for Title Defense (Manual §7.17.1).`,
      type: "EXAM_RESULT",
    };
  }

  if (input.isDismissed) {
    return {
      title: `${prefix}Written Comprehensive Examination — Permanently Disqualified`,
      message: `Your Written Comprehensive Examination result (Attempt ${input.attemptNumber} of ${maxAttempts}) has been recorded as FAILED. Under Graduate School Manual §7.15.4, failing the third attempt results in permanent disqualification from the Graduate School.`,
      type: "EXAM_RESULT",
    };
  }

  const remaining = Math.max(0, maxAttempts - input.attemptNumber);
  return {
    title: `${prefix}Written Comprehensive Examination — Retake Required`,
    message: `Your Written Comprehensive Examination result (Attempt ${input.attemptNumber} of ${maxAttempts}) has been recorded as FAILED. You have ${remaining} remaining attempt${remaining === 1 ? "" : "s"} under Graduate School Manual §7.15.4.`,
    type: "EXAM_RESULT",
  };
}

export interface CompExamEmailFoundationPayload {
  templateKey: "comp_exam_recorded";
  recipientEmail: string;
  variables: {
    student_name: string;
    result: string;
    portal_link: string;
  };
  deliveryStatus: "DEFERRED_SMTP_NOT_CONFIGURED";
}

export function buildCompExamEmailFoundationPayload(input: {
  recipientEmail: string;
  studentName: string;
  status: "PASSED" | "FAILED";
  attemptNumber: number;
  maxAttempts?: number;
  isDismissed: boolean;
  portalLink?: string;
}): CompExamEmailFoundationPayload {
  const maxAttempts = input.maxAttempts ?? MAX_COMP_EXAM_ATTEMPTS;
  const remaining = Math.max(0, maxAttempts - input.attemptNumber);
  const resultSummary =
    input.status === "PASSED"
      ? `PASSED (Attempt ${input.attemptNumber} of ${maxAttempts})`
      : input.isDismissed
        ? `FAILED — Attempt ${input.attemptNumber} of ${maxAttempts} (Permanently Disqualified per Manual §7.15.4)`
        : `FAILED — Attempt ${input.attemptNumber} of ${maxAttempts} (${remaining} remaining attempt${remaining === 1 ? "" : "s"})`;

  return {
    templateKey: "comp_exam_recorded",
    recipientEmail: input.recipientEmail,
    variables: {
      student_name: input.studentName,
      result: resultSummary,
      portal_link:
        input.portalLink ||
        process.env.FRONTEND_URL?.trim() ||
        "https://gsis.earist.edu.ph/login",
    },
    deliveryStatus: "DEFERRED_SMTP_NOT_CONFIGURED",
  };
}
