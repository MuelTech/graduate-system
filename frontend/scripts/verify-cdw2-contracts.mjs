// CDW-2 — production viewer source contracts (security, immutability, exact doc).
//
// These are static "contract" checks over the production sources, mirroring the
// backend's source-scan tests. They complement the framework-free logic tests.
//
// Run: node --experimental-strip-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/verify-cdw2-contracts.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const read = (relative) => readFileSync(resolve(root, relative), "utf8");

const WORKSPACE_PAGE = "src/app/(portal)/panelist/defense-workspace/[scheduleId]/page.tsx";
const VIEWER = "src/components/defense-workspace/collaborative-manuscript-viewer.tsx";
const PAGE = "src/components/defense-workspace/manuscript-page.tsx";

test("workspace uses the production viewer and no longer embeds the PDF in an iframe", () => {
  const page = read(WORKSPACE_PAGE);
  assert.match(page, /CollaborativeManuscriptViewer/);
  assert.doesNotMatch(page, /<iframe/i);
});

test("workspace passes the exact server-resolved document id (no latest-document fallback)", () => {
  const page = read(WORKSPACE_PAGE);
  assert.match(page, /documentId=\{primaryDoc\.id\}/);
  // No thesis-global "latest document" resolution was introduced on the client.
  assert.doesNotMatch(page, /documents\/latest/i);
  assert.doesNotMatch(page, /latestDocument/i);
});

test("viewer loads the PDF only through the authenticated same-origin proxy", () => {
  const viewer = read(VIEWER);
  assert.match(viewer, /\/api\/documents\/thesis-document\//);
  assert.doesNotMatch(viewer, /\/uploads\//i);
});

test("viewer never references storage internals or absolute backend URLs for the file", () => {
  const combined = read(VIEWER) + read(PAGE);
  assert.doesNotMatch(combined, /filePath/);
  assert.doesNotMatch(combined, /storageKey/);
  assert.doesNotMatch(combined, /NEXT_PUBLIC_BACKEND_API_URL/);
});

test("viewer performs no write/mutation request (overlays only)", () => {
  const combined = read(VIEWER) + read(PAGE);
  assert.doesNotMatch(combined, /method:\s*["'`](POST|PUT|PATCH|DELETE)/i);
  assert.doesNotMatch(combined, /\bFormData\b/);
  assert.doesNotMatch(combined, /apiClientRequest\([^)]*method/i);
});

test("viewer reads CDW-1 annotations but exposes no creation/comment workflow", () => {
  const viewer = read(VIEWER);
  assert.match(viewer, /\/collaboration\/annotations/);
  assert.match(viewer, /parseCollaborationAnnotations/);
  // No comment composer / reply UI / thread rail in CDW-2.
  assert.doesNotMatch(viewer, /AddComment|commentComposer|createComment|replyTo/i);
});

test("viewer does not pull an additional PDF framework", () => {
  const viewer = read(VIEWER);
  assert.doesNotMatch(viewer, /react-pdf|pdf-annotate|@react-pdf-viewer|react-pdf-highlighter/);
  assert.match(viewer, /pdfjs-dist/);
});

test("CDW-0 POC route/components are removed and reusable anchors are retained", () => {
  assert.equal(existsSync(resolve(root, "src/app/poc/pdf-annotation/page.tsx")), false);
  assert.equal(existsSync(resolve(root, "src/components/poc/pdf-annotation-poc.tsx")), false);
  assert.equal(existsSync(resolve(root, "src/components/poc/pdf-annotation-poc.css")), false);
  assert.equal(existsSync(resolve(root, "src/lib/pdf-annotation/anchors.ts")), true);
});

test("viewer reacts to container resize for fit-width and cleans up the observer", () => {
  const viewer = read(VIEWER);
  assert.match(viewer, /ResizeObserver/);
  assert.match(viewer, /\.observe\(/);
  assert.match(viewer, /\.disconnect\(\)/);
  assert.match(viewer, /fitMode/);
  // Manual zoom disables auto-fit; Fit Width re-enables it.
  assert.match(viewer, /setFitMode\(false\)/);
  assert.match(viewer, /setFitMode\(true\)/);
});

test("viewer warns when stored annotations fail to load (distinct from empty success)", () => {
  const viewer = read(VIEWER);
  assert.match(viewer, /annotationsQuery\.isError/);
  assert.match(viewer, /Stored annotations could not be loaded/);
});

test("anchor module documentation reflects production status (no stale POC wording)", () => {
  const anchors = read("src/lib/pdf-annotation/anchors.ts");
  assert.doesNotMatch(anchors, /proof-of-concept/i);
  assert.doesNotMatch(anchors, /NOT yet wired into the production/i);
});
