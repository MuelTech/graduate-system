import { Prisma } from "@prisma/client";
import { AppError } from "../utils/AppError";
import { essayScoreValue } from "../services/exam-essay-evaluation.rules";
import { evaluationScoreSelect, requireEssayReview } from "./exam-essay-evaluation.projection";
import { scoreLockedApplication } from "./exam-result.repository";

type Application = Parameters<typeof requireEssayReview>[1];

/** One pending predicate for Faculty queue/detail/media/write; B7 remains evidence authority. */
export async function requirePendingEssayReview(tx: Prisma.TransactionClient, application: Application) {
  const evaluation = await requireEssayReview(tx, application);
  if (evaluation.status !== "PENDING") throw new AppError("This essay has already been evaluated. Direct regrading is unavailable.", 409);
  if (application.score?.scoredAt !== null || application.score.scoringBasis !== null) {
    throw new AppError("Incomplete scoring evidence requires staff review.", 409);
  }
  return evaluation;
}

/** Internal B7/B8 writer. Caller MUST hold the application lock and validate its actor.
 * Extracted from ExamRepository.gradeEssay; numeric/evidence/scoring authority is unchanged.
 */
export async function writeLockedEssayEvaluation(tx: Prisma.TransactionClient, application: Application, essayScore: number, evaluatorId: string) {
  essayScoreValue(essayScore);
  const evaluation = await requirePendingEssayReview(tx, application);
  if (essayScore > evaluation.maximumScore) throw new AppError(`Essay score cannot exceed the recorded maximum of ${evaluation.maximumScore}.`, 400);
  if (new Prisma.Decimal(essayScore).decimalPlaces() > 30) throw new AppError("Essay score exceeds the supported decimal precision.", 400);
  const score = await tx.entranceExamScore.update({ where: { applicationId: application.id }, data: {
    essayScore, gradedById: evaluatorId, essayEvaluatedAt: new Date(),
  }, select: evaluationScoreSelect });
  const evaluated = await requireEssayReview(tx, { ...application, score });
  const result = await scoreLockedApplication(tx, application.id);
  return { ...evaluated, result };
}
