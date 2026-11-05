import type { ExamResultDecision, Prisma } from "@prisma/client";
import { AppError } from "../utils/AppError";
import {
  validatedResultBasis,
  type ResultApplication,
} from "./exam-result.rules";

type DecisionApplication = ResultApplication & {
  score: (NonNullable<ResultApplication["score"]> & { id: string }) | null;
  resultDecision?: ExamResultDecision | null;
};

/** Validates a separate decision. It never changes the original B8 computation. */
export function validatedInstitutionalDecision(app: DecisionApplication) {
  const d = app.resultDecision;
  const basis = validatedResultBasis(app);
  if (
    !d ||
    basis.result !== "FAILED" ||
    app.status !== "FAILED" ||
    app.score?.status !== "FAILED" ||
    d.decision !== "PASSED_RECONSIDERED" ||
    d.applicationId !== app.id ||
    d.scoreId !== app.score.id ||
    typeof d.reason !== "string" ||
    !d.reason.trim() ||
    d.reason.length > 2000 ||
    !d.decidedById ||
    !(d.decidedAt instanceof Date) ||
    !Number.isFinite(d.decidedAt.getTime()) ||
    d.decidedAt < app.score.scoredAt!
  ) {
    throw new AppError(
      "Institutional decision evidence requires staff review.",
      409,
    );
  }
  return d;
}

/** Ordinary recorded PASSED compatibility remains; reconsidered passes require B8 validation. */
export function hasEffectiveExamPass<
  T extends { status: string; resultDecision?: unknown },
>(app: T) {
  if (app.status === "PASSED") return true;
  if (!app.resultDecision) return false;
  try {
    validatedInstitutionalDecision(app as unknown as DecisionApplication);
    return true;
  } catch {
    return false;
  }
}

export function institutionalProjection(app: DecisionApplication) {
  const decision = app.resultDecision
    ? validatedInstitutionalDecision(app)
    : null;
  return {
    computedStatus: app.status.toLowerCase(),
    effectiveStatus: decision
      ? "passed_reconsidered"
      : app.status.toLowerCase(),
    institutionalDecision: decision
      ? {
          decision: decision.decision,
          decidedAt: decision.decidedAt.toISOString(),
        }
      : null,
  };
}

/** Called inside the COR transaction as well as its preliminary eligibility read. */
export async function findEffectivePassedExam(
  db: Prisma.TransactionClient,
  studentId: string,
) {
  const passed = await db.entranceExamApplication.findFirst({
    where: { studentId, status: "PASSED" },
  });
  if (passed) return passed;
  const candidates = await db.entranceExamApplication.findMany({
    where: { studentId, resultDecision: { isNot: null } },
    include: { score: true, resultDecision: true },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
  return candidates.find((app) => hasEffectiveExamPass(app)) ?? null;
}

/** Only decision-bearing candidates require full evidence; legacy PASSED uses the existing query. */
export async function validReconsideredApplicationIds(
  db: Prisma.TransactionClient,
) {
  const decisions = await db.examResultDecision.findMany({
    include: { application: { include: { score: true } } },
  });
  return decisions
    .filter((d) =>
      hasEffectiveExamPass({ ...d.application, resultDecision: d }),
    )
    .map((d) => d.applicationId);
}
