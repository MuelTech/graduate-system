/**
 * GS-020 Student Adviser Request UI-state resolver (WP8).
 * Journey DTO is authoritative — no local ThesisRecord inference.
 */
import type { StudentThesisJourney } from "@/types/student-thesis-journey";

export type AdviserRequestUiState =
  | "LOADING"
  | "ERROR"
  | "LOCKED"
  | "APPROVED_ACTIVE"
  | "WAITING_ADVISER"
  | "WAITING_DEAN"
  | "DECLINED_RETRY"
  | "DEAN_REJECTED_RETRY"
  | "READY"
  | "UNEXPECTED";

export function resolveAdviserRequestUiState(input: {
  isLoading: boolean;
  isError: boolean;
  journey: StudentThesisJourney | undefined;
}): AdviserRequestUiState {
  if (input.isLoading) return "LOADING";
  if (input.isError || !input.journey) return "ERROR";

  const journey = input.journey;
  const step = journey.steps.find((s) => s.key === "ADVISER_REQUEST");
  if (step?.state === "LOCKED") return "LOCKED";

  // Active assignment always wins for completion presentation.
  if (journey.activeAdviser) return "APPROVED_ACTIVE";

  const req = journey.adviserRequest;
  if (req?.adviserStatus === "PENDING") return "WAITING_ADVISER";
  if (
    req?.adviserStatus === "CONFORMED" &&
    req.deanStatus === "PENDING"
  ) {
    return "WAITING_DEAN";
  }
  if (req?.adviserStatus === "DECLINED") return "DECLINED_RETRY";
  if (req?.deanStatus === "REJECTED") return "DEAN_REJECTED_RETRY";

  if (step?.state === "CURRENT" || step?.state === "AVAILABLE") return "READY";
  return "UNEXPECTED";
}

export function roleLabel(role: string): string {
  if (role === "CHAIRMAN") return "Chairman";
  if (role === "PANELIST") return "Panelist";
  // Defensive only — backend eligibility normally returns Chairman/Panelist only.
  return "Title Defense panel member";
}
