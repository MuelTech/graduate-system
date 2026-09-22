import { describe, expect, it } from "vitest";
import {
  applyWinningTitleFlags,
  canApproveApplication,
  canRecordDefenseOutcome,
  canResubmitApplication,
  canScheduleApplication,
  canSetApplicationReviewStatus,
  canSubmitOralScore,
  isApplicationReviewStatus,
  isScoringComplete,
  isStageUnlockedByPriorOutcome,
  isStageUnlockedByPriorStatus,
  normalizeDefenseOutcome,
  validateTitleConclusionSelection,
} from "./defense-workflow.rules";

describe("APPROVED != PASSED", () => {
  it("does not unlock the next stage from APPROVED alone", () => {
    expect(isStageUnlockedByPriorStatus("APPROVED")).toBe(false);
    expect(isStageUnlockedByPriorStatus("SCHEDULED")).toBe(false);
    expect(isStageUnlockedByPriorStatus("PENDING")).toBe(false);
    expect(isStageUnlockedByPriorStatus("PASSED")).toBe(true);
  });

  it("unlocks only from formal PASSED outcome", () => {
    expect(isStageUnlockedByPriorOutcome("PASSED")).toBe(true);
    expect(isStageUnlockedByPriorOutcome("REVISION_REQUIRED")).toBe(false);
    expect(isStageUnlockedByPriorOutcome("FAILED")).toBe(false);
    expect(isStageUnlockedByPriorOutcome(null)).toBe(false);
  });

  it("normalizes conclusion outcome aliases", () => {
    expect(normalizeDefenseOutcome("PASSED")).toBe("PASSED");
    expect(normalizeDefenseOutcome("REVISION")).toBe("REVISION_REQUIRED");
    expect(normalizeDefenseOutcome("REVISION_REQUIRED")).toBe("REVISION_REQUIRED");
    expect(normalizeDefenseOutcome("FAILED")).toBe("FAILED");
    expect(normalizeDefenseOutcome("APPROVED")).toBe(null);
    expect(normalizeDefenseOutcome(undefined)).toBe(null);
  });

  it("blocks double conclusion and unauthorized conclusion", () => {
    expect(
      canRecordDefenseOutcome({
        alreadyConcluded: false,
        hasConclusionAuthority: true,
      }),
    ).toBe(true);
    expect(
      canRecordDefenseOutcome({
        alreadyConcluded: true,
        hasConclusionAuthority: true,
      }),
    ).toBe(false);
    expect(
      canRecordDefenseOutcome({
        alreadyConcluded: false,
        hasConclusionAuthority: false,
      }),
    ).toBe(false);
  });

  it("application review may only set review statuses", () => {
    expect(isApplicationReviewStatus("APPROVED")).toBe(true);
    expect(isApplicationReviewStatus("REJECTED")).toBe(true);
    expect(isApplicationReviewStatus("PASSED")).toBe(false);
    expect(isApplicationReviewStatus("SCHEDULED")).toBe(false);
    expect(canSetApplicationReviewStatus("PASSED")).toBe(false);
    expect(canSetApplicationReviewStatus("APPROVED")).toBe(true);
  });
});

describe("application lifecycle", () => {
  it("Title application can be APPROVED without selecting a title", () => {
    expect(canApproveApplication("PENDING")).toBe(true);
  });

  it("APPROVED application becomes available for scheduling", () => {
    expect(canScheduleApplication("APPROVED")).toBe(true);
    expect(canScheduleApplication("PENDING")).toBe(false);
    expect(canScheduleApplication("PASSED")).toBe(false);
  });

  it("rejected application can be resubmitted; others cannot", () => {
    expect(canResubmitApplication("REJECTED")).toBe(true);
    expect(canResubmitApplication("PENDING")).toBe(false);
    expect(canResubmitApplication("APPROVED")).toBe(false);
    expect(canResubmitApplication("PASSED")).toBe(false);
  });
});

describe("Title Defense conclusion", () => {
  it("winning title remains unset until conclusion selection", () => {
    const flags = applyWinningTitleFlags(
      [
        { id: "a", isSelected: true },
        { id: "b", isSelected: false },
        { id: "c", isSelected: false },
      ],
      "b",
    );
    expect(flags.find((t) => t.id === "b")?.isSelected).toBe(true);
    expect(flags.filter((t) => t.isSelected)).toHaveLength(1);
  });

  it("title conclusion can only select one of the student's own proposed titles", () => {
    expect(
      validateTitleConclusionSelection("TITLE_DEFENSE", "a", ["a", "b", "c"])
        .valid,
    ).toBe(true);
    expect(
      validateTitleConclusionSelection("TITLE_DEFENSE", "zzz", ["a", "b", "c"])
        .valid,
    ).toBe(false);
    expect(
      validateTitleConclusionSelection("TITLE_DEFENSE", null, ["a"]).valid,
    ).toBe(false);
    // Proposal/Final do not require title selection
    expect(
      validateTitleConclusionSelection("FINAL_DEFENSE", null, ["a"]).valid,
    ).toBe(true);
  });
});

describe("oral scoring completion", () => {
  it("non-evaluator roles do not block oral score completion", () => {
    // 2 evaluators assigned, 2 scores in, 5 total committee members
    expect(isScoringComplete(2, 2)).toBe(true);
  });

  it("non-evaluator cannot submit oral score unless policy allows it", () => {
    expect(canSubmitOralScore("PANELIST", ["CHAIRMAN", "PANELIST"])).toBe(true);
    expect(canSubmitOralScore("ADVISER", ["CHAIRMAN", "PANELIST"])).toBe(false);
    expect(canSubmitOralScore("RAPPORTEUR", ["CHAIRMAN", "PANELIST"])).toBe(
      false,
    );
    expect(canSubmitOralScore("FACILITATOR", ["CHAIRMAN", "PANELIST"])).toBe(
      false,
    );
  });
});
