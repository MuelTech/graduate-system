/**
 * Pure defense workflow status rules.
 * APPROVED != PASSED. Only PASSED unlocks the next stage.
 */

export type ApplicationReviewStatus = "PENDING" | "APPROVED" | "REJECTED";
export type DefenseOutcomeStatus = "PASSED" | "REVISION" | "FAILED";
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
  return status === "PASSED" || status === "REVISION" || status === "FAILED";
}

/** Never treat an approved application as a passed defense. */
export function isStageUnlockedByPriorStatus(priorStatus: ThesisStatusName): boolean {
  return priorStatus === "PASSED";
}

export function canResubmitApplication(status: ThesisStatusName): boolean {
  return status === "REJECTED";
}

export function canApproveApplication(status: ThesisStatusName): boolean {
  return status === "PENDING";
}

export function canScheduleApplication(status: ThesisStatusName): boolean {
  return status === "APPROVED";
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
      error: "Title Defense conclusion requires selecting an approved research title.",
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
  return evaluatorAssignments > 0 && submittedEvaluatorScores >= evaluatorAssignments;
}

export function canSubmitOralScore(role: string, evaluatorRoles: string[]): boolean {
  return evaluatorRoles.includes(role);
}
