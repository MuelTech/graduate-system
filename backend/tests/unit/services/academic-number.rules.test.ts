import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  meanAcademicValues,
  roundAcademicValue,
} from "../../../src/services/academic-number.rules";

describe("academic-number.rules", () => {
  it("rounds an exact midpoint to the nearest hundredth, away from zero", () => {
    expect(roundAcademicValue(1.225)).toBe(1.23);
    expect(roundAcademicValue("1.225")).toBe(1.23);
    expect(roundAcademicValue(new Prisma.Decimal("1.225"))).toBe(1.23);
  });

  it("rounds below and above the midpoint normally", () => {
    expect(roundAcademicValue(1.224)).toBe(1.22);
    expect(roundAcademicValue(1.226)).toBe(1.23);
    expect(roundAcademicValue(1.2)).toBe(1.2);
    expect(roundAcademicValue(1)).toBe(1);
  });

  it("returns null for missing or non-finite values", () => {
    expect(roundAcademicValue(null)).toBeNull();
    expect(roundAcademicValue(undefined)).toBeNull();
    expect(roundAcademicValue("")).toBeNull();
    expect(roundAcademicValue(Number.NaN)).toBeNull();
    expect(roundAcademicValue(Number.POSITIVE_INFINITY)).toBeNull();
  });

  it("averages using decimal arithmetic and rounds once at the end", () => {
    expect(meanAcademicValues([1.23, 1.25, 1.2, 1.4, 1.3])).toBe(1.28);
    expect(meanAcademicValues([1.2, 1.25])).toBe(1.23);
    expect(meanAcademicValues(["1.20", "1.25"])).toBe(1.23);
  });

  it("returns null when the mean cannot be safely computed", () => {
    expect(meanAcademicValues([])).toBeNull();
    expect(meanAcademicValues([1.2, null])).toBeNull();
    expect(meanAcademicValues([1.2, "not-a-number"])).toBeNull();
  });
});
