import { describe, expect, it } from "vitest";

import {
  ANCHOR_LIMITS,
  SUPPORTED_ANCHOR_VERSION,
  validateAnchorPayload,
} from "../../../src/services/anchor-validation.rules";

const VALID = {
  anchorVersion: 1,
  pageNumber: 2,
  selectedText: "depth and comprehensiveness of treatment",
  rects: [{ x: 0.1, y: 0.2, width: 0.3, height: 0.02 }],
  prefix: "the ",
  suffix: " is sound",
};

describe("validateAnchorPayload (CDW-1 v1 anchor)", () => {
  it("accepts a valid v1 anchor and returns a normalized payload", () => {
    const result = validateAnchorPayload(VALID);
    expect(result.ok).toBe(true);
    expect(result.anchor).toEqual(VALID);
  });

  it("defaults missing optional prefix/suffix to empty strings", () => {
    const { prefix: _p, suffix: _s, ...noContext } = VALID;
    const result = validateAnchorPayload(noContext);
    expect(result.ok).toBe(true);
    expect(result.anchor?.prefix).toBe("");
    expect(result.anchor?.suffix).toBe("");
  });

  it("rejects an unsupported or missing anchor version", () => {
    expect(validateAnchorPayload({ ...VALID, anchorVersion: 2 }).ok).toBe(false);
    expect(validateAnchorPayload({ ...VALID, anchorVersion: SUPPORTED_ANCHOR_VERSION + 1 }).ok).toBe(false);
    const { anchorVersion: _v, ...noVersion } = VALID;
    expect(validateAnchorPayload(noVersion).ok).toBe(false);
  });

  it("rejects a non-integer or out-of-range page number", () => {
    expect(validateAnchorPayload({ ...VALID, pageNumber: 0 }).ok).toBe(false);
    expect(validateAnchorPayload({ ...VALID, pageNumber: -1 }).ok).toBe(false);
    expect(validateAnchorPayload({ ...VALID, pageNumber: 1.5 }).ok).toBe(false);
    expect(validateAnchorPayload({ ...VALID, pageNumber: "2" }).ok).toBe(false);
  });

  it("rejects empty or over-long selected text", () => {
    expect(validateAnchorPayload({ ...VALID, selectedText: "" }).ok).toBe(false);
    expect(validateAnchorPayload({ ...VALID, selectedText: "   " }).ok).toBe(false);
    expect(
      validateAnchorPayload({
        ...VALID,
        selectedText: "x".repeat(ANCHOR_LIMITS.maxSelectedTextLength + 1),
      }).ok,
    ).toBe(false);
  });

  it("rejects a missing, empty, or oversized rect list", () => {
    expect(validateAnchorPayload({ ...VALID, rects: [] }).ok).toBe(false);
    expect(validateAnchorPayload({ ...VALID, rects: "nope" }).ok).toBe(false);
    expect(
      validateAnchorPayload({
        ...VALID,
        rects: Array.from({ length: ANCHOR_LIMITS.maxRects + 1 }, () => ({
          x: 0,
          y: 0,
          width: 0.1,
          height: 0.1,
        })),
      }).ok,
    ).toBe(false);
  });

  it("rejects non-finite coordinates (NaN / Infinity)", () => {
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(
        validateAnchorPayload({
          ...VALID,
          rects: [{ x: bad, y: 0, width: 0.1, height: 0.1 }],
        }).ok,
      ).toBe(false);
    }
  });

  it("rejects negative or zero-size geometry", () => {
    expect(
      validateAnchorPayload({ ...VALID, rects: [{ x: -0.01, y: 0, width: 0.1, height: 0.1 }] }).ok,
    ).toBe(false);
    expect(
      validateAnchorPayload({ ...VALID, rects: [{ x: 0, y: -0.01, width: 0.1, height: 0.1 }] }).ok,
    ).toBe(false);
    expect(
      validateAnchorPayload({ ...VALID, rects: [{ x: 0, y: 0, width: 0, height: 0.1 }] }).ok,
    ).toBe(false);
    expect(
      validateAnchorPayload({ ...VALID, rects: [{ x: 0, y: 0, width: 0.1, height: 0 }] }).ok,
    ).toBe(false);
  });

  it("rejects geometry that overflows the page box (x+width>1 or y+height>1)", () => {
    expect(
      validateAnchorPayload({ ...VALID, rects: [{ x: 0.95, y: 0, width: 0.1, height: 0.1 }] }).ok,
    ).toBe(false);
    expect(
      validateAnchorPayload({ ...VALID, rects: [{ x: 0, y: 0.95, width: 0.1, height: 0.1 }] }).ok,
    ).toBe(false);
    expect(
      validateAnchorPayload({ ...VALID, rects: [{ x: 0, y: 0, width: 1.01, height: 0.1 }] }).ok,
    ).toBe(false);
    expect(
      validateAnchorPayload({ ...VALID, rects: [{ x: 0, y: 0, width: 0.1, height: 1.01 }] }).ok,
    ).toBe(false);
  });

  it("rejects over-long prefix/suffix context", () => {
    expect(
      validateAnchorPayload({
        ...VALID,
        prefix: "p".repeat(ANCHOR_LIMITS.maxContextLength + 1),
      }).ok,
    ).toBe(false);
    expect(
      validateAnchorPayload({
        ...VALID,
        suffix: "s".repeat(ANCHOR_LIMITS.maxContextLength + 1),
      }).ok,
    ).toBe(false);
  });

  it("rejects non-object payloads", () => {
    expect(validateAnchorPayload(null).ok).toBe(false);
    expect(validateAnchorPayload("anchor").ok).toBe(false);
    expect(validateAnchorPayload([]).ok).toBe(false);
  });
});
