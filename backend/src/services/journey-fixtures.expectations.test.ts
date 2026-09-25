import { describe, expect, it } from "vitest";
import {
  evaluateStudentThesisJourney,
  type JourneySnapshot,
} from "./student-thesis-journey.rules";

const REQUIRED_SCENARIOS = [
  "TITLE_READY",
  "TITLE_PENDING",
  "TITLE_PASSED_NO_ADVISER",
  "ADVISER_PENDING",
  "ADVISER_CONFORMED_WAITING_DEAN",
  "ADVISER_APPROVED",
  "PROPOSAL_READY",
  "PROPOSAL_PASSED",
  "STRIKE_READY",
  "STRIKE_ELIGIBLE",
  "FINAL_READY",
  "FINAL_PASSED",
] as const;

/**
 * WP6 expected Journey states for the 12 required fixtures.
 * These assert the evaluator contract the seeded data must satisfy.
 */
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

describe("WP6 fixture Journey expectations", () => {
  it("defines all 12 required scenarios", () => {
    expect([...REQUIRED_SCENARIOS]).toHaveLength(12);
  });

  it("maps scenarios to expected currentStep/step states", () => {
    const cases: Array<{
      name: string;
      snapshot: JourneySnapshot;
      currentStep: string | null;
      states: Record<string, string>;
    }> = [
      {
        name: "TITLE_READY",
        snapshot: snap({ titleAdminState: "NONE" }),
        currentStep: "TITLE_DEFENSE",
        states: { TITLE_DEFENSE: "CURRENT" },
      },
      {
        name: "TITLE_PENDING",
        snapshot: snap({ titleAdminState: "SUBMITTED" }),
        currentStep: "TITLE_DEFENSE",
        states: { TITLE_DEFENSE: "WAITING" },
      },
      {
        name: "TITLE_PASSED_NO_ADVISER",
        snapshot: snap({ ...titleReady }),
        currentStep: "ADVISER_REQUEST",
        states: {
          TITLE_DEFENSE: "COMPLETED",
          ADVISER_REQUEST: "CURRENT",
        },
      },
      {
        name: "ADVISER_PENDING",
        snapshot: snap({
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
        currentStep: "ADVISER_REQUEST",
        states: { ADVISER_REQUEST: "WAITING" },
      },
      {
        name: "ADVISER_CONFORMED_WAITING_DEAN",
        snapshot: snap({
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
        currentStep: "ADVISER_REQUEST",
        states: { ADVISER_REQUEST: "WAITING" },
      },
      {
        name: "ADVISER_APPROVED",
        snapshot: snap({ ...adviserReady }),
        currentStep: "PROPOSAL_DEFENSE",
        states: {
          ADVISER_REQUEST: "COMPLETED",
          PROPOSAL_DEFENSE: "CURRENT",
        },
      },
      {
        name: "PROPOSAL_READY",
        snapshot: snap({
          ...adviserReady,
          proposalAdminState: "NONE",
        }),
        currentStep: "PROPOSAL_DEFENSE",
        states: { PROPOSAL_DEFENSE: "CURRENT" },
      },
      {
        name: "PROPOSAL_PASSED",
        snapshot: snap({
          ...adviserReady,
          proposalPassed: true,
          strikeRequired: false,
        }),
        currentStep: "FINAL_DEFENSE",
        states: {
          PROPOSAL_DEFENSE: "COMPLETED",
          STRIKE: "COMPLETED",
          FINAL_DEFENSE: "CURRENT",
        },
      },
      {
        name: "STRIKE_READY",
        snapshot: snap({
          ...adviserReady,
          proposalPassed: true,
          strikeRequired: false,
          strikeEligible: false,
        }),
        currentStep: "FINAL_DEFENSE",
        states: { FINAL_DEFENSE: "CURRENT" },
      },
      {
        name: "STRIKE_ELIGIBLE",
        snapshot: snap({
          ...adviserReady,
          proposalPassed: true,
          strikeRequired: true,
          strikeEligible: true,
        }),
        currentStep: "FINAL_DEFENSE",
        states: {
          STRIKE: "COMPLETED",
          FINAL_DEFENSE: "CURRENT",
        },
      },
      {
        name: "FINAL_READY",
        snapshot: snap({
          ...adviserReady,
          proposalPassed: true,
          strikeRequired: true,
          strikeEligible: true,
          finalAdminState: "NONE",
        }),
        currentStep: "FINAL_DEFENSE",
        states: { FINAL_DEFENSE: "CURRENT" },
      },
      {
        name: "FINAL_PASSED",
        snapshot: snap({
          ...adviserReady,
          proposalPassed: true,
          strikeRequired: true,
          strikeEligible: true,
          finalPassed: true,
        }),
        currentStep: null,
        states: {
          TITLE_DEFENSE: "COMPLETED",
          ADVISER_REQUEST: "COMPLETED",
          PROPOSAL_DEFENSE: "COMPLETED",
          STRIKE: "COMPLETED",
          FINAL_DEFENSE: "COMPLETED",
        },
      },
    ];

    for (const c of cases) {
      const dto = evaluateStudentThesisJourney(c.snapshot);
      expect(dto.currentStep, c.name).toBe(c.currentStep);
      for (const [key, state] of Object.entries(c.states)) {
        expect(
          dto.steps.find((s) => s.key === key)?.state,
          `${c.name}.${key}`,
        ).toBe(state);
      }
    }
  });

  it("STRIKE_READY locks Final when policy is ON (without changing persisted data)", () => {
    const dto = evaluateStudentThesisJourney(
      snap({
        ...adviserReady,
        proposalPassed: true,
        strikeRequired: true,
        strikeEligible: false,
      }),
    );
    expect(dto.steps.find((s) => s.key === "STRIKE")?.state).toBe("CURRENT");
    expect(dto.steps.find((s) => s.key === "FINAL_DEFENSE")?.state).toBe(
      "LOCKED",
    );
    expect(dto.currentStep).toBe("STRIKE");
  });
});
