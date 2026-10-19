import { describe, expect, it } from "vitest";
import {
  DefenseConclusionService,
  isSessionChairmanRole,
  resolveExplicitOutcome,
  validateConclusionPreconditions,
} from "../../../src/services/defense-conclusion.service";

const baseInput = {
  alreadyConcluded: false,
  sessionRole: "CHAIRMAN",
  isSessionChairman: true,
  evaluatorAssignments: 2,
  finalizedEvaluatorScores: 2,
  defenseType: "PROPOSAL_DEFENSE",
  sessionStatus: "AWAITING_CONCLUSION",
  rapporteurNotesFinalized: true,
  oralSummaryExists: true,
  outcomeProvided: true,
  // RAP-C1: an in-system FINALIZED Committee Report is REQUIRED for a new
  // conclusion at every stage.
  rapReportStatus: "FINALIZED",
};

describe("CP7 Chairman conclusion authority", () => {
  it("Test 11: ADMIN without session CHAIRMAN assignment cannot conclude", () => {
    const result = validateConclusionPreconditions(
      {
        ...baseInput,
        sessionRole: null,
        isSessionChairman: false,
      },
      "PASSED",
    );
    expect(result.ok).toBe(false);
    expect(result.statusCode).toBe(403);
    expect(result.errors.join(" ")).toMatch(/session Chairman/i);
  });

  it("Test 12: ordinary PANELIST cannot conclude", () => {
    const result = validateConclusionPreconditions(
      {
        ...baseInput,
        sessionRole: "PANELIST",
        isSessionChairman: false,
      },
      "PASSED",
    );
    expect(result.ok).toBe(false);
    expect(result.statusCode).toBe(403);
  });

  it("Test 13: session CHAIRMAN can conclude when preconditions hold", () => {
    const result = validateConclusionPreconditions(baseInput, "PASSED");
    expect(result.ok).toBe(true);
    expect(result.outcome).toBe("PASSED");
  });

  it("Test 14: missing outcome is 400 and never defaults to PASSED", () => {
    const result = validateConclusionPreconditions(
      { ...baseInput, outcomeProvided: false },
      undefined,
    );
    expect(result.ok).toBe(false);
    expect(result.statusCode).toBe(400);
    expect(result.outcome).toBeNull();
  });

  it("rejects invalid outcome values", () => {
    const result = validateConclusionPreconditions(baseInput, "APPROVED");
    expect(result.ok).toBe(false);
  });
});

describe("CP7 readiness gates", () => {
  it("Test 16: finalized legacy notes are no longer the gate (RAP finalization is)", () => {
    // With a FINALIZED in-system report present, unfinalized legacy notes no
    // longer block the conclusion.
    const ok = validateConclusionPreconditions(
      { ...baseInput, rapporteurNotesFinalized: false },
      "PASSED",
    );
    expect(ok.ok).toBe(true);
    // With NO in-system report, the conclusion is blocked regardless of notes.
    const blocked = validateConclusionPreconditions(
      { ...baseInput, rapporteurNotesFinalized: true, rapReportStatus: null },
      "PASSED",
    );
    expect(blocked.ok).toBe(false);
    expect(blocked.statusCode).toBe(409);
    expect(blocked.errors.join(" ")).toMatch(/Committee Report/i);
  });

  it("Test 15: missing Oral Summary on Proposal/Final → not ready", () => {
    const result = validateConclusionPreconditions(
      { ...baseInput, oralSummaryExists: false },
      "PASSED",
    );
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toMatch(/Oral Examination Summary/i);
  });

  it("requires all evaluators FINALIZED", () => {
    const result = validateConclusionPreconditions(
      { ...baseInput, finalizedEvaluatorScores: 1 },
      "PASSED",
    );
    expect(result.ok).toBe(false);
  });

  it("Test 17: second conclusion → 409", () => {
    const result = validateConclusionPreconditions(
      { ...baseInput, alreadyConcluded: true },
      "PASSED",
    );
    expect(result.ok).toBe(false);
    expect(result.statusCode).toBe(409);
  });

  it("requires session AWAITING_CONCLUSION", () => {
    const result = validateConclusionPreconditions(
      { ...baseInput, sessionStatus: "IN_PROGRESS" },
      "PASSED",
    );
    expect(result.ok).toBe(false);
  });
});

describe("WF-C1b Title conclusion (evaluators + Summary required; no selected title)", () => {
  /**
   * Title readiness after WF-C1b: awaiting conclusion + all evaluators finalized
   * + Oral Summary exists. Rapporteur notes/RAP are NOT required yet (WF-C1c).
   */
  const titleReady = {
    ...baseInput,
    defenseType: "TITLE_DEFENSE",
    sessionStatus: "AWAITING_CONCLUSION",
    rapporteurNotesFinalized: false,
    evaluatorAssignments: 5,
    finalizedEvaluatorScores: 5,
    oralSummaryExists: true,
  };

  it("Title PASSED allowed with finalized evaluators + Summary and no selected title", () => {
    const result = validateConclusionPreconditions(titleReady, "PASSED");
    expect(result.ok).toBe(true);
    expect(result.outcome).toBe("PASSED");
  });

  it("Title REDEFENSE_REQUIRED allowed under the same readiness", () => {
    const result = validateConclusionPreconditions(
      titleReady,
      "REDEFENSE_REQUIRED",
    );
    expect(result.ok).toBe(true);
    expect(result.outcome).toBe("REDEFENSE_REQUIRED");
  });

  it("Title conclusion requires all required evaluators finalized", () => {
    const result = validateConclusionPreconditions(
      { ...titleReady, finalizedEvaluatorScores: 4 },
      "PASSED",
    );
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toMatch(/evaluator/i);
  });

  it("Title conclusion requires the Oral Examination Summary", () => {
    const result = validateConclusionPreconditions(
      { ...titleReady, oralSummaryExists: false },
      "PASSED",
    );
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toMatch(/Oral Examination Summary/i);
  });

  it("Title cannot conclude from IN_PROGRESS (must be AWAITING_CONCLUSION)", () => {
    const result = validateConclusionPreconditions(
      { ...titleReady, sessionStatus: "IN_PROGRESS" },
      "PASSED",
    );
    expect(result.ok).toBe(false);
    expect(result.statusCode).toBe(409);
  });

  it("pre-defense SCHEDULED Title cannot be formally concluded", () => {
    const result = validateConclusionPreconditions(
      { ...titleReady, sessionStatus: "SCHEDULED" },
      "PASSED",
    );
    expect(result.ok).toBe(false);
    expect(result.statusCode).toBe(409);
  });

  it("Title conclusion is rejected while the session is still UNSCHEDULED", () => {
    const result = validateConclusionPreconditions(
      { ...titleReady, sessionStatus: "UNSCHEDULED" },
      "PASSED",
    );
    expect(result.ok).toBe(false);
    expect(result.statusCode).toBe(409);
  });

  it("Title non-Chairman cannot conclude even when otherwise ready", () => {
    const result = validateConclusionPreconditions(
      {
        ...titleReady,
        sessionRole: "PANELIST",
        isSessionChairman: false,
      },
      "PASSED",
    );
    expect(result.ok).toBe(false);
    expect(result.statusCode).toBe(403);
  });
});

describe("CP7 outcome safety", () => {
  it("new conclusions accept PASSED and REDEFENSE_REQUIRED only (legacy rejected)", () => {
    expect(resolveExplicitOutcome("PASSED")).toBe("PASSED");
    expect(resolveExplicitOutcome("REDEFENSE_REQUIRED")).toBe(
      "REDEFENSE_REQUIRED",
    );
    // Legacy verdicts are readable history but NOT valid new writes.
    expect(resolveExplicitOutcome("REVISION")).toBeNull();
    expect(resolveExplicitOutcome("REVISION_REQUIRED")).toBeNull();
    expect(resolveExplicitOutcome("FAILED")).toBeNull();

    const svc = new DefenseConclusionService();
    const outcome = svc.assertCanConclude(
      { ...baseInput, outcomeProvided: true },
      "REDEFENSE_REQUIRED",
    );
    expect(outcome).toBe("REDEFENSE_REQUIRED");
  });

  it("rejects legacy verdicts as new conclusions", () => {
    expect(
      validateConclusionPreconditions(baseInput, "REVISION_REQUIRED").ok,
    ).toBe(false);
    expect(validateConclusionPreconditions(baseInput, "FAILED").ok).toBe(false);
  });

  it("Test 20: outcome is independent of numeric score", () => {
    // Even with a high average the Chairman may record REDEFENSE_REQUIRED.
    const result = validateConclusionPreconditions(baseInput, "REDEFENSE_REQUIRED");
    expect(result.ok).toBe(true);
    expect(result.outcome).toBe("REDEFENSE_REQUIRED");
  });

  it("isSessionChairmanRole recognizes CHAIRMAN only", () => {
    expect(isSessionChairmanRole("CHAIRMAN")).toBe(true);
    expect(isSessionChairmanRole("PANELIST")).toBe(false);
    expect(isSessionChairmanRole(null)).toBe(false);
    expect(isSessionChairmanRole("ADMIN")).toBe(false);
  });
});

describe("RAP-C1 conclusion gating (in-system FINALIZED report REQUIRED — no legacy bypass)", () => {
  const STAGES = ["TITLE_DEFENSE", "PROPOSAL_DEFENSE", "FINAL_DEFENSE"];

  it("blocks conclusion for every stage when there is NO in-system report", () => {
    for (const defenseType of STAGES) {
      const result = validateConclusionPreconditions(
        { ...baseInput, defenseType, rapReportStatus: null },
        "PASSED",
      );
      expect(result.ok).toBe(false);
      expect(result.statusCode).toBe(409);
      expect(result.errors.join(" ")).toMatch(/Committee Report/i);
    }
  });

  it("blocks conclusion for every stage while the RAP is not FINALIZED", () => {
    for (const defenseType of STAGES) {
      for (const status of [
        "DRAFT",
        "FOR_SIGNATURE",
        "PARTIALLY_SIGNED",
        "ALL_SIGNED",
        "DISTRIBUTED",
      ]) {
        const result = validateConclusionPreconditions(
          { ...baseInput, defenseType, rapReportStatus: status },
          "PASSED",
        );
        expect(result.ok).toBe(false);
        expect(result.statusCode).toBe(409);
      }
    }
  });

  it("permits conclusion for every stage when the RAP is FINALIZED", () => {
    for (const defenseType of STAGES) {
      const result = validateConclusionPreconditions(
        { ...baseInput, defenseType, rapReportStatus: "FINALIZED" },
        "PASSED",
      );
      expect(result.ok).toBe(true);
      expect(result.outcome).toBe("PASSED");
    }
  });

  it("legacy Rapporteur notes never substitute for the in-system RAP (Proposal/Final)", () => {
    for (const defenseType of ["PROPOSAL_DEFENSE", "FINAL_DEFENSE"]) {
      const result = validateConclusionPreconditions(
        {
          ...baseInput,
          defenseType,
          rapReportStatus: null,
          rapporteurNotesFinalized: true,
        },
        "PASSED",
      );
      expect(result.ok).toBe(false);
      expect(result.statusCode).toBe(409);
    }
  });

  it("a FINALIZED report makes unfinalized legacy notes irrelevant", () => {
    const result = validateConclusionPreconditions(
      { ...baseInput, rapReportStatus: "FINALIZED", rapporteurNotesFinalized: false },
      "REDEFENSE_REQUIRED",
    );
    expect(result.ok).toBe(true);
    expect(result.outcome).toBe("REDEFENSE_REQUIRED");
  });

  it("a non-Chairman is still rejected before any RAP gating", () => {
    const result = validateConclusionPreconditions(
      {
        ...baseInput,
        rapReportStatus: "FINALIZED",
        isSessionChairman: false,
        sessionRole: "PANELIST",
      },
      "PASSED",
    );
    expect(result.ok).toBe(false);
    expect(result.statusCode).toBe(403);
  });
});
