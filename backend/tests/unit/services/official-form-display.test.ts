import { describe, expect, it } from "vitest";

import {
  formatOfficialApplicationDate,
  formatOfficialApplicationDateTime,
} from "../../../src/services/official-form-display";
import { AppError } from "../../../src/utils/AppError";

describe("official application submission display (Asia/Manila)", () => {
  it("formats the same instant consistently in Philippine local time", () => {
    const instant = "2026-10-23T06:35:00.000Z";
    expect(formatOfficialApplicationDate(instant)).toBe("23 October 2026");
    expect(formatOfficialApplicationDateTime(instant)).toBe(
      "23 October 2026, 2:35 PM",
    );
  });

  it("rolls the date forward when UTC is still the previous day", () => {
    const instant = "2026-10-23T22:30:00.000Z";
    expect(formatOfficialApplicationDate(instant)).toBe("24 October 2026");
    expect(formatOfficialApplicationDateTime(instant)).toBe(
      "24 October 2026, 6:30 AM",
    );
  });

  it("formats Philippine midnight as 12:00 AM on the correct date", () => {
    const instant = "2026-10-23T16:00:00.000Z";
    expect(formatOfficialApplicationDate(instant)).toBe("24 October 2026");
    expect(formatOfficialApplicationDateTime(instant)).toBe(
      "24 October 2026, 12:00 AM",
    );
  });

  it("formats Philippine noon as 12:00 PM", () => {
    const instant = "2026-10-23T04:00:00.000Z";
    expect(formatOfficialApplicationDateTime(instant)).toBe(
      "23 October 2026, 12:00 PM",
    );
  });

  it("returns blank for a missing legacy timestamp", () => {
    expect(formatOfficialApplicationDate(null)).toBe("");
    expect(formatOfficialApplicationDateTime(undefined)).toBe("");
  });

  it("fails closed for an invalid timestamp", () => {
    expect(() => formatOfficialApplicationDate("not-a-date")).toThrow(AppError);
    expect(() => formatOfficialApplicationDateTime("not-a-date")).toThrow(
      AppError,
    );
  });
});
