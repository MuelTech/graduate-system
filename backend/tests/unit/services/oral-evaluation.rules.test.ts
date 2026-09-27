import { describe, expect, it } from "vitest";
import {
  areAllCriteriaComplete,
  calculateEvaluationScores,
  canEditEvaluation,
  canFinalizeEvaluation,
  isNumericalEvaluationComplete,
  isNumericalEvaluationDefense,
  isEvaluatorRole,
  validateCriterionValue,
} from "../../../src/services/oral-evaluation.rules";

describe("oral-evaluation.rules (CP5)", () => {
  it("Test 6: Title Defense rejected; Proposal/Final allowed", () => {
    expect(isNumericalEvaluationDefense("TITLE_DEFENSE")).toBe(false);
    expect(isNumericalEvaluationDefense("PROPOSAL_DEFENSE")).toBe(true);
    expect(isNumericalEvaluationDefense("FINAL_DEFENSE")).toBe(true);
  });

  it("Test 2–5: evaluator roles only CHAIRMAN + PANELIST", () => {
    expect(isEvaluatorRole("CHAIRMAN")).toBe(true);
    expect(isEvaluatorRole("PANELIST")).toBe(true);
    expect(isEvaluatorRole("RAPPORTEUR")).toBe(false);
    expect(isEvaluatorRole("FACILITATOR")).toBe(false);
    expect(isEvaluatorRole("ADVISER")).toBe(false);
  });

  it("Test 11: criterion validation rejects invalid values", () => {
    expect(validateCriterionValue("organization", -1).ok).toBe(false);
    expect(validateCriterionValue("organization", 11).ok).toBe(false);
    expect(validateCriterionValue("organization", "abc").ok).toBe(false);
    expect(validateCriterionValue("organization", 10).ok).toBe(true);
    expect(validateCriterionValue("organization", null)).toEqual({
      ok: true,
      value: null,
    });
  });

  it("Test 12: server-derived Group I/II/overall are point sums", () => {
    const d = calculateEvaluationScores({
      timelinessRelevance: 10,
      organization: 10,
      depthComprehensiveness: 15,
      relevanceConclusions: 10,
      evidenceOriginalThinking: 15,
      presentation: 10,
      masterySubject: 8,
      communicationSkill: 10,
      attitude: 9,
    });
    expect(d.groupIValue).toBe(60);
    expect(d.groupIIValue).toBe(37);
    expect(d.overallValue).toBe(97);
  });

  it("Test 10: partial criteria not complete; complete criteria complete", () => {
    expect(areAllCriteriaComplete({ organization: 5 })).toBe(false);
    expect(
      areAllCriteriaComplete({
        timelinessRelevance: 1,
        organization: 1,
        depthComprehensiveness: 1,
        relevanceConclusions: 1,
        evidenceOriginalThinking: 1,
        presentation: 1,
        masterySubject: 1,
        communicationSkill: 1,
        attitude: 1,
      }),
    ).toBe(true);
  });

  it("Test 14–18: finalize gates and immutability", () => {
    expect(canEditEvaluation("DRAFT")).toBe(true);
    expect(canEditEvaluation("FINALIZED")).toBe(false);
    expect(
      canFinalizeEvaluation({
        status: "DRAFT",
        criteriaComplete: false,
        signaturePresent: true,
      }).allowed,
    ).toBe(false);
    expect(
      canFinalizeEvaluation({
        status: "DRAFT",
        criteriaComplete: true,
        signaturePresent: false,
      }).allowed,
    ).toBe(false);
    expect(
      canFinalizeEvaluation({
        status: "FINALIZED",
        criteriaComplete: true,
        signaturePresent: true,
      }).allowed,
    ).toBe(false);
    expect(
      canFinalizeEvaluation({
        status: "DRAFT",
        criteriaComplete: true,
        signaturePresent: true,
      }).allowed,
    ).toBe(true);
  });

  it("Test 21–23/25: completion uses FINALIZED evaluators; Title skips", () => {
    expect(isNumericalEvaluationComplete("TITLE_DEFENSE", 4, 0)).toBe(true);
    expect(isNumericalEvaluationComplete("PROPOSAL_DEFENSE", 4, 3)).toBe(false);
    expect(isNumericalEvaluationComplete("PROPOSAL_DEFENSE", 4, 4)).toBe(true);
    expect(isNumericalEvaluationComplete("PROPOSAL_DEFENSE", 0, 0)).toBe(false);
  });
});
