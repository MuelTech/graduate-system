import { describe, expect, it } from "vitest";
import {
  DEFAULT_STALE_TEMP_HOURS,
  resolveStorageOperationsConfig,
} from "../../../src/config/storage.config";

/**
 * DL-11: operational diagnostics config. These values are classification-only;
 * they never drive deletion or retention.
 */
describe("resolveStorageOperationsConfig", () => {
  it("defaults stale temp hours to 24 when unset", () => {
    expect(resolveStorageOperationsConfig().staleTempHours).toBe(
      DEFAULT_STALE_TEMP_HOURS,
    );
    expect(resolveStorageOperationsConfig().staleTempHours).toBe(24);
  });

  it("accepts an explicit valid stale temp threshold", () => {
    expect(
      resolveStorageOperationsConfig({ staleTempHours: "6" }).staleTempHours,
    ).toBe(6);
  });

  it("falls back predictably for invalid/zero/negative thresholds", () => {
    for (const raw of ["", "abc", "0", "-5", undefined]) {
      expect(
        resolveStorageOperationsConfig({ staleTempHours: raw }).staleTempHours,
      ).toBe(24);
    }
  });

  it("leaves capacity pressure unclassified when min free percent is unset", () => {
    expect(resolveStorageOperationsConfig().minFreePercent).toBeNull();
    expect(
      resolveStorageOperationsConfig({ minFreePercent: "" }).minFreePercent,
    ).toBeNull();
  });

  it("accepts a valid min free percent within 0..100", () => {
    expect(
      resolveStorageOperationsConfig({ minFreePercent: "15" }).minFreePercent,
    ).toBe(15);
    expect(
      resolveStorageOperationsConfig({ minFreePercent: 0 }).minFreePercent,
    ).toBe(0);
    expect(
      resolveStorageOperationsConfig({ minFreePercent: "100" }).minFreePercent,
    ).toBe(100);
  });

  it("ignores out-of-range or non-numeric min free percent", () => {
    for (const raw of ["-1", "101", "abc", "NaN"]) {
      expect(
        resolveStorageOperationsConfig({ minFreePercent: raw }).minFreePercent,
      ).toBeNull();
    }
  });
});
