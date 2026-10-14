import { describe, expect, it } from "vitest";
import {
  canCreateDefenseSchedule,
  findBlockingScheduleForScheduling,
  isAttemptBlockingScheduling,
} from "../../../src/services/defense-application-workflow";
import {
  CANONICAL_DEFENSE_OUTCOMES,
  isCanonicalDefenseOutcome,
  normalizeDefenseOutcome,
  normalizeNewDefenseOutcome,
} from "../../../src/services/defense-workflow.rules";
import { computeStageCompletion } from "../../../src/services/stage-completion";
import {
  evaluateStudentThesisJourney,
  type JourneySnapshot,
} from "../../../src/services/student-thesis-journey.rules";

type Attempt = {
  id: string;
  defenseType: string;
  sessionStatus: string;
  createdAt: string;
  conclusion?: { outcome: string } | null;
};

const attempt = (
  id: string,
  defenseType: string,
  sessionStatus: string,
  outcome: string | null = null,
  createdAt = "2026-09-01T00:00:00Z",
): Attempt => ({
  id,
  defenseType,
  sessionStatus,
  createdAt,
  conclusion: outcome ? { outcome } : null,
});

const DEFENSE_TYPES = [
  "TITLE_DEFENSE",
  "PROPOSAL_DEFENSE",
  "FINAL_DEFENSE",
] as const;

describe("WF-C1a outcome semantics (write vs legacy read)", () => {
  it("canonical outcomes are PASSED and REDEFENSE_REQUIRED", () => {
    expect([...CANONICAL_DEFENSE_OUTCOMES]).toEqual([
      "PASSED",
      "REDEFENSE_REQUIRED",
    ]);
    expect(isCanonicalDefenseOutcome("PASSED")).toBe(true);
    expect(isCanonicalDefenseOutcome("REDEFENSE_REQUIRED")).toBe(true);
    expect(isCanonicalDefenseOutcome("REVISION_REQUIRED")).toBe(false);
    expect(isCanonicalDefenseOutcome("FAILED")).toBe(false);
  });

  it("new-write normalizer accepts only canonical verdicts", () => {
    expect(normalizeNewDefenseOutcome("PASSED")).toBe("PASSED");
    expect(normalizeNewDefenseOutcome("redefense_required")).toBe(
      "REDEFENSE_REQUIRED",
    );
    expect(normalizeNewDefenseOutcome("REDEFENSE_REQUIRED")).toBe(
      "REDEFENSE_REQUIRED",
    );
    expect(normalizeNewDefenseOutcome("REVISION")).toBeNull();
    expect(normalizeNewDefenseOutcome("REVISION_REQUIRED")).toBeNull();
    expect(normalizeNewDefenseOutcome("FAILED")).toBeNull();
    expect(normalizeNewDefenseOutcome(null)).toBeNull();
  });

  it("legacy read normalizer still tolerates historical values", () => {
    expect(normalizeDefenseOutcome("PASSED")).toBe("PASSED");
    expect(normalizeDefenseOutcome("REDEFENSE_REQUIRED")).toBe(
      "REDEFENSE_REQUIRED",
    );
    expect(normalizeDefenseOutcome("REVISION")).toBe("REVISION_REQUIRED");
    expect(normalizeDefenseOutcome("REVISION_REQUIRED")).toBe(
      "REVISION_REQUIRED",
    );
    expect(normalizeDefenseOutcome("FAILED")).toBe("FAILED");
  });
});

describe("WF-C1a re-defense scheduling (Title / Proposal / Final)", () => {
  for (const defenseType of DEFENSE_TYPES) {
    describe(defenseType, () => {
      it("allows the first attempt", () => {
        expect(
          canCreateDefenseSchedule({ defenseType, schedules: [] }).allowed,
        ).toBe(true);
      });

      it("blocks while a prior attempt is active (unconcluded)", () => {
        const schedules = [attempt("a1", defenseType, "SCHEDULED")];
        const result = canCreateDefenseSchedule({ defenseType, schedules });
        expect(result.allowed).toBe(false);
        expect(result.reason).toMatch(/active/i);
        expect(
          isAttemptBlockingScheduling(schedules[0]),
        ).toBe(true);
      });

      it("blocks a second attempt after PASSED (stage complete)", () => {
        const schedules = [attempt("a1", defenseType, "CONCLUDED", "PASSED")];
        const result = canCreateDefenseSchedule({ defenseType, schedules });
        expect(result.allowed).toBe(false);
        expect(result.reason).toMatch(/PASSED/i);
        expect(findBlockingScheduleForScheduling(defenseType, schedules)?.id).toBe(
          "a1",
        );
      });

      it("allows a new attempt after REDEFENSE_REQUIRED", () => {
        const schedules = [
          attempt("a1", defenseType, "CONCLUDED", "REDEFENSE_REQUIRED"),
        ];
        const result = canCreateDefenseSchedule({ defenseType, schedules });
        expect(result.allowed).toBe(true);
        expect(
          findBlockingScheduleForScheduling(defenseType, schedules),
        ).toBeNull();
        expect(isAttemptBlockingScheduling(schedules[0])).toBe(false);
      });

      it("preserves historical blocking for a legacy concluded outcome", () => {
        for (const legacy of ["REVISION_REQUIRED", "FAILED"]) {
          const schedules = [attempt("a1", defenseType, "CONCLUDED", legacy)];
          expect(
            canCreateDefenseSchedule({ defenseType, schedules }).allowed,
          ).toBe(false);
        }
      });

      it("uses the latest attempt when earlier attempts are historical", () => {
        const schedules = [
          attempt("a1", defenseType, "CONCLUDED", "REDEFENSE_REQUIRED", "2026-06-01T00:00:00Z"),
          attempt("a2", defenseType, "CONCLUDED", "REDEFENSE_REQUIRED", "2026-08-01T00:00:00Z"),
        ];
        expect(canCreateDefenseSchedule({ defenseType, schedules }).allowed).toBe(
          true,
        );
      });

      it("a cancelled attempt never blocks", () => {
        const schedules = [attempt("a1", defenseType, "CANCELLED")];
        expect(canCreateDefenseSchedule({ defenseType, schedules }).allowed).toBe(
          true,
        );
      });

      it("a concluded attempt does not block a different defense stage", () => {
        const other = DEFENSE_TYPES.find((t) => t !== defenseType)!;
        const schedules = [attempt("a1", other, "CONCLUDED", "PASSED")];
        expect(canCreateDefenseSchedule({ defenseType, schedules }).allowed).toBe(
          true,
        );
      });
    });
  }
});

describe("WF-C1a stage completion stays open on REDEFENSE_REQUIRED", () => {
  it("Title/Proposal REDEFENSE_REQUIRED is not COMPLETE", () => {
    for (const stage of ["TITLE", "PROPOSAL", "FINAL"] as const) {
      expect(
        computeStageCompletion(stage, {
          stage,
          applicationStatus: "APPROVED",
          outcome: "REDEFENSE_REQUIRED",
          hasSelectedTitle: true,
          titleRapFinalized: true,
          proposalRapFinalized: true,
        }),
      ).toBe("POST_DEFENSE_IN_PROGRESS");
    }
  });
});

/* ---------------------------------------------------------------- journey */

const baseSnapshot = (over: Partial<JourneySnapshot> = {}): JourneySnapshot => ({
  compExamPassed: true,
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
  strikeRequired: true,
  finalPassed: false,
  finalAdminState: "NONE",
  finalSession: null,
  ...over,
});

describe("WF-C1a Student Journey on REDEFENSE_REQUIRED", () => {
  it("keeps the stage open (not COMPLETED) and does not advance to Adviser Request", () => {
    const dto = evaluateStudentThesisJourney(
      baseSnapshot({ titleAdminState: "CONCLUDED_REDEFENSE" }),
    );
    const title = dto.steps.find((s) => s.key === "TITLE_DEFENSE")!;
    expect(title.state).not.toBe("COMPLETED");
    expect(title.defenseStatus).toBe("REDEFENSE_REQUIRED");
    expect(dto.currentStep).toBe("TITLE_DEFENSE");

    const adviser = dto.steps.find((s) => s.key === "ADVISER_REQUEST")!;
    expect(adviser.state).toBe("LOCKED");
  });

  it("a PASSED Title with finalized RAP still completes the stage", () => {
    const dto = evaluateStudentThesisJourney(
      baseSnapshot({
        titlePassed: true,
        selectedTitleId: "t1",
        selectedTitleText: "A title",
        titleRapFinalized: true,
        titleAdminState: "CONCLUDED_PASSED",
      }),
    );
    const title = dto.steps.find((s) => s.key === "TITLE_DEFENSE")!;
    expect(title.state).toBe("COMPLETED");
    expect(dto.currentStep).toBe("ADVISER_REQUEST");
  });
});
