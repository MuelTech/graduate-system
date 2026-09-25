import { describe, expect, it } from "vitest";
import {
  evaluateStudentThesisJourney,
  type JourneySnapshot,
} from "./student-thesis-journey.rules";

function baseSnap(overrides: Partial<JourneySnapshot> = {}): JourneySnapshot {
  return {
    compExamPassed: false,
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
    ...overrides,
  };
}

function stateOf(
  dto: ReturnType<typeof evaluateStudentThesisJourney>,
  key: string,
) {
  return dto.steps.find((s) => s.key === key)?.state;
}

describe("evaluateStudentThesisJourney — Title / Comp Exam", () => {
  it("locks Title when Comp Exam is not passed", () => {
    const dto = evaluateStudentThesisJourney(baseSnap());
    expect(stateOf(dto, "TITLE_DEFENSE")).toBe("LOCKED");
    expect(dto.currentStep).toBe("TITLE_DEFENSE");
    expect(dto.steps[0].lockReason).toMatch(/Comprehensive Examination/i);
  });

  it("makes Title current when Comp Exam is passed", () => {
    const dto = evaluateStudentThesisJourney(baseSnap({ compExamPassed: true }));
    expect(stateOf(dto, "TITLE_DEFENSE")).toBe("CURRENT");
  });

  it("application APPROVED without formal PASSED conclusion is not completed", () => {
    const dto = evaluateStudentThesisJourney(
      baseSnap({
        compExamPassed: true,
        titlePassed: false,
        titleAdminState: "APPROVED_READY",
      }),
    );
    expect(stateOf(dto, "TITLE_DEFENSE")).toBe("WAITING");
    expect(stateOf(dto, "ADVISER_REQUEST")).toBe("LOCKED");
  });

  it("formal PASSED without selectedTitleId keeps Adviser locked", () => {
    const dto = evaluateStudentThesisJourney(
      baseSnap({
        compExamPassed: true,
        titlePassed: true,
        selectedTitleId: null,
        selectedTitleText: null,
      }),
    );
    // Title is waiting on official title selection (formal conclusion incomplete).
    expect(stateOf(dto, "ADVISER_REQUEST")).toBe("LOCKED");
  });

  it("formal PASSED + selected title completes Title", () => {
    const dto = evaluateStudentThesisJourney(
      baseSnap({
        compExamPassed: true,
        titlePassed: true,
        selectedTitleId: "title-1",
        selectedTitleText: "Official Title",
      }),
    );
    expect(stateOf(dto, "TITLE_DEFENSE")).toBe("COMPLETED");
    expect(dto.selectedTitle).toEqual({
      id: "title-1",
      titleText: "Official Title",
    });
  });
});

describe("evaluateStudentThesisJourney — Adviser", () => {
  const titleReady = {
    compExamPassed: true,
    titlePassed: true,
    selectedTitleId: "title-1",
    selectedTitleText: "Official Title",
  } as const;

  it("no request → Adviser current", () => {
    const dto = evaluateStudentThesisJourney(baseSnap({ ...titleReady }));
    expect(stateOf(dto, "ADVISER_REQUEST")).toBe("CURRENT");
  });

  it("waiting for Adviser / waiting for Dean → WAITING", () => {
    const waitingAdviser = evaluateStudentThesisJourney(
      baseSnap({
        ...titleReady,
        adviserRequest: {
          id: "r1",
          status: "PENDING",
          adviserStatus: "PENDING",
          deanStatus: "PENDING",
          requestedAdviserId: "a",
          requestedAdviserName: "Ana",
        },
      }),
    );
    expect(stateOf(waitingAdviser, "ADVISER_REQUEST")).toBe("WAITING");

    const waitingDean = evaluateStudentThesisJourney(
      baseSnap({
        ...titleReady,
        adviserRequest: {
          id: "r1",
          status: "PENDING",
          adviserStatus: "CONFORMED",
          deanStatus: "PENDING",
          requestedAdviserId: "a",
          requestedAdviserName: "Ana",
        },
      }),
    );
    expect(stateOf(waitingDean, "ADVISER_REQUEST")).toBe("WAITING");
  });

  it("DECLINED / Dean REJECTED allow retry (AVAILABLE)", () => {
    const declined = evaluateStudentThesisJourney(
      baseSnap({
        ...titleReady,
        adviserRequest: {
          id: "r1",
          status: "REJECTED",
          adviserStatus: "DECLINED",
          deanStatus: "PENDING",
          requestedAdviserId: "a",
          requestedAdviserName: "Ana",
        },
      }),
    );
    expect(stateOf(declined, "ADVISER_REQUEST")).toBe("AVAILABLE");

    const deanRejected = evaluateStudentThesisJourney(
      baseSnap({
        ...titleReady,
        adviserRequest: {
          id: "r1",
          status: "REJECTED",
          adviserStatus: "CONFORMED",
          deanStatus: "REJECTED",
          requestedAdviserId: "a",
          requestedAdviserName: "Ana",
        },
      }),
    );
    expect(stateOf(deanRejected, "ADVISER_REQUEST")).toBe("AVAILABLE");
  });

  it("CONFORMED without active assignment is NOT completed", () => {
    const dto = evaluateStudentThesisJourney(
      baseSnap({
        ...titleReady,
        adviserRequest: {
          id: "r1",
          status: "PENDING",
          adviserStatus: "CONFORMED",
          deanStatus: "PENDING",
          requestedAdviserId: "a",
          requestedAdviserName: "Ana",
        },
      }),
    );
    expect(stateOf(dto, "ADVISER_REQUEST")).toBe("WAITING");
    expect(stateOf(dto, "PROPOSAL_DEFENSE")).toBe("LOCKED");
  });

  it("active AdviserAssignment completes Adviser step", () => {
    const dto = evaluateStudentThesisJourney(
      baseSnap({
        ...titleReady,
        activeAdviser: { userId: "a", name: "Ana Chair" },
      }),
    );
    expect(stateOf(dto, "ADVISER_REQUEST")).toBe("COMPLETED");
    expect(dto.activeAdviser?.name).toBe("Ana Chair");
  });
});

describe("evaluateStudentThesisJourney — Proposal / Final", () => {
  const withAdviser = {
    compExamPassed: true,
    titlePassed: true,
    selectedTitleId: "title-1",
    selectedTitleText: "Official Title",
    activeAdviser: { userId: "a", name: "Ana" },
  } as const;

  it("approved/scheduled Proposal without PASSED conclusion is not completed", () => {
    const dto = evaluateStudentThesisJourney(
      baseSnap({ ...withAdviser, proposalAdminState: "APPROVED_READY" }),
    );
    expect(stateOf(dto, "PROPOSAL_DEFENSE")).toBe("WAITING");
    expect(stateOf(dto, "FINAL_DEFENSE")).toBe("LOCKED");
  });

  it("Proposal formal PASSED completes Proposal", () => {
    const dto = evaluateStudentThesisJourney(
      baseSnap({ ...withAdviser, proposalPassed: true }),
    );
    expect(stateOf(dto, "PROPOSAL_DEFENSE")).toBe("COMPLETED");
    expect(stateOf(dto, "FINAL_DEFENSE")).toBe("CURRENT");
  });

  it("Final PASSED completes Final", () => {
    const dto = evaluateStudentThesisJourney(
      baseSnap({
        ...withAdviser,
        proposalPassed: true,
        finalPassed: true,
      }),
    );
    expect(stateOf(dto, "FINAL_DEFENSE")).toBe("COMPLETED");
    expect(dto.currentStep).toBeNull();
  });
});

describe("evaluateStudentThesisJourney — STRIKE policy", () => {
  const readyForStrike = {
    compExamPassed: true,
    titlePassed: true,
    selectedTitleId: "t",
    selectedTitleText: "T",
    activeAdviser: { userId: "a", name: "A" },
    proposalPassed: true,
  } as const;

  it("required + no eligible result → STRIKE current, Final locked", () => {
    const dto = evaluateStudentThesisJourney(
      baseSnap({ ...readyForStrike, strikeRequired: true, strikeEligible: false }),
    );
    expect(stateOf(dto, "STRIKE")).toBe("CURRENT");
    expect(stateOf(dto, "FINAL_DEFENSE")).toBe("LOCKED");
    expect(dto.policy.strikeRequired).toBe(true);
  });

  it("required + eligible persisted result → STRIKE completed, Final current", () => {
    const dto = evaluateStudentThesisJourney(
      baseSnap({ ...readyForStrike, strikeRequired: true, strikeEligible: true }),
    );
    expect(stateOf(dto, "STRIKE")).toBe("COMPLETED");
    expect(stateOf(dto, "FINAL_DEFENSE")).toBe("CURRENT");
  });

  it("not required → STRIKE does not block Final", () => {
    const dto = evaluateStudentThesisJourney(
      baseSnap({
        ...readyForStrike,
        strikeRequired: false,
        strikeEligible: false,
      }),
    );
    expect(stateOf(dto, "STRIKE")).toBe("COMPLETED");
    expect(stateOf(dto, "FINAL_DEFENSE")).toBe("CURRENT");
    expect(dto.policy.strikeRequired).toBe(false);
  });
});

describe("currentStep determinism and cumulative sequence", () => {
  it("does not jump ahead when ThesisRecord.stage is manually changed (snapshot-based)", () => {
    const dto = evaluateStudentThesisJourney(baseSnap({ compExamPassed: true }));
    expect(dto.currentStep).toBe("TITLE_DEFENSE");
  });

  it("A: Title WAITING + active AdviserAssignment keeps currentStep at Title; Proposal not CURRENT", () => {
    const dto = evaluateStudentThesisJourney(
      baseSnap({
        compExamPassed: true,
        titlePassed: false,
        titleAdminState: "SUBMITTED",
        activeAdviser: { userId: "a", name: "Orphan Adviser" },
      }),
    );
    expect(dto.currentStep).toBe("TITLE_DEFENSE");
    expect(stateOf(dto, "TITLE_DEFENSE")).toBe("WAITING");
    expect(stateOf(dto, "PROPOSAL_DEFENSE")).toBe("LOCKED");
  });

  it("B: Title incomplete + Proposal PASSED legacy evidence keeps STRIKE/Final locked", () => {
    const dto = evaluateStudentThesisJourney(
      baseSnap({
        compExamPassed: true,
        titlePassed: false,
        proposalPassed: true,
      }),
    );
    expect(dto.currentStep).toBe("TITLE_DEFENSE");
    expect(stateOf(dto, "STRIKE")).toBe("LOCKED");
    expect(stateOf(dto, "FINAL_DEFENSE")).toBe("LOCKED");
  });

  it("C: Title complete + no adviser + Proposal PASSED legacy keeps currentStep at Adviser", () => {
    const dto = evaluateStudentThesisJourney(
      baseSnap({
        compExamPassed: true,
        titlePassed: true,
        selectedTitleId: "t",
        selectedTitleText: "T",
        proposalPassed: true,
      }),
    );
    expect(dto.currentStep).toBe("ADVISER_REQUEST");
    expect(stateOf(dto, "PROPOSAL_DEFENSE")).toBe("LOCKED");
    expect(stateOf(dto, "STRIKE")).toBe("LOCKED");
    expect(stateOf(dto, "FINAL_DEFENSE")).toBe("LOCKED");
  });

  it("fully completed journey → currentStep null", () => {
    const dto = evaluateStudentThesisJourney(
      baseSnap({
        compExamPassed: true,
        titlePassed: true,
        selectedTitleId: "t",
        selectedTitleText: "T",
        activeAdviser: { userId: "a", name: "A" },
        proposalPassed: true,
        strikeRequired: true,
        strikeEligible: true,
        finalPassed: true,
      }),
    );
    expect(dto.currentStep).toBeNull();
    expect(dto.steps.every((s) => s.state === "COMPLETED")).toBe(true);
  });
});

describe("rejected applications are actionable, not WAITING", () => {
  const baseReady = {
    compExamPassed: true,
    titlePassed: true,
    selectedTitleId: "t",
    selectedTitleText: "T",
    activeAdviser: { userId: "a", name: "A" },
    proposalPassed: true,
    strikeRequired: false,
    finalPassed: false,
  } as const;

  it("Title application rejected → CURRENT with resubmit text", () => {
    const dto = evaluateStudentThesisJourney(
      baseSnap({
        compExamPassed: true,
        titleAdminState: "REJECTED",
      }),
    );
    expect(stateOf(dto, "TITLE_DEFENSE")).toBe("CURRENT");
    expect(dto.steps[0].detail).toMatch(/rejected/i);
    expect(dto.steps[0].detail).not.toMatch(/under review/i);
    expect(dto.steps[0].nextAction).toMatch(/resubmit/i);
  });

  it("Proposal application rejected → CURRENT, not WAITING", () => {
    const dto = evaluateStudentThesisJourney(
      baseSnap({
        ...baseReady,
        proposalPassed: false,
        proposalAdminState: "REJECTED",
      }),
    );
    expect(stateOf(dto, "PROPOSAL_DEFENSE")).toBe("CURRENT");
    expect(dto.steps[2].detail).toMatch(/rejected/i);
    expect(dto.steps[2].detail).not.toMatch(/under review/i);
  });

  it("Final application rejected → CURRENT, not WAITING", () => {
    const dto = evaluateStudentThesisJourney(
      baseSnap({
        ...baseReady,
        finalAdminState: "REJECTED",
      }),
    );
    expect(stateOf(dto, "FINAL_DEFENSE")).toBe("CURRENT");
    expect(dto.steps[4].detail).toMatch(/rejected/i);
    expect(dto.steps[4].detail).not.toMatch(/under review/i);
  });
});
