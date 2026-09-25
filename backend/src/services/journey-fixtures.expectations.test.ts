import { describe, expect, it } from "vitest";
import {
  evaluateStudentThesisJourney,
  type JourneySnapshot,
} from "./student-thesis-journey.rules";
import {
  JOURNEY_FIXTURE_EXPECTATIONS,
  JOURNEY_FIXTURE_KEYS,
  STRIKE_POLICY_ON_EXPECTATIONS,
} from "./journey-fixture-expectations";

function snap(partial: Partial<JourneySnapshot>): JourneySnapshot {
  return {
    compExamPassed: true,
    titlePassed: false,
    selectedTitleId: null,
    selectedTitleText: null,
    titleAdminState: "NONE",
    adviserRequest: null,
    activeAdviser: null,
    proposalPassed: false,
    proposalAdminState: "NONE",
    strikeEligible: false,
    strikeRequired: false,
    finalPassed: false,
    finalAdminState: "NONE",
    ...partial,
  };
}

const titleReady = {
  titlePassed: true,
  selectedTitleId: "t",
  selectedTitleText: "Official",
} as const;
const adviserReady = {
  ...titleReady,
  activeAdviser: { userId: "a", name: "Adviser" },
} as const;

const SNAPSHOT_BY_FIXTURE: Record<string, JourneySnapshot> = {
  TITLE_READY: snap({ titleAdminState: "NONE" }),
  TITLE_PENDING: snap({ titleAdminState: "SUBMITTED" }),
  TITLE_PASSED_NO_ADVISER: snap({ ...titleReady }),
  ADVISER_PENDING: snap({
    ...titleReady,
    adviserRequest: {
      id: "r",
      status: "PENDING",
      adviserStatus: "PENDING",
      deanStatus: "PENDING",
      requestedAdviserId: "a",
      requestedAdviserName: "A",
    },
  }),
  ADVISER_CONFORMED_WAITING_DEAN: snap({
    ...titleReady,
    adviserRequest: {
      id: "r",
      status: "PENDING",
      adviserStatus: "CONFORMED",
      deanStatus: "PENDING",
      requestedAdviserId: "a",
      requestedAdviserName: "A",
    },
  }),
  ADVISER_APPROVED: snap({ ...adviserReady }),
  PROPOSAL_READY: snap({ ...adviserReady, proposalAdminState: "NONE" }),
  PROPOSAL_PASSED: snap({
    ...adviserReady,
    proposalPassed: true,
    strikeRequired: false,
  }),
  STRIKE_READY: snap({
    ...adviserReady,
    proposalPassed: true,
    strikeRequired: false,
    strikeEligible: false,
  }),
  STRIKE_ELIGIBLE: snap({
    ...adviserReady,
    proposalPassed: true,
    strikeRequired: true,
    strikeEligible: true,
  }),
  FINAL_READY: snap({
    ...adviserReady,
    proposalPassed: true,
    strikeRequired: true,
    strikeEligible: true,
    finalAdminState: "NONE",
  }),
  FINAL_PASSED: snap({
    ...adviserReady,
    proposalPassed: true,
    strikeRequired: true,
    strikeEligible: true,
    finalPassed: true,
  }),
};

describe("WP6 fixture Journey expectations (shared manifest)", () => {
  it("defines all 12 required scenarios", () => {
    expect(JOURNEY_FIXTURE_KEYS).toHaveLength(12);
  });

  it("matches evaluator states for every required fixture", () => {
    for (const key of JOURNEY_FIXTURE_KEYS) {
      const expected = JOURNEY_FIXTURE_EXPECTATIONS[key];
      const dto = evaluateStudentThesisJourney(SNAPSHOT_BY_FIXTURE[key]);
      expect(dto.currentStep, key).toBe(expected.currentStep);
      for (const [step, state] of Object.entries(expected.steps)) {
        expect(
          dto.steps.find((s) => s.key === step)?.state,
          `${key}.${step}`,
        ).toBe(state);
      }
    }
  });

  it("STRIKE policy ON expectations", () => {
    const ready = evaluateStudentThesisJourney(
      snap({
        ...adviserReady,
        proposalPassed: true,
        strikeRequired: true,
        strikeEligible: false,
      }),
    );
    expect(ready.currentStep).toBe(
      STRIKE_POLICY_ON_EXPECTATIONS.STRIKE_READY.currentStep,
    );
    expect(ready.steps.find((s) => s.key === "STRIKE")?.state).toBe("CURRENT");
    expect(ready.steps.find((s) => s.key === "FINAL_DEFENSE")?.state).toBe(
      "LOCKED",
    );

    const eligible = evaluateStudentThesisJourney(
      snap({
        ...adviserReady,
        proposalPassed: true,
        strikeRequired: true,
        strikeEligible: true,
      }),
    );
    expect(eligible.currentStep).toBe(
      STRIKE_POLICY_ON_EXPECTATIONS.STRIKE_ELIGIBLE.currentStep,
    );
    expect(eligible.steps.find((s) => s.key === "STRIKE")?.state).toBe(
      "COMPLETED",
    );
    expect(eligible.steps.find((s) => s.key === "FINAL_DEFENSE")?.state).toBe(
      "CURRENT",
    );
  });
});
