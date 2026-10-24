import type { ProposalAdviserReview } from "../types/proposal-adviser-review";

/** Shared stage-specific Adviser review endpoints and query keys. */
export type AdviserReviewStageKey = "PROPOSAL" | "FINAL";

export const adviserReviewsQueueQueryKey = [
  "panelist",
  "adviser-reviews",
] as const;

export function adviserReviewTaskQueryKey(
  stage: AdviserReviewStageKey,
  thesisId: string,
) {
  return ["panelist", "adviser-reviews", stage, thesisId] as const;
}

export function adviserReviewBasePath(stage: AdviserReviewStageKey): string {
  return stage === "FINAL"
    ? "/thesis/final-adviser-review/tasks"
    : "/thesis/proposal-adviser-review/tasks";
}

export function adviserReviewTaskPath(
  stage: AdviserReviewStageKey,
  thesisId: string,
): string {
  return `${adviserReviewBasePath(stage)}/${thesisId}`;
}

/** Exact task detail with the existing Final optional STRIKE fields. */
export interface AdviserReviewTaskDetail extends ProposalAdviserReview {
  stage?: AdviserReviewStageKey;
  strikeRequired?: boolean;
  strikeEligible?: boolean;
  actionBlockedReason?: string | null;
}

export function isFinalStrikeBlocked(
  stage: AdviserReviewStageKey,
  task: AdviserReviewTaskDetail | null | undefined,
): boolean {
  return (
    stage === "FINAL" &&
    task?.strikeRequired === true &&
    task?.strikeEligible !== true
  );
}

/** Acknowledgement belongs to the exact document shown at confirmation time. */
export function isCertificationConfirmationReady(input: {
  documentId: string | null; manuscriptTitle: string | null; originalFilename: string | null;
  confirmationDocumentId: string | null; acknowledgedDocumentId: string | null;
}): boolean {
  return Boolean(input.documentId && input.manuscriptTitle?.trim() && input.originalFilename?.trim()
    && input.confirmationDocumentId === input.documentId && input.acknowledgedDocumentId === input.documentId);
}
