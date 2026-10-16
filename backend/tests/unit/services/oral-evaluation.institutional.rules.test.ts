import { describe, expect, it } from "vitest";

import {
  INSTITUTIONAL_RATING_SCALE,
  INSTITUTIONAL_RATING_VALUES,
  calculateInstitutionalScores,
  isInstitutionalEvaluationComplete,
  isInstitutionalRatingValue,
  validateInstitutionalCriterionValue,
} from "../../../src/services/oral-evaluation.institutional.rules";

/**
 * CDW-4 FIX — the institutional Individual Evaluation matrix is the authoritative
 * scoring model for NEW evaluations (INSTITUTIONAL_MATRIX_V2).
 *
 * This is intentionally separate from the legacy 10/15-point rules: legacy rows
 * are never reinterpreted into this scale.
 */
describe("oral-evaluation.institutional.rules", () => {
  it("exposes the exact institutional scale with no 2.25", () => {
    expect([...INSTITUTIONAL_RATING_VALUES]).toEqual([1, 1.25, 1.5, 1.75, 2, 2.5]);
    expect(INSTITUTIONAL_RATING_VALUES).not.toContain(2.25);
    expect(INSTITUTIONAL_RATING_SCALE.map((l) => l.value)).toEqual([
      1, 1.25, 1.5, 1.75, 2, 2.5,
    ]);
    expect(INSTITUTIONAL_RATING_SCALE.map((l) => l.code)).toEqual([
      "E", "HS", "VS", "S", "BS", "F",
    ]);
    expect(INSTITUTIONAL_RATING_SCALE[0].label).toBe("Excellent");
    expect(INSTITUTIONAL_RATING_SCALE[5].label).toBe("Fail");
  });

  it("accepts only the six allowed rating values", () => {
    for (const ok of [1, 1.25, 1.5, 1.75, 2, 2.5]) {
      expect(isInstitutionalRatingValue(ok)).toBe(true);
    }
    for (const bad of [0, 0.5, 1.1, 2.25, 2.75, 3, -1, NaN, "1.25", null]) {
      expect(isInstitutionalRatingValue(bad as number)).toBe(false);
    }
  });

  it("allows an empty (partial draft) value but rejects out-of-scale values", () => {
    expect(validateInstitutionalCriterionValue("organization", null)).toEqual({
      ok: true,
      value: null,
    });
    expect(validateInstitutionalCriterionValue("organization", "")).toEqual({
      ok: true,
      value: null,
    });
    expect(validateInstitutionalCriterionValue("organization", 1.75)).toEqual({
      ok: true,
      value: 1.75,
    });

    for (const bad of [0, 0.5, 2.25, 2.75, 3, 1.1, -1]) {
      expect(validateInstitutionalCriterionValue("organization", bad as never).ok).toBe(
        false,
      );
    }
    expect(validateInstitutionalCriterionValue("organization", "abc" as never).ok).toBe(
      false,
    );
    expect(validateInstitutionalCriterionValue("organization", NaN as never).ok).toBe(
      false,
    );
  });

  it("derives Group I and Group II averages only from complete groups", () => {
    const complete = calculateInstitutionalScores({
      timelinessRelevance: 1,
      organization: 1.25,
      depthComprehensiveness: 1.5,
      relevanceConclusions: 1.75,
      evidenceOriginalThinking: 2,
      presentation: 1,
      masterySubject: 1.25,
      communicationSkill: 1.5,
      attitude: 1.75,
    });
    // Group I: (1 + 1.25 + 1.5 + 1.75 + 2) / 5 = 1.5
    expect(complete.groupIAverage).toBe(1.5);
    // Group II: (1 + 1.25 + 1.5 + 1.75) / 4 = 1.375
    expect(complete.groupIIAverage).toBe(1.375);

    // Incomplete group → no fabricated average.
    const partial = calculateInstitutionalScores({
      presentation: 1,
      masterySubject: 1.25,
    });
    expect(partial.groupIAverage).toBeNull();
    expect(partial.groupIIAverage).toBeNull();
  });

  it("never produces an Overall or a derived Rating", () => {
    const result = calculateInstitutionalScores({
      timelinessRelevance: 1,
      organization: 1,
      depthComprehensiveness: 1,
      relevanceConclusions: 1,
      evidenceOriginalThinking: 1,
      presentation: 1,
      masterySubject: 1,
      communicationSkill: 1,
      attitude: 1,
    }) as Record<string, unknown>;
    expect(result).not.toHaveProperty("overallAverage");
    expect(result).not.toHaveProperty("overallValue");
    expect(result).not.toHaveProperty("rating");
  });

  it("requires all nine institutional ratings to be complete", () => {
    const all = {
      timelinessRelevance: 1,
      organization: 1.25,
      depthComprehensiveness: 1.5,
      relevanceConclusions: 1.75,
      evidenceOriginalThinking: 2,
      presentation: 1,
      masterySubject: 1.25,
      communicationSkill: 1.5,
      attitude: 2.5,
    };
    expect(isInstitutionalEvaluationComplete(all)).toBe(true);
    expect(
      isInstitutionalEvaluationComplete({ ...all, attitude: null }),
    ).toBe(false);
    expect(isInstitutionalEvaluationComplete({ organization: 1.5 })).toBe(false);
    // An out-of-scale value is not "complete".
    expect(
      isInstitutionalEvaluationComplete({ ...all, attitude: 2.25 as never }),
    ).toBe(false);
  });
});
