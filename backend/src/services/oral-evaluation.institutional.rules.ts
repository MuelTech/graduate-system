/**
 * CDW-4 FIX — Institutional Individual Evaluation matrix rules.
 *
 * The supplied EARIST Individual Evaluation form rates each criterion on a fixed
 * six-level matrix (1.00–2.50). Group I and Group II each expose an AVERAGE.
 * There is no 2.25 level and no defined Overall formula yet, so this module
 * deliberately produces NO overall value and NO derived Rating.
 *
 * This is a SEPARATE model from the legacy 10/15-point rules
 * (`oral-evaluation.rules.ts`): legacy rows keep their original meaning and are
 * never reinterpreted into this scale. New evaluations are created as
 * INSTITUTIONAL_MATRIX_V2; existing rows remain LEGACY_POINTS_V1.
 */

import { GROUP_I_KEYS, GROUP_II_KEYS, type CriterionKey } from "./oral-evaluation.rules";

export const LEGACY_POINTS_V1 = "LEGACY_POINTS_V1" as const;
export const INSTITUTIONAL_MATRIX_V2 = "INSTITUTIONAL_MATRIX_V2" as const;

export type OralEvaluationScoringVersionValue =
  | typeof LEGACY_POINTS_V1
  | typeof INSTITUTIONAL_MATRIX_V2;

export interface InstitutionalRatingLevel {
  value: number;
  code: "E" | "HS" | "VS" | "S" | "BS" | "F";
  label: string;
}

/**
 * The exact institutional matrix. NOTE: the matrix jumps 2.00 → 2.50 (there is
 * NO 2.25); this is an institutional artifact and must be preserved verbatim.
 */
export const INSTITUTIONAL_RATING_SCALE: readonly InstitutionalRatingLevel[] = [
  { value: 1, code: "E", label: "Excellent" },
  { value: 1.25, code: "HS", label: "Highly Satisfactory" },
  { value: 1.5, code: "VS", label: "Very Satisfactory" },
  { value: 1.75, code: "S", label: "Satisfactory" },
  { value: 2, code: "BS", label: "Below Satisfactory" },
  { value: 2.5, code: "F", label: "Fail" },
] as const;

export const INSTITUTIONAL_RATING_VALUES = [1, 1.25, 1.5, 1.75, 2, 2.5] as const;

export type InstitutionalRatingValue = (typeof INSTITUTIONAL_RATING_VALUES)[number];

export const INSTITUTIONAL_CRITERION_KEYS = [
  ...GROUP_I_KEYS,
  ...GROUP_II_KEYS,
] as const satisfies readonly CriterionKey[];

export type InstitutionalCriteriaInput = Partial<
  Record<CriterionKey, number | string | null | undefined>
>;

function toFiniteNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (value === null || value === undefined) return Number.NaN;
  // Prisma Decimal (decimal.js) coerces through Number()/toString().
  return Number(value as never);
}

/** Exact membership in the six-level matrix (so 2.25/2.75/0/3 are rejected). */
export function isInstitutionalRatingValue(value: unknown): boolean {
  if (typeof value !== "number" || !Number.isFinite(value)) return false;
  return (INSTITUTIONAL_RATING_VALUES as readonly number[]).includes(value);
}

export function validateInstitutionalCriterionValue(
  key: CriterionKey,
  value: unknown,
): { ok: true; value: number | null } | { ok: false; reason: string } {
  if (value === null || value === undefined || value === "") {
    return { ok: true, value: null };
  }
  const n = toFiniteNumber(value);
  if (!isInstitutionalRatingValue(n)) {
    return {
      ok: false,
      reason: `${key} must be one of the institutional ratings (${INSTITUTIONAL_RATING_VALUES.join(
        ", ",
      )}).`,
    };
  }
  return { ok: true, value: n };
}

/**
 * Server-derived Group I / Group II AVERAGES.
 *
 * A group average is produced only when EVERY criterion in that group holds a
 * valid matrix value; a partial draft yields null for that group (the UI may show
 * a clearly-labelled incomplete local preview instead).
 *
 * There is intentionally NO Overall value here — the institutional Overall
 * formula is not yet confirmed and must not be guessed.
 */
export function calculateInstitutionalScores(
  criteria: InstitutionalCriteriaInput,
): { groupIAverage: number | null; groupIIAverage: number | null } {
  const averageOf = (keys: readonly CriterionKey[]): number | null => {
    const values: number[] = [];
    for (const key of keys) {
      const result = validateInstitutionalCriterionValue(key, criteria[key]);
      if (!result.ok || result.value === null) return null;
      values.push(result.value);
    }
    if (values.length === 0) return null;
    return values.reduce((a, b) => a + b, 0) / values.length;
  };
  return {
    groupIAverage: averageOf(GROUP_I_KEYS),
    groupIIAverage: averageOf(GROUP_II_KEYS),
  };
}

/**
 * Official finalization requires ALL nine criteria to hold valid matrix values.
 * A group-level average is never a substitute for per-criterion completeness.
 */
export function isInstitutionalEvaluationComplete(
  criteria: InstitutionalCriteriaInput,
): boolean {
  return INSTITUTIONAL_CRITERION_KEYS.every((key) => {
    const result = validateInstitutionalCriterionValue(key, criteria[key]);
    return result.ok && result.value !== null;
  });
}
