import { describe, expect, it } from "vitest";
import {
  DefenseConclusionService,
  hasConclusionAuthority,
  validateConclusionPreconditions,
} from "../../../src/services/defense-conclusion.service";

const baseInput = {
  alreadyConcluded: false,
  actorRole: "ADMIN",
  evaluatorAssignments: 2,
  submittedEvaluatorScores: 2,
  defenseType: "PROPOSAL_DEFENSE",
  selectedTitleId: null,
  thesisTitleIds: ["a", "b", "c"],
};

describe("conclusion authorization (interim ADMIN)", () => {
  it("allows ADMIN only", () => {
    expect(hasConclusionAuthority("ADMIN")).toBe(true);
    expect(hasConclusionAuthority("PANELIST")).toBe(false);
    expect(hasConclusionAuthority("STUDENT")).toBe(false);
    expect(hasConclusionAuthority("CUSTOM")).toBe(false);
  });

  it("rejects non-admin concluder", () => {
    const result = validateConclusionPreconditions(
      { ...baseInput, actorRole: "PANELIST" },
      "PASSED",
    );
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toMatch(/authorized concluder/i);
  });
});

describe("score completion does not conclude", () => {
  it("requires all evaluator scores before conclusion", () => {
    const result = validateConclusionPreconditions(
      { ...baseInput, submittedEvaluatorScores: 1 },
      "PASSED",
    );
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toMatch(/evaluator scores/i);
  });

  it("blocks double conclusion", () => {
    const result = validateConclusionPreconditions(
      { ...baseInput, alreadyConcluded: true },
      "PASSED",
    );
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toMatch(/already been concluded/i);
  });
});

describe("Title conclusion requires selected title", () => {
  it("rejects Title PASSED without selection", () => {
    const result = validateConclusionPreconditions(
      {
        ...baseInput,
        defenseType: "TITLE_DEFENSE",
        selectedTitleId: null,
      },
      "PASSED",
    );
    expect(result.ok).toBe(false);
  });

  it("rejects Title PASSED with foreign title id", () => {
    const result = validateConclusionPreconditions(
      {
        ...baseInput,
        defenseType: "TITLE_DEFENSE",
        selectedTitleId: "zzz",
      },
      "PASSED",
    );
    expect(result.ok).toBe(false);
  });

  it("allows Title PASSED with a proposed title", () => {
    const result = validateConclusionPreconditions(
      {
        ...baseInput,
        defenseType: "TITLE_DEFENSE",
        selectedTitleId: "b",
      },
      "PASSED",
    );
    expect(result.ok).toBe(true);
    expect(result.outcome).toBe("PASSED");
  });

  it("does not require title selection for FAILED Title conclusion", () => {
    const result = validateConclusionPreconditions(
      {
        ...baseInput,
        defenseType: "TITLE_DEFENSE",
        selectedTitleId: null,
      },
      "FAILED",
    );
    expect(result.ok).toBe(true);
    expect(result.outcome).toBe("FAILED");
  });
});

describe("outcome normalization", () => {
  it("accepts REVISION alias and maps to REVISION_REQUIRED", () => {
    const svc = new DefenseConclusionService();
    const outcome = svc.assertCanConclude(baseInput, "REVISION");
    expect(outcome).toBe("REVISION_REQUIRED");
  });

  it("rejects APPROVED as an outcome", () => {
    const result = validateConclusionPreconditions(baseInput, "APPROVED");
    expect(result.ok).toBe(false);
  });
});
