/**
 * Pure defense workflow status rules.
 * APPLICATION.APPROVED != DEFENSE.PASSED.
 * Academic outcome is recorded only by formal conclusion (DefenseOutcome).
 * Only PASSED unlocks the next stage. REVISION_REQUIRED does not.
 */

export type ApplicationReviewStatus = "PENDING" | "APPROVED" | "REJECTED";
export type DefenseOutcomeStatus = "PASSED" | "REVISION_REQUIRED" | "FAILED";
export type DefenseSessionStatusName =
  | "UNSCHEDULED"
  | "SCHEDULED"
  | "IN_PROGRESS"
  | "AWAITING_CONCLUSION"
  | "CONCLUDED"
  | "CANCELLED";

/** Legacy overloaded ThesisStatus kept for compat/denormalized UI fields. */
export type ThesisStatusName =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "SCHEDULED"
  | "PASSED"
  | "FAILED"
  | "REVISION";

export function isApplicationReviewStatus(
  status: string,
): status is ApplicationReviewStatus {
  return status === "PENDING" || status === "APPROVED" || status === "REJECTED";
}

export function isDefenseOutcomeStatus(
  status: string,
): status is DefenseOutcomeStatus {
  return (
    status === "PASSED" ||
    status === "REVISION_REQUIRED" ||
    status === "FAILED"
  );
}

/** API conclusion body may use REVISION as alias of REVISION_REQUIRED. */
export function normalizeDefenseOutcome(
  raw: string | null | undefined,
): DefenseOutcomeStatus | null {
  if (!raw) return null;
  const v = String(raw).toUpperCase();
  if (v === "PASSED") return "PASSED";
  if (v === "FAILED") return "FAILED";
  if (v === "REVISION" || v === "REVISION_REQUIRED") return "REVISION_REQUIRED";
  return null;
}

/** Never treat an approved application as a passed defense. */
export function isStageUnlockedByPriorStatus(
  priorStatus: ThesisStatusName,
): boolean {
  return priorStatus === "PASSED";
}

/** Preferred: unlock from formal outcome, not overloaded status. */
export function isStageUnlockedByPriorOutcome(
  priorOutcome: DefenseOutcomeStatus | null | undefined,
): boolean {
  return priorOutcome === "PASSED";
}

export function canResubmitApplication(status: ThesisStatusName): boolean {
  return status === "REJECTED";
}

export function canApproveApplication(status: ThesisStatusName): boolean {
  return status === "PENDING";
}

/**
 * Application review endpoint may only move PENDING → APPROVED | REJECTED.
 * REJECTED → PENDING uses resubmit only. APPROVED / session / outcome states
 * are not rewritable through application review.
 */
export function canApplyReviewTransition(input: {
  currentStatus: string;
  nextStatus: string;
  hasActiveCurrentSession?: boolean;
  hasConclusion?: boolean;
  outcome?: string | null;
}): { allowed: boolean; reason?: string } {
  const current = String(input.currentStatus || "").toUpperCase();
  const next = String(input.nextStatus || "").toUpperCase();

  if (!canSetApplicationReviewStatus(next)) {
    return {
      allowed: false,
      reason:
        "Application review may only set PENDING, APPROVED, or REJECTED. Defense outcomes are recorded at conclusion.",
    };
  }

  // Locked once a live session or formal conclusion exists.
  if (input.hasConclusion || input.hasActiveCurrentSession) {
    return {
      allowed: false,
      reason:
        "Application review cannot change status after the defense is scheduled or concluded.",
    };
  }

  if (current === "PASSED" || current === "FAILED" || current === "REVISION") {
    return {
      allowed: false,
      reason:
        "Concluded defense outcomes cannot be changed through application review.",
    };
  }
  if (input.outcome) {
    return {
      allowed: false,
      reason:
        "Defense outcome is already recorded and cannot be changed through application review.",
    };
  }

  if (current === "SCHEDULED") {
    return {
      allowed: false,
      reason:
        "Scheduled applications cannot be rewritten through application review.",
    };
  }

  if (current === "PENDING") {
    if (next === "APPROVED" || next === "REJECTED") return { allowed: true };
    // PENDING → PENDING is a no-op rewrite; reject for strictness.
    return {
      allowed: false,
      reason: "PENDING applications may only be approved or rejected.",
    };
  }

  if (current === "REJECTED") {
    return {
      allowed: false,
      reason:
        "Rejected applications must use the resubmit endpoint to return to review.",
    };
  }

  if (current === "APPROVED") {
    return {
      allowed: false,
      reason:
        "Approved applications enter scheduling and cannot be rewritten through application review.",
    };
  }

  return {
    allowed: false,
    reason: `Invalid application review transition ${current} → ${next}.`,
  };
}

export function canScheduleApplication(status: ThesisStatusName): boolean {
  return status === "APPROVED";
}

/**
 * Application review may only write review statuses.
 * Defense outcomes are recorded exclusively via formal conclusion.
 */
export function canSetApplicationReviewStatus(
  next: string,
): next is ApplicationReviewStatus {
  return isApplicationReviewStatus(next);
}

export function canRecordDefenseOutcome(input: {
  alreadyConcluded: boolean;
  hasConclusionAuthority: boolean;
}): boolean {
  return !input.alreadyConcluded && input.hasConclusionAuthority;
}

export function validateTitleConclusionSelection(
  defenseType: string,
  selectedTitleId: string | null | undefined,
  thesisTitleIds: string[],
): { valid: boolean; error?: string } {
  if (defenseType !== "TITLE_DEFENSE") {
    return { valid: true };
  }
  if (!selectedTitleId) {
    return {
      valid: false,
      error:
        "Title Defense conclusion requires selecting an approved research title.",
    };
  }
  if (!thesisTitleIds.includes(selectedTitleId)) {
    return {
      valid: false,
      error: "Selected title must be one of the student's proposed titles.",
    };
  }
  return { valid: true };
}

/** Exactly one title may be selected after conclusion. */
export function applyWinningTitleFlags(
  titles: Array<{ id: string; isSelected: boolean }>,
  selectedTitleId: string,
): Array<{ id: string; isSelected: boolean }> {
  return titles.map((t) => ({
    id: t.id,
    isSelected: t.id === selectedTitleId,
  }));
}

export function isScoringComplete(
  evaluatorAssignments: number,
  submittedEvaluatorScores: number,
): boolean {
  return (
    evaluatorAssignments > 0 && submittedEvaluatorScores >= evaluatorAssignments
  );
}

export function canSubmitOralScore(
  role: string,
  evaluatorRoles: string[],
): boolean {
  return evaluatorRoles.includes(role);
}

/** Map legacy ThesisStatus outcome values to DefenseOutcome. */
export function mapLegacyStatusToOutcome(
  status: ThesisStatusName,
): DefenseOutcomeStatus | null {
  if (status === "PASSED") return "PASSED";
  if (status === "FAILED") return "FAILED";
  if (status === "REVISION") return "REVISION_REQUIRED";
  return null;
}
