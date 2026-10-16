// CDW-2 — framework-free viewer core + CDW-1 annotation-read parsing checks.
//
// Run: node --experimental-strip-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/verify-viewer-core.mjs
import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_ZOOM,
  MAX_ZOOM,
  MIN_ZOOM,
  clampPage,
  clampZoom,
  computeFitWidthScale,
  hasUsableTextLayer,
  isAnchorOnPage,
  rectsForAnchorOnPage,
  resolveFocusPage,
  stepPage,
  zoomIn,
  zoomOut,
} from "../src/lib/pdf-annotation/viewer-core.ts";

import { filterAnchorsForDocument, parseCollaborationAnnotations } from "../src/lib/pdf-annotation/annotations.ts";

const PAGE = { width: 600, height: 800 };

function anchor(overrides = {}) {
  return {
    anchorVersion: 1,
    pageNumber: 2,
    selectedText: "hello",
    rects: [{ x: 0.1, y: 0.1, width: 0.2, height: 0.02 }],
    prefix: "",
    suffix: "",
    ...overrides,
  };
}

test("clampZoom bounds and rejects non-finite input", () => {
  assert.equal(clampZoom(10), MAX_ZOOM);
  assert.equal(clampZoom(0.01), MIN_ZOOM);
  assert.equal(clampZoom(1.25), 1.25);
  assert.equal(clampZoom(Number.NaN), DEFAULT_ZOOM);
});

test("zoomIn/zoomOut step and clamp", () => {
  assert.equal(zoomIn(1), 1.25);
  assert.equal(zoomOut(1), 0.75);
  assert.equal(zoomIn(MAX_ZOOM), MAX_ZOOM);
  assert.equal(zoomOut(MIN_ZOOM), MIN_ZOOM);
});

test("clampPage bounds to 1..total", () => {
  assert.equal(clampPage(0, 5), 1);
  assert.equal(clampPage(99, 5), 5);
  assert.equal(clampPage(3, 5), 3);
  assert.equal(clampPage(2, 0), 1);
});

test("stepPage moves within bounds", () => {
  assert.equal(stepPage(1, 1, 3), 2);
  assert.equal(stepPage(3, 1, 3), 3);
  assert.equal(stepPage(1, -1, 3), 1);
});

test("computeFitWidthScale derives a clamped scale from container width", () => {
  assert.equal(computeFitWidthScale(600, 300), 0.5);
  assert.equal(computeFitWidthScale(600, 1200), 2);
  assert.equal(computeFitWidthScale(600, 100000), MAX_ZOOM);
  assert.equal(computeFitWidthScale(0, 500), DEFAULT_ZOOM);
  assert.equal(computeFitWidthScale(600, 0), DEFAULT_ZOOM);
});

test("rectsForAnchorOnPage denormalizes against the current page size (zoom-stable)", () => {
  const a = anchor();
  const at100 = rectsForAnchorOnPage(a, { width: 600, height: 800 });
  const at200 = rectsForAnchorOnPage(a, { width: 1200, height: 1600 });
  assert.equal(at100[0].left, 60);
  assert.equal(at100[0].top, 80);
  assert.equal(at200[0].left, 120);
  assert.equal(at200[0].top, 160);
});

test("isAnchorOnPage matches only the anchor page", () => {
  assert.equal(isAnchorOnPage(anchor({ pageNumber: 2 }), 2), true);
  assert.equal(isAnchorOnPage(anchor({ pageNumber: 2 }), 3), false);
});

test("resolveFocusPage returns the page of a focused annotation (or null)", () => {
  const items = [
    { id: "a1", anchor: anchor({ pageNumber: 1 }) },
    { id: "a2", anchor: anchor({ pageNumber: 4 }) },
  ];
  assert.equal(resolveFocusPage(items, "a2"), 4);
  assert.equal(resolveFocusPage(items, "missing"), null);
  assert.equal(resolveFocusPage(items, null), null);
});

test("hasUsableTextLayer is true only with non-whitespace text", () => {
  assert.equal(hasUsableTextLayer([{ str: "Hi" }]), true);
  assert.equal(hasUsableTextLayer([{ str: "   " }, { str: "" }]), false);
  assert.equal(hasUsableTextLayer([]), false);
});

test("filterAnchorsForDocument never carries another document's anchors", () => {
  const items = [
    { id: "a", thesisDocumentId: "doc-1" },
    { id: "b", thesisDocumentId: "doc-2" },
  ];
  assert.deepEqual(
    filterAnchorsForDocument(items, "doc-1").map((i) => i.id),
    ["a"],
  );
});

test("parseCollaborationAnnotations keeps valid expected-document anchors", () => {
  const raw = {
    annotations: [
      { id: "a1", scheduleId: "s1", thesisDocumentId: "doc-1", anchor: anchor(), author: { userId: "u1", name: "N", role: "PANELIST" } },
    ],
  };
  const result = parseCollaborationAnnotations(raw, "doc-1");
  assert.equal(result.annotations.length, 1);
  assert.equal(result.annotations[0].id, "a1");
  assert.equal(result.annotations[0].pageNumber, 2);
  assert.equal(result.annotations[0].author.role, "PANELIST");
  assert.equal(result.skipped, 0);
});

test("parseCollaborationAnnotations drops other-document and malformed anchors", () => {
  const raw = {
    annotations: [
      { id: "a1", thesisDocumentId: "doc-2", anchor: anchor() },
      { id: "a2", thesisDocumentId: "doc-1", anchor: { anchorVersion: 99 } },
      { id: "a3", thesisDocumentId: "doc-1", anchor: anchor(), author: { name: "ok" } },
      null,
    ],
  };
  const result = parseCollaborationAnnotations(raw, "doc-1");
  assert.deepEqual(result.annotations.map((a) => a.id), ["a3"]);
  assert.equal(result.skipped, 3);
});

test("parseCollaborationAnnotations tolerates a bare array and empty/unknown payloads", () => {
  assert.equal(parseCollaborationAnnotations([], "doc-1").annotations.length, 0);
  assert.equal(parseCollaborationAnnotations({ annotations: "nope" }, "doc-1").annotations.length, 0);
  assert.equal(parseCollaborationAnnotations(null, "doc-1").annotations.length, 0);
});
