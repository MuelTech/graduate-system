import { describe, expect, it } from "vitest";
import { calculatePoints } from "../../../src/services/exam-result.rules";
import { validateExamConfiguration, examConfigurationDto } from "../../../src/services/exam-configuration.rules";

describe("B8 exact arithmetic and complete configuration", () => {
  it("74.9999% fails even though display rounding says 75.00%", () => {
    expect(calculatePoints(0,1,"1","74.9999","99","75")).toMatchObject({ result: "FAILED", finalEarnedPoints: "74.9999", maximumPossiblePoints: "100" });
  });
  it("exact equality passes", () => expect(calculatePoints(0,1,"1","75","99","75").result).toBe("PASSED"));
  it("uses all significant digits beyond Decimal's default precision", () => {
    expect(calculatePoints(0,1,"1","74.999999999999999999999999999999","99","75").result).toBe("FAILED");
  });
  it("adds decimal points exactly", () => expect(calculatePoints(1,1,"0.1","0.2","0.3","75")).toMatchObject({ finalEarnedPoints: "0.3", maximumPossiblePoints: "0.4", result: "PASSED" }));
  it("a subnormal configured MCQ denominator cannot disappear before comparison", () => {
    expect(calculatePoints(0,1,"5e-324","1","1","100").result).toBe("FAILED");
  });
  it.each([0, -1, 100.0001, "75", NaN, Infinity, -Infinity])("rejects invalid configured threshold %s", value => {
    expect(() => validateExamConfiguration({ passingThreshold: value })).toThrow();
  });
  it.each([0.001, 62.5, 75, 100])("accepts configured percentage %s with fixed unit", passingThreshold => {
    const config = examConfigurationDto(validateExamConfiguration({ examDurationMinutes: 60, mcqPointsPerCorrectItem: 0.125, essayMaximumScore: 12.5, passingThreshold }));
    expect(config).toMatchObject({ passingThreshold, passingThresholdUnit: "PERCENT", isComplete: true });
  });
  it.each(["examDurationMinutes","mcqPointsPerCorrectItem","essayMaximumScore","passingThreshold"])("null %s remains incomplete without defaults", field => {
    expect(examConfigurationDto(validateExamConfiguration({ examDurationMinutes: 60, mcqPointsPerCorrectItem: 2, essayMaximumScore: 25, passingThreshold: 50, [field]: null })).isComplete).toBe(false);
  });
});
