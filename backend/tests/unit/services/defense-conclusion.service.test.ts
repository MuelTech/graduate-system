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
  selectedTitleId: null,
  thesisTitleIds: ["a", "b", "c"],
  outcomeProvided: true,
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
  it("Test 16: Rapporteur notes not finalized → 409", () => {
    const result = validateConclusionPreconditions(
      { ...baseInput, rapporteurNotesFinalized: false },
      "PASSED",
    );
    expect(result.ok).toBe(false);
    expect(result.statusCode).toBe(409);
    expect(result.errors.join(" ")).toMatch(/Rapporteur/i);
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

describe("CP7 Title conclusion selected-title rules", () => {
  it("Test 18: Title PASSED without selectedTitleId → 400", () => {
    const result = validateConclusionPreconditions(
      {
        ...baseInput,
        defenseType: "TITLE_DEFENSE",
        oralSummaryExists: false,
        evaluatorAssignments: 0,
        finalizedEvaluatorScores: 0,
        selectedTitleId: null,
      },
      "PASSED",
    );
    expect(result.ok).toBe(false);
    expect(result.statusCode).toBe(400);
  });

  it("Test 19: cross-thesis selected title rejected", () => {
    const result = validateConclusionPreconditions(
      {
        ...baseInput,
        defenseType: "TITLE_DEFENSE",
        oralSummaryExists: false,
        evaluatorAssignments: 0,
        finalizedEvaluatorScores: 0,
        selectedTitleId: "zzz",
      },
      "PASSED",
    );
    expect(result.ok).toBe(false);
    expect(result.statusCode).toBe(400);
  });

  it("Title PASSED with a student title is allowed", () => {
    const result = validateConclusionPreconditions(
      {
        ...baseInput,
        defenseType: "TITLE_DEFENSE",
        oralSummaryExists: false,
        evaluatorAssignments: 0,
        finalizedEvaluatorScores: 0,
        selectedTitleId: "b",
      },
      "PASSED",
    );
    expect(result.ok).toBe(true);
  });

  it("Title FAILED does not require selected title", () => {
    const result = validateConclusionPreconditions(
      {
        ...baseInput,
        defenseType: "TITLE_DEFENSE",
        oralSummaryExists: false,
        evaluatorAssignments: 0,
        finalizedEvaluatorScores: 0,
        selectedTitleId: null,
      },
      "FAILED",
    );
    expect(result.ok).toBe(true);
    expect(result.outcome).toBe("FAILED");
  });

  it("Title skips numerical Summary/evaluator prerequisites", () => {
    const result = validateConclusionPreconditions(
      {
        ...baseInput,
        defenseType: "TITLE_DEFENSE",
        oralSummaryExists: false,
        evaluatorAssignments: 0,
        finalizedEvaluatorScores: 0,
        selectedTitleId: "b",
      },
      "PASSED",
    );
    expect(result.ok).toBe(true);
  });
});

describe("CP7 outcome safety", () => {
  it("accepts REVISION alias and maps to REVISION_REQUIRED", () => {
    expect(resolveExplicitOutcome("REVISION")).toBe("REVISION_REQUIRED");
    const svc = new DefenseConclusionService();
    const outcome = svc.assertCanConclude(
      { ...baseInput, outcomeProvided: true },
      "REVISION",
    );
    expect(outcome).toBe("REVISION_REQUIRED");
  });

  it("Test 20: outcome is independent of numeric score", () => {
    // Even with a high average the Chairman may record REVISION_REQUIRED.
    const result = validateConclusionPreconditions(baseInput, "REVISION_REQUIRED");
    expect(result.ok).toBe(true);
    expect(result.outcome).toBe("REVISION_REQUIRED");
  });

  it("isSessionChairmanRole recognizes CHAIRMAN only", () => {
    expect(isSessionChairmanRole("CHAIRMAN")).toBe(true);
    expect(isSessionChairmanRole("PANELIST")).toBe(false);
    expect(isSessionChairmanRole(null)).toBe(false);
    expect(isSessionChairmanRole("ADMIN")).toBe(false);
  });
});
