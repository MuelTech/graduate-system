import { describe, expect, it } from "vitest";
import {
  evaluateStudentThesisJourney,
  formatWallClockDateDisplay,
  formatWallClockTimeDisplay,
  shouldPollJourneySteps,
  toWallClockDate,
  toWallClockTime,
  type JourneySnapshot,
} from "../../../src/services/student-thesis-journey.rules";

function baseSnap(overrides: Partial<JourneySnapshot> = {}): JourneySnapshot {
  return {
    compExamPassed: false,
    titlePassed: false,
    selectedTitleId: null,
    selectedTitleText: null,
    titleRapFinalized: false,
    titleAdminState: "NONE",
    titleSession: null,
    adviserRequest: null,
    activeAdviser: null,
    proposalPassed: false,
    proposalRapFinalized: false,
    proposalAdminState: "NONE",
    proposalSession: null,
    strikeEligible: false,
    strikeRequired: false,
    finalPassed: false,
    finalAdminState: "NONE",
    finalSession: null,
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
  it("CP2: application PENDING + no schedule → under review", () => {
    const dto = evaluateStudentThesisJourney(
      baseSnap({
        compExamPassed: true,
        titleAdminState: "SUBMITTED",
        titleSession: null,
      }),
    );
    const title = dto.steps.find((s) => s.key === "TITLE_DEFENSE");
    expect(title?.state).toBe("WAITING");
    expect(title?.defenseStatus).toBe("APPLICATION_UNDER_REVIEW");
    expect(title?.detail).toMatch(/under Admin review/i);
    expect(title?.defenseSession).toBeNull();
  });

  it("CP2: application APPROVED + no schedule → approved waiting schedule", () => {
    const dto = evaluateStudentThesisJourney(
      baseSnap({
        compExamPassed: true,
        titleAdminState: "APPROVED_READY",
        titleSession: null,
      }),
    );
    const title = dto.steps.find((s) => s.key === "TITLE_DEFENSE");
    expect(title?.defenseStatus).toBe("APPROVED_WAITING_SCHEDULE");
    expect(title?.detail).toMatch(/approved/i);
    expect(title?.detail).toMatch(/waiting for defense schedule/i);
  });

  it("CP2: SCHEDULED session returns schedule summary", () => {
    const session = {
      defenseType: "TITLE_DEFENSE" as const,
      defenseDate: "2026-09-30T00:00:00.000Z",
      defenseTime: "1970-01-01T14:00:00.000Z",
      venueOrLink: "Graduate School Conference Room",
      sessionStatus: "SCHEDULED",
    };
    const dto = evaluateStudentThesisJourney(
      baseSnap({
        compExamPassed: true,
        titleAdminState: "SCHEDULED",
        titleSession: session,
      }),
    );
    const title = dto.steps.find((s) => s.key === "TITLE_DEFENSE");
    expect(title?.defenseStatus).toBe("SCHEDULED");
    expect(title?.defenseSession).toEqual(session);
    expect(title?.detail).toMatch(/scheduled/i);
  });

  it("CP2: IN_PROGRESS session → defense in progress", () => {
    const dto = evaluateStudentThesisJourney(
      baseSnap({
        compExamPassed: true,
        titleAdminState: "IN_PROGRESS",
        titleSession: {
          defenseType: "TITLE_DEFENSE",
          defenseDate: "2026-09-30T00:00:00.000Z",
          defenseTime: null,
          venueOrLink: null,
          sessionStatus: "IN_PROGRESS",
        },
      }),
    );
    const title = dto.steps.find((s) => s.key === "TITLE_DEFENSE");
    expect(title?.defenseStatus).toBe("DEFENSE_IN_PROGRESS");
    expect(title?.detail).toMatch(/in progress/i);
  });

  it("CP2: AWAITING_CONCLUSION → awaiting official result", () => {
    const dto = evaluateStudentThesisJourney(
      baseSnap({
        compExamPassed: true,
        titleAdminState: "AWAITING_CONCLUSION",
        titleSession: {
          defenseType: "TITLE_DEFENSE",
          defenseDate: null,
          defenseTime: null,
          venueOrLink: null,
          sessionStatus: "AWAITING_CONCLUSION",
        },
      }),
    );
    const title = dto.steps.find((s) => s.key === "TITLE_DEFENSE");
    expect(title?.defenseStatus).toBe("AWAITING_CONCLUSION");
    expect(title?.detail).toMatch(/awaiting official result/i);
  });

  it("CP2: Title PASSED + selected title + RAP pending → finalizing records", () => {
    const dto = evaluateStudentThesisJourney(
      baseSnap({
        compExamPassed: true,
        titlePassed: true,
        selectedTitleId: "t",
        selectedTitleText: "T",
        titleRapFinalized: false,
      }),
    );
    const title = dto.steps.find((s) => s.key === "TITLE_DEFENSE");
    expect(title?.defenseStatus).toBe("FINALIZING_RECORDS");
    expect(title?.state).toBe("WAITING");
    expect(title?.detail).toMatch(/Finalizing Title Defense records/i);
    expect(
      dto.steps.find((s) => s.key === "ADVISER_REQUEST")?.state,
    ).toBe("LOCKED");
  });

  it("CP2: Title PASSED + selected title + RAP finalized → completed", () => {
    const dto = evaluateStudentThesisJourney(
      baseSnap({
        compExamPassed: true,
        titlePassed: true,
        selectedTitleId: "t",
        selectedTitleText: "T",
        titleRapFinalized: true,
      }),
    );
    const title = dto.steps.find((s) => s.key === "TITLE_DEFENSE");
    expect(title?.defenseStatus).toBe("COMPLETED");
    expect(title?.state).toBe("COMPLETED");
  });
});

describe("CP2-FIX1 wall-clock date/time (no timezone shift)", () => {
  it("Test 1: defenseTime 1970-01-01T14:00:00.000Z displays as 2:00 PM", () => {
    const wall = toWallClockTime(new Date("1970-01-01T14:00:00.000Z"));
    expect(wall).toBe("14:00:00");
    expect(formatWallClockTimeDisplay(wall)).toBe("2:00 PM");
    // ISO string carrier with UTC wall-clock components
    expect(
      formatWallClockTimeDisplay(toWallClockTime("1970-01-01T14:00:00.000Z")),
    ).toBe("2:00 PM");
  });

  it("Test 1b: morning 08:30 displays as 8:30 AM", () => {
    expect(formatWallClockTimeDisplay("08:30:00")).toBe("8:30 AM");
    expect(
      formatWallClockTimeDisplay(
        toWallClockTime(new Date("1970-01-01T08:30:00.000Z")),
      ),
    ).toBe("8:30 AM");
  });

  it("Test 2: defenseDate 2026-09-30 remains September 30, 2026", () => {
    expect(toWallClockDate(new Date("2026-09-30T00:00:00.000Z"))).toBe(
      "2026-09-30",
    );
    expect(formatWallClockDateDisplay("2026-09-30")).toBe("September 30, 2026");
    expect(
      formatWallClockDateDisplay(
        toWallClockDate(new Date("2026-09-30T00:00:00.000Z")),
      ),
    ).toBe("September 30, 2026");
    // Pure string path must not depend on local timezone
    expect(formatWallClockDateDisplay(toWallClockDate("2026-09-30"))).toBe(
      "September 30, 2026",
    );
  });
});

describe("CP2-FIX1 formal result statuses", () => {
  it("Test 3: FAILED conclusion → FAILED, not FINALIZING_RECORDS", () => {
    const dto = evaluateStudentThesisJourney(
      baseSnap({
        compExamPassed: true,
        titleAdminState: "CONCLUDED_FAILED",
        titleSession: {
          defenseType: "TITLE_DEFENSE",
          defenseDate: "2026-09-30",
          defenseTime: "14:00:00",
          venueOrLink: null,
          sessionStatus: "CONCLUDED",
        },
      }),
    );
    const title = dto.steps.find((s) => s.key === "TITLE_DEFENSE");
    expect(title?.defenseStatus).toBe("FAILED");
    expect(title?.defenseStatus).not.toBe("FINALIZING_RECORDS");
    expect(title?.detail).toMatch(/Failed/i);
  });

  it("Test 4: REVISION_REQUIRED conclusion → REVISION_REQUIRED, not FINALIZING_RECORDS", () => {
    const dto = evaluateStudentThesisJourney(
      baseSnap({
        compExamPassed: true,
        titleAdminState: "CONCLUDED_OTHER",
        titleSession: {
          defenseType: "TITLE_DEFENSE",
          defenseDate: null,
          defenseTime: null,
          venueOrLink: null,
          sessionStatus: "CONCLUDED",
        },
      }),
    );
    const title = dto.steps.find((s) => s.key === "TITLE_DEFENSE");
    expect(title?.defenseStatus).toBe("REVISION_REQUIRED");
    expect(title?.defenseStatus).not.toBe("FINALIZING_RECORDS");
    expect(title?.detail).toMatch(/Revision required/i);
  });

  it("Test 5: PASSED + RAP pending still FINALIZING_RECORDS", () => {
    const dto = evaluateStudentThesisJourney(
      baseSnap({
        compExamPassed: true,
        titlePassed: true,
        selectedTitleId: "t",
        selectedTitleText: "T",
        titleRapFinalized: false,
        titleAdminState: "CONCLUDED_PASSED",
      }),
    );
    const title = dto.steps.find((s) => s.key === "TITLE_DEFENSE");
    expect(title?.defenseStatus).toBe("FINALIZING_RECORDS");
    expect(title?.state).toBe("WAITING");
  });
});

describe("CP2-FIX1 polling", () => {
  it("Test 6: terminal FAILED / REVISION_REQUIRED do not poll", () => {
    expect(
      shouldPollJourneySteps([
        { state: "WAITING", defenseStatus: "FAILED" },
      ]),
    ).toBe(false);
    expect(
      shouldPollJourneySteps([
        { state: "WAITING", defenseStatus: "REVISION_REQUIRED" },
      ]),
    ).toBe(false);
    expect(
      shouldPollJourneySteps([{ state: "WAITING", defenseStatus: "COMPLETED" }]),
    ).toBe(false);
  });

  it("Test 6b: active defense statuses still poll", () => {
    for (const defenseStatus of [
      "APPLICATION_UNDER_REVIEW",
      "APPROVED_WAITING_SCHEDULE",
      "SCHEDULED",
      "DEFENSE_IN_PROGRESS",
      "AWAITING_CONCLUSION",
      "FINALIZING_RECORDS",
    ] as const) {
      expect(
        shouldPollJourneySteps([{ state: "WAITING", defenseStatus }]),
        defenseStatus,
      ).toBe(true);
    }
  });

  it("Test 6c: another active step can still require polling", () => {
    expect(
      shouldPollJourneySteps([
        { state: "WAITING", defenseStatus: "FAILED" },
        { state: "WAITING", defenseStatus: "APPLICATION_UNDER_REVIEW" },
      ]),
    ).toBe(true);
    expect(
      shouldPollJourneySteps([
        { state: "WAITING", defenseStatus: "FAILED" },
        { state: "CURRENT", defenseStatus: "NOT_SUBMITTED" },
      ]),
    ).toBe(false);
  });
});

describe("evaluateStudentThesisJourney — Title completion (CP1)", () => {
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
        titleRapFinalized: true,
      }),
    );
    // Title is waiting on official title selection (formal conclusion incomplete).
    expect(stateOf(dto, "ADVISER_REQUEST")).toBe("LOCKED");
    expect(stateOf(dto, "TITLE_DEFENSE")).not.toBe("COMPLETED");
  });

  it("CP1: PASSED + selected title + RAP NOT finalized keeps Title incomplete and Adviser locked", () => {
    const dto = evaluateStudentThesisJourney(
      baseSnap({
        compExamPassed: true,
        titlePassed: true,
        selectedTitleId: "title-1",
        selectedTitleText: "Official Title",
        titleRapFinalized: false,
      }),
    );
    expect(stateOf(dto, "TITLE_DEFENSE")).not.toBe("COMPLETED");
    expect(stateOf(dto, "ADVISER_REQUEST")).toBe("LOCKED");
    const adviser = dto.steps.find((s) => s.key === "ADVISER_REQUEST");
    expect(adviser?.lockReason).toMatch(/Title RAP/i);
  });

  it("CP1: PASSED + selected title + RAP finalized completes Title and unlocks Adviser", () => {
    const dto = evaluateStudentThesisJourney(
      baseSnap({
        compExamPassed: true,
        titlePassed: true,
        selectedTitleId: "title-1",
        selectedTitleText: "Official Title",
        titleRapFinalized: true,
      }),
    );
    expect(stateOf(dto, "TITLE_DEFENSE")).toBe("COMPLETED");
    expect(stateOf(dto, "ADVISER_REQUEST")).toBe("CURRENT");
    expect(dto.selectedTitle).toEqual({
      id: "title-1",
      titleText: "Official Title",
    });
  });

  it("CP1: NOT PASSED + selected title + RAP finalized keeps Title incomplete and Adviser locked", () => {
    const dto = evaluateStudentThesisJourney(
      baseSnap({
        compExamPassed: true,
        titlePassed: false,
        selectedTitleId: "title-1",
        selectedTitleText: "Official Title",
        titleRapFinalized: true,
      }),
    );
    expect(stateOf(dto, "TITLE_DEFENSE")).not.toBe("COMPLETED");
    expect(stateOf(dto, "ADVISER_REQUEST")).toBe("LOCKED");
  });

  it("CP1: PASSED + no selected title + RAP finalized keeps Title incomplete and Adviser locked", () => {
    const dto = evaluateStudentThesisJourney(
      baseSnap({
        compExamPassed: true,
        titlePassed: true,
        selectedTitleId: null,
        selectedTitleText: null,
        titleRapFinalized: true,
      }),
    );
    expect(stateOf(dto, "TITLE_DEFENSE")).not.toBe("COMPLETED");
    expect(stateOf(dto, "ADVISER_REQUEST")).toBe("LOCKED");
  });

  it("formal PASSED + selected title + finalized RAP completes Title", () => {
    const dto = evaluateStudentThesisJourney(
      baseSnap({
        compExamPassed: true,
        titlePassed: true,
        selectedTitleId: "title-1",
        selectedTitleText: "Official Title",
        titleRapFinalized: true,
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
    titleRapFinalized: true,
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
    titleRapFinalized: true,
    activeAdviser: { userId: "a", name: "Ana" },
  } as const;

  it("approved/scheduled Proposal without PASSED conclusion is not completed", () => {
    const dto = evaluateStudentThesisJourney(
      baseSnap({ ...withAdviser, proposalAdminState: "APPROVED_READY" }),
    );
    expect(stateOf(dto, "PROPOSAL_DEFENSE")).toBe("WAITING");
    expect(stateOf(dto, "FINAL_DEFENSE")).toBe("LOCKED");
  });

  it("Proposal formal PASSED + finalized RAP completes Proposal", () => {
    const dto = evaluateStudentThesisJourney(
      baseSnap({
        ...withAdviser,
        proposalPassed: true,
        proposalRapFinalized: true,
      }),
    );
    expect(stateOf(dto, "PROPOSAL_DEFENSE")).toBe("COMPLETED");
    expect(stateOf(dto, "FINAL_DEFENSE")).toBe("CURRENT");
  });

  it("Proposal PASSED without finalized RAP is not completed", () => {
    const dto = evaluateStudentThesisJourney(
      baseSnap({
        ...withAdviser,
        proposalPassed: true,
        proposalRapFinalized: false,
      }),
    );
    expect(stateOf(dto, "PROPOSAL_DEFENSE")).not.toBe("COMPLETED");
    expect(stateOf(dto, "FINAL_DEFENSE")).toBe("LOCKED");
  });

  it("Final PASSED completes Final", () => {
    const dto = evaluateStudentThesisJourney(
      baseSnap({
        ...withAdviser,
        proposalPassed: true,
        proposalRapFinalized: true,
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
    titleRapFinalized: true,
    activeAdviser: { userId: "a", name: "A" },
    proposalPassed: true,
    proposalRapFinalized: true,
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
        titleRapFinalized: true,
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
        titleRapFinalized: true,
        activeAdviser: { userId: "a", name: "A" },
        proposalPassed: true,
        proposalRapFinalized: true,
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
    titleRapFinalized: true,
    activeAdviser: { userId: "a", name: "A" },
    proposalPassed: true,
    proposalRapFinalized: true,
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
