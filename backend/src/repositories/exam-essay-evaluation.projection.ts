import type { EntranceExamApplication, Prisma } from "@prisma/client";
import type { EssayEvaluation } from "../interfaces/exam.interfaces";
import { AppError } from "../utils/AppError";
import { finalizationReceipt } from "../services/exam-finalization.rules";
import { singleEssay } from "../services/exam-essay-evaluation.rules";
import { binding } from "./exam-execution.repository";
import { ExamQuestionSetRepository } from "./exam-question-set.repository";
import { completedResultStatus } from "../services/exam-result.rules";

export const evaluationAuthoritySelect = {
  actualStartedAt: true, deadlineAt: true, contentRevisionId: true, executionConfiguration: true,
  finalizedAt: true, finalizationReason: true, finalizationReceiptId: true,
  finalizationAnsweredCount: true, finalizationQuestionCount: true,
} as const;
export const evaluationScoreSelect = {
  multipleChoiceScore: true, scoredAt: true, scoringBasis: true,
  essayScore: true, gradedById: true, essayEvaluatedAt: true, totalScore: true, status: true,
  gradedBy: { select: { id: true, firstName: true, lastName: true } },
} as const;
type ReviewApplication = Pick<EntranceExamApplication, "id" | "status" | keyof typeof evaluationAuthoritySelect> & {
  score: Prisma.EntranceExamScoreGetPayload<{ select: typeof evaluationScoreSelect }> | null;
};

/** Exact B2/B4/B6 authority, shared by detail read and the locked grade transaction. */
export async function requireEssayReview(db: Prisma.TransactionClient, app: ReviewApplication): Promise<Extract<EssayEvaluation, { status: "PENDING" | "COMPLETED" }>> {
  const receipt = finalizationReceipt(app);
  if (!receipt) throw new AppError("This record has no finalized examination evidence. Essay evaluation is unavailable.", 409);
  const computed = completedResultStatus(app);
  if (!computed && (app.status !== "TAKEN" || !app.score || app.score.status !== "PENDING" || app.score.totalScore !== null)) {
    throw new AppError("Essay evaluation requires a finalized Taken record with a pending assessment. Staff review is required.", 409);
  }
  if (!["APPLICANT_SUBMITTED", "TIME_EXPIRED"].includes(receipt.finalizationReason) ||
      !Number.isInteger(receipt.answeredCount) || !Number.isInteger(receipt.questionCount) || receipt.questionCount <= 0 ||
      app.finalizedAt!.getTime() < app.actualStartedAt!.getTime() ||
      (receipt.finalizationReason === "TIME_EXPIRED" ? app.finalizedAt! < app.deadlineAt! : app.finalizedAt! >= app.deadlineAt!)) {
    throw new AppError("Finalization evidence requires staff review before essay evaluation.", 409);
  }
  let maximum: number | null;
  try { maximum = binding(app).essayMaximumScore; }
  catch (error) {
    if (error instanceof AppError) throw new AppError("The recorded examination configuration requires staff review. Essay evaluation is unavailable.", 409);
    throw error;
  }
  if (typeof maximum !== "number" || !Number.isFinite(maximum) || maximum <= 0) {
    throw new AppError("The recorded essay maximum is unavailable or invalid. Staff review is required.", 409);
  }
  const content = await new ExamQuestionSetRepository().getForBinding(app.contentRevisionId!, db);
  const essay = singleEssay(content.questions);
  if (receipt.questionCount !== content.questions.length) throw new AppError("Finalized content evidence requires staff review.", 409);
  const answer = await db.applicantAnswer.findUnique({
    where: { applicationId_questionId: { applicationId: app.id, questionId: essay.id } },
    select: { essayAnswer: true, selectedOptionId: true },
  });
  if (answer && (answer.selectedOptionId !== null || typeof answer.essayAnswer !== "string")) {
    throw new AppError("The finalized essay response requires staff review.", 409);
  }
  const score = app.score!;
  const evidence = [score.essayScore, score.gradedById, score.essayEvaluatedAt];
  const completed = evidence.every(value => value !== null);
  if (!completed && evidence.some(value => value !== null)) throw new AppError("Incomplete essay evaluation evidence requires staff review.", 409);
  const evaluatedScore = score.essayScore === null ? null : Number(score.essayScore);
  if (completed && (!score.gradedBy || !Number.isFinite(evaluatedScore) || evaluatedScore! < 0 || evaluatedScore! > maximum ||
      !Number.isFinite(score.essayEvaluatedAt!.getTime()) || score.essayEvaluatedAt! < app.finalizedAt!)) {
    throw new AppError("Essay evaluation evidence requires staff review.", 409);
  }
  return {
    status: completed ? "COMPLETED" : "PENDING", questionId: essay.id,
    // Same safe content projection received by the Applicant, including emphasis/stimulus.
    question: content.applicantQuestions.find(question => question.id === essay.id)!,
    responseText: answer?.essayAnswer ?? null,
    responseState: !answer ? "MISSING" : answer.essayAnswer!.trim() ? "SUBMITTED" : "BLANK",
    maximumScore: maximum, essayScore: evaluatedScore,
    evaluator: completed ? score.gradedBy : null,
    evaluatedAt: completed ? score.essayEvaluatedAt!.toISOString() : null,
  };
}

export async function essayReviewProjection(db: Prisma.TransactionClient, app: ReviewApplication): Promise<EssayEvaluation> {
  try { return await requireEssayReview(db, app); }
  catch (error) {
    if (!(error instanceof AppError)) throw error;
    const hasEvidence = Object.keys(evaluationAuthoritySelect).some(key => app[key as keyof typeof evaluationAuthoritySelect] != null) || app.score?.essayEvaluatedAt != null;
    return { status: hasEvidence ? "STAFF_REVIEW" : app.status === "PENDING" || app.status === "APPROVED" ? "UNAVAILABLE" : "LEGACY",
      reason: hasEvidence ? "Essay evaluation is unavailable. The examination record requires staff review." : "No finalized essay evaluation evidence is recorded for this examination." };
  }
}
