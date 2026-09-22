import type {
  ApplicationReviewStatus,
  DefenseOutcomeStatus,
} from "./defense-workflow.rules";
import {
  canRecordDefenseOutcome,
  isScoringComplete,
  normalizeDefenseOutcome,
  validateTitleConclusionSelection,
} from "./defense-workflow.rules";
import { AppError } from "../utils/AppError";

/**
 * Formal defense conclusion (source of truth §14).
 * Sole writer of academic outcome. Score completion never concludes a defense.
 *
 * Interim authorization (§14.4 OPEN_QUESTION): ADMIN only until the client
 * confirms Chairman / Dean / Rapporteur / attestation workflow. Never rely on UI.
 */
export const INTERIM_CONCLUDER_ROLES = ["ADMIN"] as const;

export interface ConclusionPreconditions {
  alreadyConcluded: boolean;
  actorRole: string;
  evaluatorAssignments: number;
  submittedEvaluatorScores: number;
  defenseType: string;
  selectedTitleId?: string | null;
  thesisTitleIds: string[];
}

export interface ConclusionPreconditionResult {
  ok: boolean;
  errors: string[];
  outcome: DefenseOutcomeStatus | null;
}

export function hasConclusionAuthority(actorRole: string): boolean {
  return (INTERIM_CONCLUDER_ROLES as readonly string[]).includes(actorRole);
}

export function validateConclusionPreconditions(
  input: ConclusionPreconditions,
  rawOutcome: string | null | undefined,
): ConclusionPreconditionResult {
  const errors: string[] = [];
  const outcome = normalizeDefenseOutcome(rawOutcome ?? "PASSED");

  if (!outcome) {
    errors.push(
      "Defense outcome must be PASSED, REVISION_REQUIRED (or REVISION), or FAILED.",
    );
  }

  if (!hasConclusionAuthority(input.actorRole)) {
    errors.push(
      "Only an authorized concluder may record the official defense outcome.",
    );
  }

  if (
    !canRecordDefenseOutcome({
      alreadyConcluded: input.alreadyConcluded,
      hasConclusionAuthority: hasConclusionAuthority(input.actorRole),
    })
  ) {
    if (input.alreadyConcluded) {
      errors.push("Defense has already been concluded.");
    }
  }

  if (
    !isScoringComplete(input.evaluatorAssignments, input.submittedEvaluatorScores)
  ) {
    errors.push(
      "All required evaluator scores must be submitted before formal conclusion.",
    );
  }

  if (outcome === "PASSED") {
    const titleCheck = validateTitleConclusionSelection(
      input.defenseType,
      input.selectedTitleId ?? null,
      input.thesisTitleIds,
    );
    if (!titleCheck.valid && titleCheck.error) {
      errors.push(titleCheck.error);
    }
  }

  return { ok: errors.length === 0, errors, outcome };
}

export class DefenseConclusionService {
  assertCanConclude(
    input: ConclusionPreconditions,
    rawOutcome: string | null | undefined,
  ): DefenseOutcomeStatus {
    const result = validateConclusionPreconditions(input, rawOutcome);
    if (!result.ok || !result.outcome) {
      const err = new AppError(result.errors.join(" "), 403) as AppError & {
        missing?: unknown;
      };
      // 400 when state preconditions fail and actor is authorized; 403 otherwise.
      const authFailed = !hasConclusionAuthority(input.actorRole) || input.alreadyConcluded;
      err.statusCode = authFailed ? 403 : 400;
      throw err;
    }
    return result.outcome;
  }
}
