/**
 * CDW-LIVE-1A — shared report-body edit authority.
 *
 * The Committee Report has exactly one writer (the exact assigned Rapporteur).
 * Both the REST write path and the ephemeral live-preview transport use this
 * rule so the two can never drift.
 */

export const REPORT_WRITABLE_SESSION_STATUSES = [
  "SCHEDULED",
  "IN_PROGRESS",
  "AWAITING_CONCLUSION",
] as const;

/**
 * FIX-6: the Committee Report may be finalized for signatures only after the
 * defense has started and before the attempt is concluded/cancelled. SCHEDULED
 * remains pre-defense collaboration/authoring time and cannot create signing
 * obligations.
 */
export const REPORT_FINALIZATION_SESSION_STATUSES = [
  "IN_PROGRESS",
  "AWAITING_CONCLUSION",
] as const;

export const FROZEN_REPORT_STATUSES = [
  "FOR_SIGNATURE",
  "PARTIALLY_SIGNED",
  "ALL_SIGNED",
  "DISTRIBUTED",
  "FINALIZED",
] as const;

export function isCollaborationWritableStatus(status: string): boolean {
  return (REPORT_WRITABLE_SESSION_STATUSES as readonly string[]).includes(status);
}

/** FIX-6: report finalization/signing requires an active pre-conclusion session. */
export function isReportFinalizationStatus(status: string): boolean {
  return (REPORT_FINALIZATION_SESSION_STATUSES as readonly string[]).includes(status);
}

export interface ReportBodyEditAuthorityInput {
  sessionStatus: string;
  role: string | null | undefined;
  rapStatus: string | null | undefined;
  rapFrozenAt: Date | string | null | undefined;
}

/**
 * True only for the exact assigned Rapporteur while the session is writable and
 * the report is either absent (first-save authoring) or an unfrozen DRAFT.
 */
export function isReportBodyEditable(input: ReportBodyEditAuthorityInput): boolean {
  if (String(input.role) !== "RAPPORTEUR") return false;
  if (!isCollaborationWritableStatus(String(input.sessionStatus))) return false;

  if (input.rapStatus === null || input.rapStatus === undefined) {
    return input.rapFrozenAt === null || input.rapFrozenAt === undefined;
  }

  return String(input.rapStatus) === "DRAFT" && !input.rapFrozenAt;
}
