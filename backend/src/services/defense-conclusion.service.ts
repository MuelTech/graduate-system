/**
 * CP7 — Formal defense conclusion (Chairman academic authority).
 *
 * Sole writer of academic outcome. Score completion never concludes a defense.
 * Authorization is the session CHAIRMAN PanelAssignment — never account role alone.
 * No missing-outcome default. No score→PASS/FAIL. No outcome→OralRating mapping.
 */
import type {
  DefenseOutcomeStatus,
} from "./defense-workflow.rules";
import {
  normalizeDefenseOutcome,
  validateTitleConclusionSelection,
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
  selectedTitleId?: string | null;
  thesisTitleIds: string[];
  outcomeProvided: boolean;
}

export interface ConclusionPreconditionResult {
  ok: boolean;
  errors: string[];
  outcome: DefenseOutcomeStatus | null;
  statusCode: 400 | 403 | 409;
}

export function isSessionChairmanRole(role: string | null | undefined): boolean {
  return String(role ?? "").toUpperCase() === "CHAIRMAN";
}

/**
 * Explicit outcome is required. Missing outcome is a 400 — never defaults to PASSED.
 */
export function resolveExplicitOutcome(
  raw: string | null | undefined,
): DefenseOutcomeStatus | null {
  return normalizeDefenseOutcome(raw ?? null);
}

export function validateConclusionPreconditions(
  input: ConclusionPreconditions,
  rawOutcome: string | null | undefined,
): ConclusionPreconditionResult {
  const errors: string[] = [];
  let statusCode: 400 | 403 | 409 = 400;

  if (!input.outcomeProvided) {
    errors.push(
      "Defense outcome is required and must be PASSED, REVISION_REQUIRED (or REVISION), or FAILED.",
    );
    statusCode = 400;
    return { ok: false, errors, outcome: null, statusCode };
  }

  const outcome = resolveExplicitOutcome(rawOutcome);
  if (!outcome) {
    errors.push(
      "Defense outcome must be PASSED, REVISION_REQUIRED (or REVISION), or FAILED.",
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

  if (isTitle) {
    // 2026-10-04 Title correction: the Chairman records the panel-agreed result
    // independently of Rapporteur notes/RAP finalization. Title has no Group I/II
    // scoring, so evaluator completion and the Oral Exam Summary are not required.
    // Only require that the session has progressed past scheduling.
    const titleActiveStatuses = [
      "SCHEDULED",
      "IN_PROGRESS",
      "AWAITING_CONCLUSION",
    ];
    if (!titleActiveStatuses.includes(String(input.sessionStatus))) {
      errors.push(
        "Title Defense formal result may be recorded only after the defense has been scheduled/conducted.",
      );
      return { ok: false, errors, outcome: null, statusCode: 409 };
    }
  } else {
    if (String(input.sessionStatus) !== "AWAITING_CONCLUSION") {
      errors.push(
        "Formal conclusion requires the session to be awaiting conclusion.",
      );
      return { ok: false, errors, outcome: null, statusCode: 409 };
    }

    if (!input.rapporteurNotesFinalized) {
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
  }

  if (outcome === "PASSED" && isTitle) {
    const titleCheck = validateTitleConclusionSelection(
      input.defenseType,
      input.selectedTitleId ?? null,
      input.thesisTitleIds,
    );
    if (!titleCheck.valid && titleCheck.error) {
      errors.push(titleCheck.error);
      statusCode = 400;
    }
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
  ): DefenseOutcomeStatus {
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
  outcome: DefenseOutcomeStatus,
): DefenseOutcomeStatus {
  return outcome;
}
