import { describe, expect, it } from "vitest";
import { examConfigurationDto, validateExamConfiguration } from "../../../src/services/exam-configuration.rules";

describe("B1 typed draft configuration contract", () => {
  it("represents missing values without legacy defaults", () => {
    expect(examConfigurationDto(validateExamConfiguration({ passingThreshold: null }))).toEqual({
      examDurationMinutes: null, mcqPointsPerCorrectItem: null, essayMaximumScore: null,
      passingThreshold: null, passingThresholdUnit: null, timezone: "Asia/Manila", isComplete: false,
    });
  });

  it("preserves partial configuration and fractional point values", () => {
    expect(examConfigurationDto(validateExamConfiguration({ mcqPointsPerCorrectItem: 2.25 }))).toMatchObject({
      examDurationMinutes: null, mcqPointsPerCorrectItem: 2.25, essayMaximumScore: null, isComplete: false,
    });
  });

  it("keeps all representable values incomplete while threshold semantics are unresolved", () => {
    expect(examConfigurationDto(validateExamConfiguration({ examDurationMinutes: 95, mcqPointsPerCorrectItem: 2.5, essayMaximumScore: 42, passingThreshold: null }))).toEqual({
      examDurationMinutes: 95, mcqPointsPerCorrectItem: 2.5, essayMaximumScore: 42,
      passingThreshold: null, passingThresholdUnit: null, timezone: "Asia/Manila", isComplete: false,
    });
  });

  it.each([null, undefined, {}, [], "value", 1, true, { timezone: "UTC" }, { isComplete: true }, { active: true }, { programId: "other" }, { passingThreshold: 75 }, { passingThreshold: { value: 75, unit: "PERCENT" } }, { passingThresholdUnit: "POINTS" }])("rejects malformed/unsupported or unapproved authority %#", value => {
    expect(() => validateExamConfiguration(value)).toThrow();
  });

  for (const field of ["examDurationMinutes", "mcqPointsPerCorrectItem", "essayMaximumScore"]) {
    it.each(["12", "abc", "", false, {}, [], -1, 0, -Infinity, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1])(`rejects invalid ${field} %#`, value => {
      expect(() => validateExamConfiguration({ [field]: value })).toThrow();
    });
    it(`allows explicit null for ${field}`, () => {
      expect(validateExamConfiguration({ [field]: null })[field as "examDurationMinutes"]).toBeNull();
    });
  }

  it.each([1.5, Number.MAX_SAFE_INTEGER])("rejects duration fractions and unsafe minute arithmetic %s", value => {
    expect(() => validateExamConfiguration({ examDurationMinutes: value })).toThrow();
  });

  it("does not invent a narrow institutional maximum", () => {
    expect(validateExamConfiguration({ examDurationMinutes: 100_000, essayMaximumScore: 100_000 })).toMatchObject({ examDurationMinutes: 100_000, essayMaximumScore: 100_000 });
  });
});
