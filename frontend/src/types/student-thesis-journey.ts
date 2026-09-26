/**
 * Student Thesis Journey frontend contract (WP7 / CP2).
 * Aligned with backend student-thesis-journey.rules.ts DTO.
 */

export type JourneyStepKey =
  | "TITLE_DEFENSE"
  | "ADVISER_REQUEST"
  | "PROPOSAL_DEFENSE"
  | "STRIKE"
  | "FINAL_DEFENSE";

export type JourneyStepState =
  | "COMPLETED"
  | "CURRENT"
  | "AVAILABLE"
  | "WAITING"
  | "LOCKED";

/** Precise administrative/session substatus under a coarse Journey state. */
export type DefenseSubstatus =
  | "NOT_SUBMITTED"
  | "APPLICATION_UNDER_REVIEW"
  | "APPROVED_WAITING_SCHEDULE"
  | "SCHEDULED"
  | "DEFENSE_IN_PROGRESS"
  | "AWAITING_CONCLUSION"
  | "FINALIZING_RECORDS"
  | "COMPLETED"
  | "REJECTED"
  | "CANCELLED_SESSION";

export interface DefenseSessionSummary {
  defenseType: "TITLE_DEFENSE" | "PROPOSAL_DEFENSE" | "FINAL_DEFENSE";
  defenseDate: string | null;
  defenseTime: string | null;
  venueOrLink: string | null;
  sessionStatus: string;
}

export interface JourneyStepView {
  key: JourneyStepKey;
  label: string;
  state: JourneyStepState;
  lockReason: string | null;
  nextAction: string | null;
  detail?: string | null;
  defenseStatus?: DefenseSubstatus | null;
  defenseSession?: DefenseSessionSummary | null;
}

export interface StudentThesisJourney {
  currentStep: JourneyStepKey | null;
  selectedTitle: { id: string; titleText: string } | null;
  activeAdviser: { userId: string; name: string } | null;
  adviserRequest: {
    id: string;
    status: string;
    adviserStatus: string;
    deanStatus: string;
    requestedAdviserId: string;
    requestedAdviserName: string;
  } | null;
  policy: {
    strikeRequired: boolean;
  };
  steps: JourneyStepView[];
}
