import { describe, expect, it } from "vitest";
import {
  areAllCriteriaComplete,
  assertEvaluationSessionEditable,
  calculateEvaluationScores,
  canEditEvaluation,
  canFinalizeEvaluation,
  countEvaluatorFinalized,
  isEvaluationComplete,
  isEvaluationStage,
  isEvaluatorRole,
  mergeOptionalField,
  mergePartialCriteria,
  validateCriterionValue,
} from "../../../src/services/oral-evaluation.rules";

describe("oral-evaluation.rules (CP5)", () => {
  it("WF-C1b: all three defense stages use the shared evaluator lifecycle", () => {
    expect(isEvaluationStage("TITLE_DEFENSE")).toBe(true);
    expect(isEvaluationStage("PROPOSAL_DEFENSE")).toBe(true);
    expect(isEvaluationStage("FINAL_DEFENSE")).toBe(true);
    expect(isEvaluationStage("UNKNOWN")).toBe(false);
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

  it("WF-C1b: completion requires every evaluator assignment for all stages", () => {
    // Title is no longer exempt: it needs all evaluator records finalized.
    expect(isEvaluationComplete(5, 0)).toBe(false);
    expect(isEvaluationComplete(5, 4)).toBe(false);
    expect(isEvaluationComplete(5, 5)).toBe(true);
    expect(isEvaluationComplete(4, 3)).toBe(false);
    expect(isEvaluationComplete(4, 4)).toBe(true);
    expect(isEvaluationComplete(0, 0)).toBe(false);
  });

  it("Test 1–3: partial Draft merge preserves omitted fields", () => {
    const existing = {
      organization: 8,
      depthComprehensiveness: 12,
      recommendations: "Improve chapter 3",
    };
    const merged = mergePartialCriteria(existing, { attitude: 9 });
    expect(merged.organization).toBe(8);
    expect(merged.depthComprehensiveness).toBe(12);
    expect(merged.attitude).toBe(9);

    // explicit null clears a criterion when the key is present
    const cleared = mergePartialCriteria(existing, {
      organization: null,
    });
    expect(cleared.organization).toBeNull();
    expect(cleared.depthComprehensiveness).toBe(12);

    expect(
      mergeOptionalField(
        "S",
        { recommendations: "Improve chapter 3" },
        "rating",
      ),
    ).toBe("S");
    expect(mergeOptionalField("S", { rating: null }, "rating")).toBeNull();
  });

  it("CDW-4 Test 4–6: official scoring requires IN_PROGRESS for ALL stages", () => {
    // SCHEDULED is pre-defense review only; no stage may score while SCHEDULED.
    expect(assertEvaluationSessionEditable("SCHEDULED").ok).toBe(false);
    expect(assertEvaluationSessionEditable("SCHEDULED", "TITLE_DEFENSE").ok).toBe(false);
    expect(assertEvaluationSessionEditable("SCHEDULED", "PROPOSAL_DEFENSE").ok).toBe(false);
    expect(assertEvaluationSessionEditable("SCHEDULED", "FINAL_DEFENSE").ok).toBe(false);
    // Only IN_PROGRESS opens official scoring.
    expect(assertEvaluationSessionEditable("IN_PROGRESS").ok).toBe(true);
    expect(assertEvaluationSessionEditable("IN_PROGRESS", "TITLE_DEFENSE").ok).toBe(true);
    expect(assertEvaluationSessionEditable("IN_PROGRESS", "PROPOSAL_DEFENSE").ok).toBe(true);
    expect(assertEvaluationSessionEditable("IN_PROGRESS", "FINAL_DEFENSE").ok).toBe(true);
    // Closed states reject every stage.
    for (const stage of ["TITLE_DEFENSE", "PROPOSAL_DEFENSE", "FINAL_DEFENSE"]) {
      expect(assertEvaluationSessionEditable("AWAITING_CONCLUSION", stage).ok).toBe(false);
      expect(assertEvaluationSessionEditable("CONCLUDED", stage).ok).toBe(false);
      expect(assertEvaluationSessionEditable("CANCELLED", stage).ok).toBe(false);
    }
    expect(assertEvaluationSessionEditable("CONCLUDED").statusCode).toBe(409);
  });

  it("evaluator role uses centralized committee policy", () => {
    expect(isEvaluatorRole("CHAIRMAN")).toBe(true);
    expect(isEvaluatorRole("PANELIST")).toBe(true);
    expect(isEvaluatorRole("RAPPORTEUR")).toBe(false);
  });

  it("Test 7: non-evaluator FINALIZED row does not satisfy completion", () => {
    const evaluators = ["a", "b", "c", "d"];
    const scores = [
      { panelId: "a", status: "FINALIZED" },
      { panelId: "b", status: "FINALIZED" },
      { panelId: "c", status: "FINALIZED" },
      { panelId: "r", status: "FINALIZED" }, // Rapporteur legacy
    ];
    const count = countEvaluatorFinalized(evaluators, scores);
    expect(count).toBe(3);
    expect(isEvaluationComplete(4, count)).toBe(false);
  });
});
