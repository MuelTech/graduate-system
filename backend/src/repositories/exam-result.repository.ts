import { Prisma } from "@prisma/client";
import { AppError } from "../utils/AppError";
import {
  calculatePoints,
  ScoreDecimal,
  validatedResultBasis,
  resultProjection,
  type ResultBasis,
} from "../services/exam-result.rules";
import { binding } from "./exam-execution.repository";
import { ExamQuestionSetRepository } from "./exam-question-set.repository";
import { requireEssayReview } from "./exam-essay-evaluation.projection";

/** Internal authority. Caller MUST hold the exact application FOR UPDATE lock. */
export async function scoreLockedApplication(
  tx: Prisma.TransactionClient,
  applicationId: string,
) {
  const app = await tx.entranceExamApplication.findUnique({
    where: { id: applicationId },
    include: {
      score: {
        include: {
          gradedBy: { select: { id: true, firstName: true, lastName: true } },
        },
      },
    },
  });
  if (!app || !app.score)
    throw new AppError(
      "A finalized examination with an essay evaluation is required.",
      409,
    );
  const score = app.score;
  if (score.scoredAt !== null || score.scoringBasis !== null) {
    validatedResultBasis(app); // Recover only a complete existing immutable result.
    return resultProjection(app);
  }
  const evaluation = await requireEssayReview(tx, app);
  if (evaluation.status !== "COMPLETED")
    throw new AppError(
      "Complete the essay evaluation before finalizing the result.",
      409,
    );
  const config = binding(app);
  const snapshot = app.executionConfiguration as Record<string, unknown>;
  if (
    config.mcqPointsPerCorrectItem === null ||
    config.essayMaximumScore === null ||
    config.passingThreshold === null ||
    snapshot.passingThresholdUnit !== "PERCENT"
  ) {
    throw new AppError(
      "The frozen scoring configuration is incomplete. Staff review is required; current settings cannot repair this attempt.",
      409,
    );
  }
  const content = await new ExamQuestionSetRepository().getForBinding(
    app.contentRevisionId!,
    tx,
  );
  const rows = await tx.applicantAnswer.findMany({ where: { applicationId } });
  const byId = new Map(rows.map((row) => [row.questionId, row]));
  if (
    rows.length !== byId.size ||
    rows.some(
      (row) => !content.questions.some((q) => q.id === row.questionId),
    ) ||
    new Set(content.questions.map((q) => q.id)).size !==
      content.questions.length
  )
    throw new AppError("Finalized answers require staff review.", 409);
  let correct = 0,
    count = 0,
    answered = 0;
  for (const q of content.questions) {
    const answer = byId.get(q.id);
    if (q.type === "MULTIPLE_CHOICE") {
      count++;
      if (q.options.filter((o) => o.isCorrect).length !== 1)
        throw new AppError(
          "Frozen answer authority requires staff review.",
          409,
        );
      if (!answer) continue;
      if (answer.essayAnswer !== null)
        throw new AppError(
          "Finalized MCQ representation requires staff review.",
          409,
        );
      if (answer.selectedOptionId === null) continue;
      const option = q.options.find((o) => o.id === answer.selectedOptionId);
      if (!option)
        throw new AppError("Finalized option requires staff review.", 409);
      answered++;
      if (option.isCorrect) correct++;
    } else if (answer) {
      if (
        answer.selectedOptionId !== null ||
        typeof answer.essayAnswer !== "string"
      )
        throw new AppError(
          "Finalized essay representation requires staff review.",
          409,
        );
      if (answer.essayAnswer.trim()) answered++;
    }
  }
  if (
    answered !== app.finalizationAnsweredCount ||
    score.multipleChoiceScore === null ||
    !new ScoreDecimal(score.multipleChoiceScore.toString()).eq(correct)
  ) {
    throw new AppError(
      "Recomputed answers disagree with B6 finalization evidence. Staff review is required.",
      409,
    );
  }
  const points = new ScoreDecimal(config.mcqPointsPerCorrectItem).toFixed(),
    maximum = new ScoreDecimal(config.essayMaximumScore).toFixed();
  const threshold = new ScoreDecimal(config.passingThreshold).toFixed(),
    essay = new ScoreDecimal(score.essayScore!.toString()).toFixed();
  const calculated = calculatePoints(
    correct,
    count,
    points,
    essay,
    maximum,
    threshold,
  );
  // Persisted legacy aggregate columns are DECIMAL(65,30); never allow DB rounding.
  for (const value of [
    calculated.mcqEarnedPoints,
    calculated.finalEarnedPoints,
  ]) {
    const d = new ScoreDecimal(value);
    if (d.decimalPlaces() > 30 || d.abs().gte(new ScoreDecimal(10).pow(35)))
      throw new AppError(
        "Scoring exceeds supported exact storage. Staff review is required.",
        409,
      );
  }
  const basis: ResultBasis = {
    version: 1,
    applicationId,
    contentRevisionId: app.contentRevisionId!,
    finalizationReceiptId: app.finalizationReceiptId!,
    mcqQuestionCount: count,
    mcqCorrectCount: correct,
    mcqPointsPerCorrectItem: points,
    essayScore: essay,
    essayMaximum: maximum,
    passingThreshold: threshold,
    passingThresholdUnit: "PERCENT",
    ...calculated,
  };
  const scoredAt = new Date();
  await tx.entranceExamScore.update({
    where: { applicationId },
    data: {
      multipleChoiceScore: calculated.mcqEarnedPoints,
      totalScore: calculated.finalEarnedPoints,
      status: calculated.result,
      scoredAt,
      scoringBasis: basis as unknown as Prisma.InputJsonValue,
    },
  });
  await tx.entranceExamApplication.update({
    where: { id: applicationId },
    data: { status: calculated.result },
  });
  return resultProjection({
    ...app,
    status: calculated.result,
    score: {
      ...score,
      multipleChoiceScore: new Prisma.Decimal(calculated.mcqEarnedPoints),
      totalScore: new Prisma.Decimal(calculated.finalEarnedPoints),
      status: calculated.result,
      scoredAt,
      scoringBasis: basis as unknown as Prisma.JsonValue,
    },
  });
}
