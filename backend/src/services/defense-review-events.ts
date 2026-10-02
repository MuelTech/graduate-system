/**
 * DL-8: canonical Defense application review audit events.
 *
 * These action types are written by the Admin rejection/approval authority
 * operations and by the Student rejected-application resubmission transaction.
 * They are the only trustworthy persisted source for the Admin review timeline.
 */
export const DEFENSE_REVIEW_ACTIONS = {
  REJECT: "DEFENSE_APPLICATION_REJECT",
  APPROVE: "DEFENSE_APPLICATION_APPROVE",
  RESUBMIT: "DEFENSE_RESUBMIT",
} as const;

export type DefenseReviewAction =
  (typeof DEFENSE_REVIEW_ACTIONS)[keyof typeof DEFENSE_REVIEW_ACTIONS];

export const DEFENSE_REVIEW_ACTION_LIST: readonly string[] = [
  DEFENSE_REVIEW_ACTIONS.REJECT,
  DEFENSE_REVIEW_ACTIONS.APPROVE,
  DEFENSE_REVIEW_ACTIONS.RESUBMIT,
];

export interface DefenseResubmitReplacement {
  docType: string;
  supersededDocumentId: string | null;
  createdDocumentId: string;
}

export interface DefenseResubmitAuditPayload {
  stage?: string;
  previousRejectionReason?: string | null;
  replacements?: DefenseResubmitReplacement[];
  createdIds?: string[];
  supersededIds?: string[];
}

/**
 * Best-effort structured read of an AuditLog `newValue`. Never fabricates:
 * returns null when the value is absent or not a JSON object.
 */
export function parseAuditObject(
  raw: string | null | undefined,
): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}
