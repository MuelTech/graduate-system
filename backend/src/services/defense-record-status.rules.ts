/**
 * UIUX-2M — Admin Defense Records: Record Status projection (pure).
 *
 * A stage-aware *UI completion* projection over EXISTING authoritative fields.
 * It is NOT a persisted lifecycle enum, it never rewrites DefenseSchedule
 * sessionStatus, and it never infers an academic result from scores, summary
 * readiness, session state, RAP status, or signature counts.
 *
 * Stage awareness:
 *   - Title Defense has no Group I/II numerical Oral Examination Criteria or
 *     numerical Oral Examination Summary, so those are NOT required.
 *   - Proposal/Final additionally require the applicable Oral Examination
 *     Summary before the record can be complete.
 *
 * Exact evaluator/signature counts are intentionally NOT fabricated here; only
 * fields the list read model actually exposes are used.
 */

export type DefenseRecordStatus =
  | "IN_PROGRESS"
  | "AWAITING_COMPLETION"
  | "COMPLETE";

export interface DefenseRecordStatusInput {
  defenseType: string;
  sessionStatus: string;
  formalResult: string | null;
  summaryReady: boolean;
  rapStatus: string | null;
}

export interface DefenseRecordStatusResult {
  status: DefenseRecordStatus;
  /** Short human-readable explanation (never an academic result). */
  detail: string;
}

function isTitleDefense(defenseType: string): boolean {
  return String(defenseType ?? "").toUpperCase() === "TITLE_DEFENSE";
}

function sessionStatusPhrase(sessionStatus: string): string {
  switch (String(sessionStatus ?? "").toUpperCase()) {
    case "SCHEDULED":
      return "Session scheduled";
    case "RESCHEDULED":
      return "Session rescheduled";
    case "IN_PROGRESS":
      return "Session in progress";
    case "AWAITING_CONCLUSION":
      return "Awaiting conclusion";
    case "CANCELLED":
      return "Session cancelled";
    case "UNSCHEDULED":
      return "Session not scheduled";
    default:
      return "Session not concluded";
  }
}

function rapStatusPhrase(rapStatus: string | null): string {
  switch (String(rapStatus ?? "").toUpperCase()) {
    case "DRAFT":
      return "RAP in draft";
    case "FOR_SIGNATURE":
      return "RAP awaiting signatures";
    case "PARTIALLY_SIGNED":
      return "RAP partially signed";
    case "DISTRIBUTED":
      return "RAP distributed";
    case "ALL_SIGNED":
      return "RAP signed — finalization pending";
    case "FINALIZED":
      return "RAP finalized";
    default:
      return "RAP not finalized";
  }
}

export function deriveDefenseRecordStatus(
  input: DefenseRecordStatusInput,
): DefenseRecordStatusResult {
  const session = String(input.sessionStatus ?? "").toUpperCase();
  const concluded =
    input.formalResult != null || session === "CONCLUDED";

  if (!concluded) {
    return {
      status: "IN_PROGRESS",
      detail: sessionStatusPhrase(input.sessionStatus),
    };
  }

  const rapFinalized =
    String(input.rapStatus ?? "").toUpperCase() === "FINALIZED";

  // Title Defense: no numerical evaluation/summary requirement.
  if (isTitleDefense(input.defenseType)) {
    return rapFinalized
      ? { status: "COMPLETE", detail: "Official record finalized" }
      : { status: "AWAITING_COMPLETION", detail: rapStatusPhrase(input.rapStatus) };
  }

  // Proposal / Final: summary AND finalized RAP required.
  const summaryReady = input.summaryReady === true;
  if (summaryReady && rapFinalized) {
    return { status: "COMPLETE", detail: "Official record finalized" };
  }
  if (!summaryReady && !rapFinalized) {
    return {
      status: "AWAITING_COMPLETION",
      detail: "Summary not ready · RAP not finalized",
    };
  }
  if (!summaryReady) {
    return { status: "AWAITING_COMPLETION", detail: "Summary not ready" };
  }
  return { status: "AWAITING_COMPLETION", detail: rapStatusPhrase(input.rapStatus) };
}
