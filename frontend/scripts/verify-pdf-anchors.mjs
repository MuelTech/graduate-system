// CDW-0A proof — pure anchor serialization / restore / zoom-invariance checks.
//
// These assertions intentionally exercise ONLY the framework-free anchor module
// (frontend/src/lib/pdf-annotation/anchors.ts). They prove the parts of the POC
// that must be deterministic, independent of the browser render loop.
//
// Run: node --experimental-strip-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/verify-pdf-anchors.mjs
import test from "node:test";
import assert from "node:assert/strict";

import {
  ANCHOR_VERSION,
  buildAnchor,
  serializeAnchor,
  deserializeAnchor,
  isValidAnchor,
  normalizeRects,
  denormalizeRects,
} from "../src/lib/pdf-annotation/anchors.ts";

const PAGE = { width: 600, height: 800 };

// Float-safe geometry comparison (normalization introduces binary fractions).
function assertRectsClose(actual, expected, epsilon = 1e-9) {
  assert.equal(actual.length, expected.length, "rect count");
  actual.forEach((rect, i) => {
    for (const key of ["x", "y", "width", "height"]) {
      assert.ok(
        Math.abs(rect[key] - expected[i][key]) < epsilon,
        `rect[${i}].${key}: ${rect[key]} !~ ${expected[i][key]}`,
      );
    }
  });
}

function assertPageRectsClose(actual, expected, epsilon = 1e-9) {
  assert.equal(actual.length, expected.length, "rect count");
  actual.forEach((rect, i) => {
    for (const key of ["left", "top", "width", "height"]) {
      assert.ok(
        Math.abs(rect[key] - expected[i][key]) < epsilon,
        `rect[${i}].${key}: ${rect[key]} !~ ${expected[i][key]}`,
      );
    }
  });
}

test("normalizeRects maps page-pixel rects into 0..1 page space", () => {
  const rects = normalizeRects([{ left: 60, top: 80, width: 120, height: 16 }], PAGE);
  assertRectsClose(rects, [{ x: 0.1, y: 0.1, width: 0.2, height: 0.02 }]);
});

test("normalizeRects clamps coordinates that fall outside the page", () => {
  const rects = normalizeRects([{ left: -10, top: -10, width: 10000, height: 10000 }], PAGE);
  assertRectsClose(rects, [{ x: 0, y: 0, width: 1, height: 1 }]);
});

test("denormalizeRects inverts normalizeRects", () => {
  const original = [{ left: 60, top: 160, width: 240, height: 32 }];
  const roundTripped = denormalizeRects(normalizeRects(original, PAGE), PAGE);
  assertPageRectsClose(roundTripped, original);
});

test("buildAnchor captures page, text, geometry, prefix/suffix and version", () => {
  const anchor = buildAnchor({
    pageNumber: 3,
    selectedText: "depth of the study",
    prefix: "the ",
    suffix: " is sound",
    clientRects: [{ left: 60, top: 80, width: 120, height: 16 }],
    page: PAGE,
  });
  assert.equal(anchor.anchorVersion, ANCHOR_VERSION);
  assert.equal(anchor.pageNumber, 3);
  assert.equal(anchor.selectedText, "depth of the study");
  assertRectsClose(anchor.rects, [{ x: 0.1, y: 0.1, width: 0.2, height: 0.02 }]);
  assert.equal(anchor.prefix, "the ");
  assert.equal(anchor.suffix, " is sound");
});

test("buildAnchor defaults missing prefix/suffix to empty strings", () => {
  const anchor = buildAnchor({
    pageNumber: 1,
    selectedText: "x",
    clientRects: [{ left: 1, top: 2, width: 3, height: 4 }],
    page: PAGE,
  });
  assert.equal(anchor.prefix, "");
  assert.equal(anchor.suffix, "");
});

test("serializeAnchor/deserializeAnchor round-trips an anchor exactly", () => {
  const anchor = buildAnchor({
    pageNumber: 2,
    selectedText: "organization",
    prefix: "a",
    suffix: "b",
    clientRects: [{ left: 60, top: 80, width: 120, height: 16 }],
    page: PAGE,
  });
  assert.deepEqual(deserializeAnchor(serializeAnchor(anchor)), anchor);
});

test("deserializeAnchor rejects invalid JSON and structurally invalid payloads", () => {
  assert.throws(() => deserializeAnchor("not json"));
  assert.throws(() => deserializeAnchor(JSON.stringify({ pageNumber: 1 })));
  assert.throws(() => deserializeAnchor(JSON.stringify({ anchorVersion: ANCHOR_VERSION })));
});

test("deserializeAnchor rejects an unsupported anchor version", () => {
  const valid = buildAnchor({
    pageNumber: 1,
    selectedText: "x",
    clientRects: [{ left: 1, top: 2, width: 3, height: 4 }],
    page: PAGE,
  });
  assert.throws(() =>
    deserializeAnchor(JSON.stringify({ ...valid, anchorVersion: ANCHOR_VERSION + 1 })),
  );
});

test("a highlight anchored at 100% stays on the same text at 200% zoom", () => {
  const anchorRects = normalizeRects([{ left: 60, top: 80, width: 120, height: 16 }], PAGE);
  const at100 = denormalizeRects(anchorRects, { width: 600, height: 800 });
  const at200 = denormalizeRects(anchorRects, { width: 1200, height: 1600 });
  assertPageRectsClose(at100, [{ left: 60, top: 80, width: 120, height: 16 }]);
  assertPageRectsClose(at200, [{ left: 120, top: 160, width: 240, height: 32 }]);
  // The stored anchor is zoom-independent: re-normalizing the 200% geometry
  // yields the identical normalized rects.
  assertRectsClose(normalizeRects(at200, { width: 1200, height: 1600 }), anchorRects);
});

test("isValidAnchor accepts a real anchor and rejects junk", () => {
  const anchor = buildAnchor({
    pageNumber: 1,
    selectedText: "x",
    clientRects: [],
    page: PAGE,
  });
  assert.equal(isValidAnchor(anchor), true);
  assert.equal(isValidAnchor({}), false);
  assert.equal(isValidAnchor(null), false);
  assert.equal(isValidAnchor("anchor"), false);
});
