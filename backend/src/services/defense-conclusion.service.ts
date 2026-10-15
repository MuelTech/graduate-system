/**
 * CP7 — Formal defense conclusion (Chairman academic authority).
 *
 * Sole writer of academic outcome. Score completion never concludes a defense.
 * Authorization is the session CHAIRMAN PanelAssignment — never account role alone.
 * No missing-outcome default. No score→PASS/FAIL. No outcome→OralRating mapping.
 */
import type {
  CanonicalDefenseOutcome,
} from "./defense-workflow.rules";
import {
  normalizeNewDefenseOutcome,
} from "./defense-workflow.rules";
import { AppError } from "../utils/AppError";

/** Account-level route protection only. Session CHAIRMAN assignment is authoritative. */
export const CONCLUDER_ACCOUNT_ROLES = ["PANELIST", "ADMIN"] as const;

export interface ConclusionPreconditions {
  alreadyConcluded: boolean;
  /** Session PanelAssignment role of the authenticated user (CHAIRMAN / PANELIST / …). */
  sessionRole: string | null;
  isSessionChairman: boolean;
  evaluatorAssignments: number;
  finalizedEvaluatorScores: number;
  defenseType: string;
  sessionStatus: string;
  rapporteurNotesFinalized: boolean;
  oralSummaryExists: boolean;
  outcomeProvided: boolean;
}

export interface ConclusionPreconditionResult {
  ok: boolean;
  errors: string[];
  outcome: CanonicalDefenseOutcome | null;
  statusCode: 400 | 403 | 409;
}

export function isSessionChairmanRole(role: string | null | undefined): boolean {
  return String(role ?? "").toUpperCase() === "CHAIRMAN";
}

/**
 * Explicit outcome is required. Missing outcome is a 400 — never defaults to PASSED.
 * New conclusions accept only the canonical verdicts PASSED / REDEFENSE_REQUIRED.
 */
export function resolveExplicitOutcome(
  raw: string | null | undefined,
): CanonicalDefenseOutcome | null {
  return normalizeNewDefenseOutcome(raw ?? null);
}

export function validateConclusionPreconditions(
  input: ConclusionPreconditions,
  rawOutcome: string | null | undefined,
): ConclusionPreconditionResult {
  const errors: string[] = [];
  let statusCode: 400 | 403 | 409 = 400;

  if (!input.outcomeProvided) {
    errors.push(
      "Defense outcome is required and must be PASSED or REDEFENSE_REQUIRED.",
    );
    statusCode = 400;
    return { ok: false, errors, outcome: null, statusCode };
  }

  const outcome = resolveExplicitOutcome(rawOutcome);
  if (!outcome) {
    errors.push(
      "Defense outcome must be PASSED or REDEFENSE_REQUIRED.",
    );
    return { ok: false, errors, outcome: null, statusCode: 400 };
  }

  // Authorization: session CHAIRMAN assignment only.
  if (!input.isSessionChairman) {
    errors.push(
      "Only the assigned session Chairman may record the formal academic result.",
    );
    return { ok: false, errors, outcome: null, statusCode: 403 };
  }

  if (input.alreadyConcluded) {
    errors.push("Defense has already been concluded.");
    return { ok: false, errors, outcome: null, statusCode: 409 };
  }

  const isTitle = String(input.defenseType) === "TITLE_DEFENSE";

  // WF-C1b: every stage — including Title — may be formally concluded only from
  // the awaiting-conclusion phase. Title reaches that phase once all required
  // evaluators have finalized and the Oral Examination Summary is generated.
  if (String(input.sessionStatus) !== "AWAITING_CONCLUSION") {
    errors.push(
      "Formal conclusion requires the session to be awaiting conclusion.",
    );
    return { ok: false, errors, outcome: null, statusCode: 409 };
  }

  // Proposal/Final additionally require finalized Rapporteur notes. Title does
  // not yet — RAP-before-conclusion is deferred to WF-C1c.
  if (!isTitle && !input.rapporteurNotesFinalized) {
    errors.push(
      "Rapporteur defense notes must be finalized before the formal academic result can be recorded.",
    );
    statusCode = 409;
  }

  if (
    input.evaluatorAssignments <= 0 ||
    input.finalizedEvaluatorScores < input.evaluatorAssignments
  ) {
    errors.push(
      "All required evaluator evaluations must be finalized before formal conclusion.",
    );
    statusCode = 409;
  }
  if (!input.oralSummaryExists) {
    errors.push(
      "Oral Examination Summary must be generated from finalized evaluator records before formal conclusion.",
    );
    statusCode = 409;
  }

  return { ok: errors.length === 0, errors, outcome, statusCode };
}

export class DefenseConclusionService {
  /**
   * Validate conclusion readiness and explicit outcome.
   * Throws AppError with 400 / 403 / 409 — never defaults missing outcome to PASSED.
   */
  assertCanConclude(
    input: ConclusionPreconditions,
    rawOutcome: string | null | undefined,
  ): CanonicalDefenseOutcome {
    const result = validateConclusionPreconditions(input, rawOutcome);
    if (!result.ok || !result.outcome) {
      throw new AppError(result.errors.join(" "), result.statusCode);
    }
    return result.outcome;
  }
}

/**
 * Formal outcome is independent of numeric score.
 * Never map outcome → OralRating. Never infer PASS/FAIL from averages.
 */
export function assertOutcomeIndependentOfScore(
  _overallAverage: number | null | undefined,
  outcome: CanonicalDefenseOutcome,
): CanonicalDefenseOutcome {
  return outcome;
}
