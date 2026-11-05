import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import prisma from "../config/database";
import { AppError } from "../utils/AppError";
import { scheduleIdentifier } from "../services/exam-schedule.rules";
import { finalizationReceipt, IncompleteExamSubmissionError, submissionConfirmation } from "../services/exam-finalization.rules";
import { startedBoundExecution, validateExecutionIdentity } from "./exam-execution.repository";

const eligible = (status: string) => status === "PENDING" || status === "APPROVED";

export class ExamFinalizationRepository {
  private locked<T>(applicationId: string, userId: string | null, operation: (tx: Prisma.TransactionClient) => Promise<T>) {
    const id = scheduleIdentifier(applicationId, "applicationId");
    return prisma.$transaction(async tx => {
      // Ownership is checked before and again after the exact B0A/B5 lock.
      const target = await tx.entranceExamApplication.findUnique({ where: { id }, select: { student: { select: { userId: true } } } });
      if (!target || (userId !== null && target.student.userId !== userId)) throw new AppError("Exam application not found.", 404);
      const rows = await tx.$queryRaw<{ status: string }[]>`SELECT status FROM entrance_exam_applications WHERE application_id = ${id} FOR UPDATE`;
      if (!rows.length) throw new AppError("Exam application not found.", 404);
      const current = await tx.entranceExamApplication.findUnique({ where: { id }, select: { student: { select: { userId: true } } } });
      if (!current || (userId !== null && current.student.userId !== userId)) throw new AppError("Exam application not found.", 404);
      return operation(tx);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
  }

  read(applicationId: string, userId: string) {
    applicationId = scheduleIdentifier(applicationId, "applicationId");
    return this.locked(applicationId, userId, async tx => {
      const app = await tx.entranceExamApplication.findUniqueOrThrow({ where: { id: applicationId } });
      const receipt = finalizationReceipt(app);
      return { state: receipt ? "FINALIZED" : eligible(app.status) ? "PENDING" : "LEGACY_TERMINAL", receipt };
    });
  }

  submit(applicationId: string, body: unknown, userId: string) {
    const confirmation = submissionConfirmation(body);
    return this.finalize(applicationId, { kind: "SUBMIT", userId, ...confirmation });
  }

  expire(applicationId: string) { return this.finalize(applicationId, { kind: "EXPIRY" }); }

  /** The only final mutation authority. No answer upserts: consume B5 unchanged. */
  private finalize(applicationId: string, request: { kind: "EXPIRY" } | { kind: "SUBMIT"; userId: string; acknowledgeIncomplete: boolean }) {
    applicationId = scheduleIdentifier(applicationId, "applicationId");
    return this.locked(applicationId, request.kind === "SUBMIT" ? request.userId : null, async tx => {
      const current = await tx.entranceExamApplication.findUniqueOrThrow({ where: { id: applicationId } });
      const existing = finalizationReceipt(current);
      if (existing) return existing;
      if (!eligible(current.status)) throw new AppError("This is a legacy terminal record without a B6 receipt.", 409);
      const { app, content } = await startedBoundExecution(tx, applicationId);
      // Decide only after the application lock and B4 current-state reread.
      const now = new Date();
      const expired = now.getTime() >= app.deadlineAt!.getTime();
      if (request.kind === "EXPIRY" && !expired) return null;
      if (!expired && request.kind === "SUBMIT") validateExecutionIdentity(app);
      if (app.score) throw new AppError("Existing assessment evidence requires staff review.", 409);
      const rows = await tx.applicantAnswer.findMany({ where: { applicationId } });
      let answeredCount = 0, mcqCorrect = 0;
      for (const row of rows) {
        const question = content.questions.find(q => q.id === row.questionId);
        if (!question) throw new AppError("Saved answers do not match the frozen examination.", 409);
        if (question.type === "MULTIPLE_CHOICE" && row.essayAnswer === null) {
          if (row.selectedOptionId === null) continue; // B5 explicit clear stays clear.
          const option = question.options.find(o => o.id === row.selectedOptionId);
          if (!option) throw new AppError("Saved option does not belong to the frozen question.", 409);
          answeredCount++;
          if (option.isCorrect) mcqCorrect++;
        } else if (question.type === "ESSAY" && row.selectedOptionId === null && typeof row.essayAnswer === "string") {
          if (row.essayAnswer.trim()) answeredCount++;
        } else throw new AppError("Saved answer representation requires staff review.", 409);
      }
      const questionCount = content.questions.length;
      if (!expired && request.kind === "SUBMIT" && answeredCount < questionCount && !request.acknowledgeIncomplete) {
        throw new IncompleteExamSubmissionError(answeredCount, questionCount - answeredCount);
      }
      const updated = await tx.entranceExamApplication.update({ where: { id: applicationId }, data: {
        status: "TAKEN", finalizedAt: now,
        finalizationReason: expired ? "TIME_EXPIRED" : "APPLICANT_SUBMITTED",
        finalizationReceiptId: randomUUID(), finalizationAnsweredCount: answeredCount, finalizationQuestionCount: questionCount,
      } });
      // Raw MCQ count only; no B1 weighting, essay score, threshold or PASS/FAIL.
      await tx.entranceExamScore.create({ data: { applicationId, multipleChoiceScore: mcqCorrect, status: "PENDING" } });
      return finalizationReceipt(updated)!;
    });
  }
}
