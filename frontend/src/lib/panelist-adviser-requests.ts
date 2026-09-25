/**
 * Panelist requested-Adviser inbox DTO (WP9).
 * Matches backend AdviserRequestService.listMyAdviserRequests.
 */
export interface PanelistAdviserRequestDto {
  id: string;
  student: {
    id: string;
    name: string;
    studentNumber: string | null;
    program: string | null;
  };
  officialTitle: string | null;
  sourceDefenseScheduleId: string | null;
  titleDefenseRole: string | null;
  reason: string | null;
  requestDate: string;
  status: string;
  adviserStatus: string;
  adviserRespondedAt: string | null;
  adviserRemarks: string | null;
  deanStatus: string;
  deanReviewedAt: string | null;
  deanRemarks: string | null;
}

export type PanelistRequestUiState =
  | "ACTIONABLE"
  | "CONFORMED_WAITING_DEAN"
  | "DECLINED"
  | "CONFORMED_DEAN_APPROVED"
  | "CONFORMED_DEAN_REJECTED";

export const panelistAdviserRequestsQueryKey = [
  "panelist",
  "adviser",
  "requests",
] as const;

export function resolvePanelistRequestUiState(
  row: Pick<PanelistAdviserRequestDto, "adviserStatus" | "deanStatus">,
): PanelistRequestUiState {
  if (row.adviserStatus === "PENDING") return "ACTIONABLE";
  if (row.adviserStatus === "DECLINED") return "DECLINED";
  if (row.adviserStatus === "CONFORMED" && row.deanStatus === "PENDING") {
    return "CONFORMED_WAITING_DEAN";
  }
  if (row.adviserStatus === "CONFORMED" && row.deanStatus === "APPROVED") {
    return "CONFORMED_DEAN_APPROVED";
  }
  if (row.adviserStatus === "CONFORMED" && row.deanStatus === "REJECTED") {
    return "CONFORMED_DEAN_REJECTED";
  }
  return "CONFORMED_WAITING_DEAN";
}

export function titleDefenseRoleLabel(role: string | null): string {
  if (role === "CHAIRMAN") return "Chairman";
  if (role === "PANELIST") return "Panelist";
  return "Title Defense panel member";
}

export function requestStatusLabel(state: PanelistRequestUiState): string {
  switch (state) {
    case "ACTIONABLE":
      return "Awaiting your response";
    case "CONFORMED_WAITING_DEAN":
      return "CONFORME recorded";
    case "DECLINED":
      return "Declined";
    case "CONFORMED_DEAN_APPROVED":
      return "Approved by Dean";
    case "CONFORMED_DEAN_REJECTED":
      return "Rejected by Dean";
  }
}
