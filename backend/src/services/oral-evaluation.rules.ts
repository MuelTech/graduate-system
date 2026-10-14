/**
 * CP5 / CP5-FIX1 — Proposal/Final evaluator evaluation pure rules.
 * Title Defense does not use Group I/II numerical evaluation.
 */
import { DefenseCommitteePolicy } from "./defense-committee.policy";

export type OralEvaluationStatusName = "DRAFT" | "FINALIZED";

const committeePolicy = new DefenseCommitteePolicy();

/** Centralized evaluator-role authority (DefenseCommitteePolicy). */
export function isEvaluatorRole(role: string | null | undefined): boolean {
  return committeePolicy.isEvaluatorRole("PROPOSAL_DEFENSE", role as never);
}

/** Evaluation mutations only while session is in the evaluation phase. */
/** CP5-FIX1: count FINALIZED rows only for evaluator assignment IDs. */
export function countEvaluatorFinalized(
  evaluatorAssignmentIds: string[],
  scores: Array<{ panelId: string; status: string }>,
): number {
  const set = new Set(evaluatorAssignmentIds);
  return scores.filter((s) => s.status === "FINALIZED" && set.has(s.panelId))
    .length;
}

export function isSessionEditableForEvaluation(
  sessionStatus: string | null | undefined,
): boolean {
  return sessionStatus === "SCHEDULED" || sessionStatus === "IN_PROGRESS";
}

export function assertEvaluationSessionEditable(
  sessionStatus: string | null | undefined,
): { ok: true } | { ok: false; reason: string; statusCode: number } {
  if (isSessionEditableForEvaluation(sessionStatus)) return { ok: true };
  return {
    ok: false,
    reason: "Evaluation editing is closed for this defense session.",
    statusCode: 409,
  };
}

export const CRITERION_LIMITS = {
  timelinessRelevance: 10,
  organization: 10,
  depthComprehensiveness: 15,
  relevanceConclusions: 10,
  evidenceOriginalThinking: 15,
  presentation: 10,
  masterySubject: 10,
  communicationSkill: 10,
  attitude: 10,
} as const;

export type CriterionKey = keyof typeof CRITERION_LIMITS;

export const GROUP_I_KEYS = [
  "timelinessRelevance",
  "organization",
  "depthComprehensiveness",
  "relevanceConclusions",
  "evidenceOriginalThinking",
] as const satisfies readonly CriterionKey[];

export const GROUP_II_KEYS = [
  "presentation",
  "masterySubject",
  "communicationSkill",
  "attitude",
] as const satisfies readonly CriterionKey[];

export type CriteriaInput = Partial<Record<CriterionKey, number | string | null>>;

/**
 * CP5-FIX1: merge partial Draft patches.
 * Absent property → keep existing; present null → clear; present value → replace.
 */
export function mergePartialCriteria(
  existing: CriteriaInput | null | undefined,
  patch: CriteriaInput | null | undefined,
): CriteriaInput {
  const base: CriteriaInput = { ...(existing ?? {}) };
  const p = patch ?? {};
  for (const key of Object.keys(CRITERION_LIMITS) as CriterionKey[]) {
    if (Object.prototype.hasOwnProperty.call(p, key)) {
      base[key] = p[key] ?? null;
    } else if (!(key in base)) {
      base[key] = null;
    }
  }
  return base;
}

/** Preserve existing rating when patch omits the property. */
export function mergeOptionalField<T>(
  existing: T | null | undefined,
  patch: { hasOwnProperty(prop: string): boolean } & Record<string, unknown>,
  field: string,
): T | null {
  if (Object.prototype.hasOwnProperty.call(patch, field)) {
    return (patch[field] ?? null) as T | null;
  }
  return existing ?? null;
}

export function isNumericalEvaluationDefense(defenseType: string | null | undefined): boolean {
  return defenseType === "PROPOSAL_DEFENSE" || defenseType === "FINAL_DEFENSE";
}

export function validateCriterionValue(
  key: CriterionKey,
  value: number | string | null | undefined,
): { ok: true; value: number | null } | { ok: false; reason: string } {
  if (value === null || value === undefined || value === "") {
    return { ok: true, value: null };
  }
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) {
    return { ok: false, reason: `${key} must be a finite number.` };
  }
  if (n < 0) {
    return { ok: false, reason: `${key} cannot be negative.` };
  }
  const max = CRITERION_LIMITS[key];
  if (n > max) {
    return { ok: false, reason: `${key} cannot exceed ${max}.` };
  }
  return { ok: true, value: n };
}

/**
 * Server-derived values (column names keep legacy *Average meaning — point subtotals).
 * Group I = sum of Group I criteria; Group II = sum of Group II; Overall = both.
 */
export function calculateEvaluationScores(criteria: CriteriaInput): {
  groupIValue: number | null;
  groupIIValue: number | null;
  overallValue: number | null;
} {
  const sumOf = (keys: readonly CriterionKey[]): number | null => {
    let sum = 0;
    let any = false;
    for (const k of keys) {
      const raw = criteria[k];
      if (raw === null || raw === undefined || raw === "") continue;
      const n = typeof raw === "number" ? raw : Number(raw);
      if (!Number.isFinite(n)) continue;
      sum += n;
      any = true;
    }
    return any ? sum : null;
  };
  const g1 = sumOf(GROUP_I_KEYS);
  const g2 = sumOf(GROUP_II_KEYS);
  return {
    groupIValue: g1,
    groupIIValue: g2,
    overallValue: g1 === null && g2 === null ? null : (g1 ?? 0) + (g2 ?? 0),
  };
}

export function areAllCriteriaComplete(criteria: CriteriaInput): boolean {
  return (Object.keys(CRITERION_LIMITS) as CriterionKey[]).every((k) => {
    const raw = criteria[k];
    return raw !== null && raw !== undefined && raw !== "";
  });
}

export function canEditEvaluation(status: string | null | undefined): boolean {
  return status !== "FINALIZED";
}

export function canFinalizeEvaluation(input: {
  status: string | null | undefined;
  criteriaComplete: boolean;
  signaturePresent: boolean;
}): { allowed: true } | { allowed: false; reason: string; statusCode: number } {
  if (input.status === "FINALIZED") {
    return {
      allowed: false,
      reason: "Evaluation is already finalized.",
      statusCode: 409,
    };
  }
  if (!input.criteriaComplete) {
    return {
      allowed: false,
      reason: "All evaluation criteria are required before finalization.",
      statusCode: 400,
    };
  }
  if (!input.signaturePresent) {
    return {
      allowed: false,
      reason: "Evaluator e-signature is required to finalize this evaluation.",
      statusCode: 400,
    };
  }
  return { allowed: true };
}

export const VALID_ORAL_RATINGS = ["E", "HS", "VS", "S", "BS", "F"] as const;

export function isValidOralRating(rating: string | null | undefined): boolean {
  return (VALID_ORAL_RATINGS as readonly string[]).includes(String(rating ?? ""));
}

/** Evaluation completion for conclusion: TITLE skips numerical scores. */
export function isNumericalEvaluationComplete(
  defenseType: string,
  evaluatorAssignments: number,
  finalizedEvaluations: number,
): boolean {
  if (defenseType === "TITLE_DEFENSE") return true;
  return evaluatorAssignments > 0 && finalizedEvaluations >= evaluatorAssignments;
}
