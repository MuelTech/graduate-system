/**
 * Student Thesis Journey frontend contract (WP7).
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

export interface JourneyStepView {
  key: JourneyStepKey;
  label: string;
  state: JourneyStepState;
  lockReason: string | null;
  nextAction: string | null;
  detail?: string | null;
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
