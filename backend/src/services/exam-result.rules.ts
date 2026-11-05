import { Prisma } from "@prisma/client";
import { AppError } from "../utils/AppError";
import { finalizationReceipt } from "./exam-finalization.rules";
import { validateExamConfiguration } from "./exam-configuration.rules";

// Products of DECIMAL(65,30) and configured numbers must not inherit Decimal's
// default 20 significant digits. No global Decimal settings are changed.
// 1024 also covers the full finite JS configuration exponent range (including
// subnormal values) in products with the 65-digit database score columns.
export const ScoreDecimal = Prisma.Decimal.clone({ precision: 1024 });
export type ResultBasis = {
  version: 1;
  applicationId: string;
  contentRevisionId: string;
  finalizationReceiptId: string;
  mcqQuestionCount: number;
  mcqCorrectCount: number;
  mcqPointsPerCorrectItem: string;
  mcqEarnedPoints: string;
  mcqMaximumPoints: string;
  essayScore: string;
  essayMaximum: string;
  finalEarnedPoints: string;
  maximumPossiblePoints: string;
  passingThreshold: string;
  passingThresholdUnit: "PERCENT";
  result: "PASSED" | "FAILED";
};
export type ResultApplication = Pick<
  Prisma.EntranceExamApplicationGetPayload<{}>,
  | "id"
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
> & {
  score: Pick<
    Prisma.EntranceExamScoreGetPayload<{}>,
    | "status"
    | "multipleChoiceScore"
    | "essayScore"
    | "totalScore"
    | "gradedById"
    | "essayEvaluatedAt"
    | "scoredAt"
    | "scoringBasis"
  > | null;
};
function review(): never {
  throw new AppError(
    "The examination scoring evidence requires staff review. No result is available.",
    409,
  );
}
const decimalFields = [
  "mcqPointsPerCorrectItem",
  "mcqEarnedPoints",
  "mcqMaximumPoints",
  "essayScore",
  "essayMaximum",
  "finalEarnedPoints",
  "maximumPossiblePoints",
  "passingThreshold",
] as const;
const canonical = (value: string) =>
  new ScoreDecimal(value).toFixed() === value;

export function calculatePoints(
  correct: number,
  count: number,
  points: string,
  essay: string,
  maximum: string,
  threshold: string,
) {
  const p = new ScoreDecimal(points),
    e = new ScoreDecimal(essay),
    m = new ScoreDecimal(maximum),
    t = new ScoreDecimal(threshold);
  if (
    !Number.isSafeInteger(correct) ||
    !Number.isSafeInteger(count) ||
    count < 0 ||
    correct < 0 ||
    correct > count ||
    ![p, e, m, t].every((value) => value.isFinite()) ||
    p.lte(0) ||
    m.lte(0) ||
    e.lt(0) ||
    e.gt(m) ||
    t.lte(0) ||
    t.gt(100)
  )
    review();
  const earned = p.mul(correct),
    mcqMax = p.mul(count),
    total = earned.add(e),
    possible = mcqMax.add(m);
  return {
    mcqEarnedPoints: earned.toFixed(),
    mcqMaximumPoints: mcqMax.toFixed(),
    finalEarnedPoints: total.toFixed(),
    maximumPossiblePoints: possible.toFixed(),
    result: total.mul(100).gte(possible.mul(t))
      ? ("PASSED" as const)
      : ("FAILED" as const),
  };
}

/** Validate immutable provenance and its exact numeric/decision consistency on every publication. */
export function validatedResultBasis(app: ResultApplication): ResultBasis {
  const score = app.score;
  if (
    !score?.scoringBasis ||
    !score.scoredAt ||
    !score.essayEvaluatedAt ||
    !score.gradedById ||
    score.essayScore === null ||
    score.totalScore === null ||
    score.multipleChoiceScore === null ||
    app.status !== score.status ||
    !["PASSED", "FAILED"].includes(app.status)
  )
    review();
  const receipt = finalizationReceipt(app);
  if (
    !receipt ||
    !app.executionConfiguration ||
    !app.actualStartedAt ||
    !app.deadlineAt ||
    !["APPLICANT_SUBMITTED", "TIME_EXPIRED"].includes(
      receipt.finalizationReason,
    ) ||
    !Number.isInteger(receipt.answeredCount) ||
    !Number.isInteger(receipt.questionCount) ||
    app.finalizedAt! < app.actualStartedAt ||
    (receipt.finalizationReason === "TIME_EXPIRED"
      ? app.finalizedAt! < app.deadlineAt
      : app.finalizedAt! >= app.deadlineAt) ||
    score.essayEvaluatedAt < app.finalizedAt! ||
    score.scoredAt < score.essayEvaluatedAt
  )
    review();
  const b = score.scoringBasis as unknown as ResultBasis;
  if (
    typeof b !== "object" ||
    Array.isArray(b) ||
    b.version !== 1 ||
    b.applicationId !== app.id ||
    b.contentRevisionId !== app.contentRevisionId ||
    b.finalizationReceiptId !== app.finalizationReceiptId ||
    b.passingThresholdUnit !== "PERCENT" ||
    b.result !== app.status ||
    b.mcqQuestionCount + 1 !== receipt.questionCount ||
    decimalFields.some(
      (key) =>
        typeof b[key] !== "string" ||
        !/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(b[key]) ||
        !canonical(b[key]),
    )
  )
    review();
  const snapshot = app.executionConfiguration as Record<string, unknown>;
  const { timezone, passingThresholdUnit, ...values } = snapshot;
  let config;
  try {
    config = validateExamConfiguration(values);
  } catch {
    review();
  }
  if (
    timezone !== "Asia/Manila" ||
    passingThresholdUnit !== "PERCENT" ||
    !config.examDurationMinutes ||
    app.deadlineAt.getTime() !==
      app.actualStartedAt.getTime() + config.examDurationMinutes * 60_000 ||
    config.mcqPointsPerCorrectItem === null ||
    config.essayMaximumScore === null ||
    config.passingThreshold === null ||
    new ScoreDecimal(config.mcqPointsPerCorrectItem).toFixed() !==
      b.mcqPointsPerCorrectItem ||
    new ScoreDecimal(config.essayMaximumScore).toFixed() !== b.essayMaximum ||
    new ScoreDecimal(config.passingThreshold).toFixed() !== b.passingThreshold
  )
    review();
  const expected = calculatePoints(
    b.mcqCorrectCount,
    b.mcqQuestionCount,
    b.mcqPointsPerCorrectItem,
    b.essayScore,
    b.essayMaximum,
    b.passingThreshold,
  );
  if (
    Object.entries(expected).some(
      ([key, value]) => b[key as keyof ResultBasis] !== value,
    ) ||
    !new ScoreDecimal(score.multipleChoiceScore.toString()).eq(
      b.mcqEarnedPoints,
    ) ||
    !new ScoreDecimal(score.essayScore.toString()).eq(b.essayScore) ||
    !new ScoreDecimal(score.totalScore.toString()).eq(b.finalEarnedPoints)
  )
    review();
  return b;
}

export function completedResultStatus(
  app: ResultApplication,
): "PASSED" | "FAILED" | null {
  if (
    !(app.status === "PASSED" || app.status === "FAILED") ||
    app.score?.status !== app.status
  )
    return null;
  const managed = [
    app.actualStartedAt,
    app.deadlineAt,
    app.contentRevisionId,
    app.executionConfiguration,
    app.finalizedAt,
    app.finalizationReason,
    app.finalizationReceiptId,
    app.finalizationAnsweredCount,
    app.finalizationQuestionCount,
    app.score.essayEvaluatedAt,
    app.score.scoredAt,
    app.score.scoringBasis,
  ].some((value) => value != null);
  if (managed) {
    try {
      validatedResultBasis(app);
    } catch {
      return null;
    }
  }
  return app.status;
}

/** Public allowlist shared by Admin and Applicant; no hidden snapshot or key. */
export function resultProjection(app: ResultApplication) {
  const status = completedResultStatus(app);
  if (!status || !app.score) review();
  if (!app.score.scoringBasis)
    return {
      provenance: "LEGACY" as const,
      status: status.toLowerCase(),
      mcqScore: app.score.multipleChoiceScore?.toString() ?? null,
      essayScore: app.score.essayScore?.toString() ?? null,
      totalScore: app.score.totalScore?.toString() ?? null,
      mcqTotal: null,
      essayTotal: null,
      totalPossible: null,
      percentage: null,
      passingThreshold: null,
      mcqCorrectCount: null,
      mcqQuestionCount: null,
      scoredAt: null,
    };
  const b = validatedResultBasis(app);
  return {
    provenance: "B8" as const,
    status: status.toLowerCase(),
    mcqScore: b.mcqEarnedPoints,
    mcqTotal: b.mcqMaximumPoints,
    mcqCorrectCount: b.mcqCorrectCount,
    mcqQuestionCount: b.mcqQuestionCount,
    essayScore: b.essayScore,
    essayTotal: b.essayMaximum,
    totalScore: b.finalEarnedPoints,
    totalPossible: b.maximumPossiblePoints,
    percentage: new ScoreDecimal(b.finalEarnedPoints)
      .mul(100)
      .div(b.maximumPossiblePoints)
      .toFixed(2),
    passingThreshold: b.passingThreshold,
    scoredAt: app.score.scoredAt!.toISOString(),
  };
}
