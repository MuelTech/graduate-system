import type { EntranceExamApplication } from "@prisma/client";
import { AppError } from "../utils/AppError";

export function submissionConfirmation(value: unknown): { acknowledgeIncomplete: boolean } {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new AppError("Submit an examination confirmation object.", 400);
  const data = value as Record<string, unknown>;
  if (Object.keys(data).some(key => key !== "acknowledgeIncomplete") ||
      ("acknowledgeIncomplete" in data && typeof data.acknowledgeIncomplete !== "boolean")) {
    throw new AppError("Only acknowledgeIncomplete (boolean) is accepted for submission.", 400);
  }
  return { acknowledgeIncomplete: data.acknowledgeIncomplete === true };
}

export class IncompleteExamSubmissionError extends AppError {
  readonly code = "INCOMPLETE_CONFIRMATION_REQUIRED";
  constructor(readonly answeredCount: number, readonly unansweredCount: number) {
    super("Some questions are unanswered. Review and confirm incomplete submission; unanswered items will remain unanswered.", 409);
    Object.setPrototypeOf(this, IncompleteExamSubmissionError.prototype);
  }
}

/** Allowlisted, immutable evidence only. No answer key, grades or private config. */
export function finalizationReceipt(app: Pick<EntranceExamApplication, "id" | "actualStartedAt" | "deadlineAt" | "contentRevisionId" | "finalizedAt" | "finalizationReason" | "finalizationReceiptId" | "finalizationAnsweredCount" | "finalizationQuestionCount">) {
  if (!app.finalizedAt && !app.finalizationReason && !app.finalizationReceiptId &&
      app.finalizationAnsweredCount == null && app.finalizationQuestionCount == null) return null;
  if (!app.finalizedAt || !app.finalizationReason || !app.finalizationReceiptId ||
      !app.actualStartedAt || !app.deadlineAt || !app.contentRevisionId ||
      app.finalizationAnsweredCount == null || app.finalizationQuestionCount == null ||
      app.finalizationAnsweredCount < 0 || app.finalizationAnsweredCount > app.finalizationQuestionCount) {
    throw new AppError("Incomplete finalization evidence requires staff review.", 409);
  }
  return {
    receiptId: app.finalizationReceiptId, applicationId: app.id,
    finalizedAt: app.finalizedAt.toISOString(), finalizationReason: app.finalizationReason,
    actualStartedAt: app.actualStartedAt.toISOString(), deadlineAt: app.deadlineAt.toISOString(),
    contentRevisionId: app.contentRevisionId,
    answeredCount: app.finalizationAnsweredCount,
    unansweredCount: app.finalizationQuestionCount - app.finalizationAnsweredCount,
    questionCount: app.finalizationQuestionCount,
  };
}
