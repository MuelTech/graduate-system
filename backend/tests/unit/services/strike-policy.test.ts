import { afterEach, describe, expect, it } from "vitest";
import {
  getFinalOptionalGates,
  resolveStrikePolicy,
} from "../../../src/services/strike-policy";
import { DEFAULT_FINAL_OPTIONAL_GATES } from "../../../src/services/defense-gates.config";

describe("resolveStrikePolicy", () => {
  afterEach(() => {
    delete process.env.STRIKE_BEFORE_FINAL_REQUIRED;
  });

  it("defaults to the established Final optional gates (not mandatory)", () => {
    const p = resolveStrikePolicy();
    expect(p.required).toBe(DEFAULT_FINAL_OPTIONAL_GATES.requireStrike);
    expect(p.required).toBe(false);
    expect(p.source).toBe("DEFAULT");
  });

  it("supports ops override via env", () => {
    process.env.STRIKE_BEFORE_FINAL_REQUIRED = "true";
    expect(resolveStrikePolicy()).toEqual({ required: true, source: "ENV" });
    process.env.STRIKE_BEFORE_FINAL_REQUIRED = "false";
    expect(resolveStrikePolicy()).toEqual({ required: false, source: "ENV" });
  });

  it("getFinalOptionalGates uses the same policy source", () => {
    process.env.STRIKE_BEFORE_FINAL_REQUIRED = "true";
    expect(getFinalOptionalGates().requireStrike).toBe(true);
    process.env.STRIKE_BEFORE_FINAL_REQUIRED = "false";
    expect(getFinalOptionalGates().requireStrike).toBe(false);
  });
});
