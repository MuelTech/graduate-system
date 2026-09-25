/**
 * Shared expected Journey states for WP6 fixtures (default STRIKE policy OFF).
 * Used by verify-journey-fixtures and focused tests — single source of truth.
 */
export type JourneyFixtureKey =
  | "TITLE_READY"
  | "TITLE_PENDING"
  | "TITLE_PASSED_NO_ADVISER"
  | "ADVISER_PENDING"
  | "ADVISER_CONFORMED_WAITING_DEAN"
  | "ADVISER_APPROVED"
  | "PROPOSAL_READY"
  | "PROPOSAL_PASSED"
  | "STRIKE_READY"
  | "STRIKE_ELIGIBLE"
  | "FINAL_READY"
  | "FINAL_PASSED";

export type StepKey =
  | "TITLE_DEFENSE"
  | "ADVISER_REQUEST"
  | "PROPOSAL_DEFENSE"
  | "STRIKE"
  | "FINAL_DEFENSE";

export type StepState =
  | "COMPLETED"
  | "CURRENT"
  | "AVAILABLE"
  | "WAITING"
  | "LOCKED";

export interface JourneyFixtureExpectation {
  currentStep: StepKey | null;
  steps: Record<StepKey, StepState>;
}

export const JOURNEY_FIXTURE_EXPECTATIONS: Record<
  JourneyFixtureKey,
  JourneyFixtureExpectation
> = {
  TITLE_READY: {
    currentStep: "TITLE_DEFENSE",
    steps: {
      TITLE_DEFENSE: "CURRENT",
      ADVISER_REQUEST: "LOCKED",
      PROPOSAL_DEFENSE: "LOCKED",
      STRIKE: "LOCKED",
      FINAL_DEFENSE: "LOCKED",
    },
  },
  TITLE_PENDING: {
    currentStep: "TITLE_DEFENSE",
    steps: {
      TITLE_DEFENSE: "WAITING",
      ADVISER_REQUEST: "LOCKED",
      PROPOSAL_DEFENSE: "LOCKED",
      STRIKE: "LOCKED",
      FINAL_DEFENSE: "LOCKED",
    },
  },
  TITLE_PASSED_NO_ADVISER: {
    currentStep: "ADVISER_REQUEST",
    steps: {
      TITLE_DEFENSE: "COMPLETED",
      ADVISER_REQUEST: "CURRENT",
      PROPOSAL_DEFENSE: "LOCKED",
      STRIKE: "LOCKED",
      FINAL_DEFENSE: "LOCKED",
    },
  },
  ADVISER_PENDING: {
    currentStep: "ADVISER_REQUEST",
    steps: {
      TITLE_DEFENSE: "COMPLETED",
      ADVISER_REQUEST: "WAITING",
      PROPOSAL_DEFENSE: "LOCKED",
      STRIKE: "LOCKED",
      FINAL_DEFENSE: "LOCKED",
    },
  },
  ADVISER_CONFORMED_WAITING_DEAN: {
    currentStep: "ADVISER_REQUEST",
    steps: {
      TITLE_DEFENSE: "COMPLETED",
      ADVISER_REQUEST: "WAITING",
      PROPOSAL_DEFENSE: "LOCKED",
      STRIKE: "LOCKED",
      FINAL_DEFENSE: "LOCKED",
    },
  },
  ADVISER_APPROVED: {
    currentStep: "PROPOSAL_DEFENSE",
    steps: {
      TITLE_DEFENSE: "COMPLETED",
      ADVISER_REQUEST: "COMPLETED",
      PROPOSAL_DEFENSE: "CURRENT",
      STRIKE: "LOCKED",
      FINAL_DEFENSE: "LOCKED",
    },
  },
  PROPOSAL_READY: {
    currentStep: "PROPOSAL_DEFENSE",
    steps: {
      TITLE_DEFENSE: "COMPLETED",
      ADVISER_REQUEST: "COMPLETED",
      PROPOSAL_DEFENSE: "CURRENT",
      STRIKE: "LOCKED",
      FINAL_DEFENSE: "LOCKED",
    },
  },
  PROPOSAL_PASSED: {
    currentStep: "FINAL_DEFENSE",
    steps: {
      TITLE_DEFENSE: "COMPLETED",
      ADVISER_REQUEST: "COMPLETED",
      PROPOSAL_DEFENSE: "COMPLETED",
      STRIKE: "COMPLETED",
      FINAL_DEFENSE: "CURRENT",
    },
  },
  STRIKE_READY: {
    currentStep: "FINAL_DEFENSE",
    steps: {
      TITLE_DEFENSE: "COMPLETED",
      ADVISER_REQUEST: "COMPLETED",
      PROPOSAL_DEFENSE: "COMPLETED",
      STRIKE: "COMPLETED",
      FINAL_DEFENSE: "CURRENT",
    },
  },
  STRIKE_ELIGIBLE: {
    currentStep: "FINAL_DEFENSE",
    steps: {
      TITLE_DEFENSE: "COMPLETED",
      ADVISER_REQUEST: "COMPLETED",
      PROPOSAL_DEFENSE: "COMPLETED",
      STRIKE: "COMPLETED",
      FINAL_DEFENSE: "CURRENT",
    },
  },
  FINAL_READY: {
    currentStep: "FINAL_DEFENSE",
    steps: {
      TITLE_DEFENSE: "COMPLETED",
      ADVISER_REQUEST: "COMPLETED",
      PROPOSAL_DEFENSE: "COMPLETED",
      STRIKE: "COMPLETED",
      FINAL_DEFENSE: "CURRENT",
    },
  },
  FINAL_PASSED: {
    currentStep: null,
    steps: {
      TITLE_DEFENSE: "COMPLETED",
      ADVISER_REQUEST: "COMPLETED",
      PROPOSAL_DEFENSE: "COMPLETED",
      STRIKE: "COMPLETED",
      FINAL_DEFENSE: "COMPLETED",
    },
  },
};

/** Policy ON expectations for STRIKE fixtures. */
export const STRIKE_POLICY_ON_EXPECTATIONS: Record<
  "STRIKE_READY" | "STRIKE_ELIGIBLE",
  Pick<JourneyFixtureExpectation, "currentStep"> & {
    steps: Partial<Record<StepKey, StepState>>;
  }
> = {
  STRIKE_READY: {
    currentStep: "STRIKE",
    steps: {
      STRIKE: "CURRENT",
      FINAL_DEFENSE: "LOCKED",
    },
  },
  STRIKE_ELIGIBLE: {
    currentStep: "FINAL_DEFENSE",
    steps: {
      STRIKE: "COMPLETED",
      FINAL_DEFENSE: "CURRENT",
    },
  },
};

export const JOURNEY_FIXTURE_KEYS = Object.keys(
  JOURNEY_FIXTURE_EXPECTATIONS,
) as JourneyFixtureKey[];
