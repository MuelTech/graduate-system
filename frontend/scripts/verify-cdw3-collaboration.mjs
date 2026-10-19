// CDW-3 — shared annotations / comment rail / polling.
//
// Framework-free pure-logic checks over the collaboration client + annotation
// read model, plus static source contracts over the collaboration UI.
//
// Run: node --experimental-strip-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/verify-cdw3-collaboration.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  annotationsQueryKey,
  defenseAnnotationsUrl,
  canAnnotateRole,
  canCommentRole,
  isCollaborationActive,
  collaborationPollIntervalMs,
  normalizeCommentInput,
  collaborationErrorMessage,
  formatCommentTimestamp,
  MAX_COMMENT_LENGTH,
  COLLAB_POLL_INTERVAL_MS,
} from "../src/lib/pdf-annotation/collaboration-client.ts";

import {
  parseCollaborationAnnotations,
  topLevelComments,
  repliesFor,
} from "../src/lib/pdf-annotation/annotations.ts";

const root = process.cwd();
const read = (relative) => readFileSync(resolve(root, relative), "utf8");

const CONTAINER = "src/components/defense-workspace/student-document-collaboration.tsx";
const RAIL = "src/components/defense-workspace/shared-comments-rail.tsx";
const THREAD = "src/components/defense-workspace/annotation-thread.tsx";
const VIEWER = "src/components/defense-workspace/collaborative-manuscript-viewer.tsx";
const PAGE = "src/components/defense-workspace/manuscript-page.tsx";
const HOOK = "src/hooks/use-defense-collaboration.ts";

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

function comment(overrides = {}) {
  return {
    id: "c1",
    annotationId: "a1",
    parentCommentId: null,
    body: "why not X?",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    author: { assignmentId: "pa1", userId: "u1", name: "N", role: "PANELIST" },
    ...overrides,
  };
}

function annotation(overrides = {}) {
  return {
    id: "a1",
    scheduleId: "s1",
    thesisDocumentId: "doc-1",
    pageNumber: 2,
    selectedText: "hello",
    anchor: anchor(),
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    author: { assignmentId: "pa1", userId: "u1", name: "N", role: "PANELIST" },
    comments: [],
    ...overrides,
  };
}

// ---- Read model / parsing -------------------------------------------------

test("parses annotation comments with author role and parentCommentId", () => {
  const raw = {
    annotations: [
      annotation({
        comments: [
          comment({ id: "c1", body: "top" }),
          comment({ id: "c2", parentCommentId: "c1", body: "reply" }),
        ],
      }),
    ],
  };
  const result = parseCollaborationAnnotations(raw, "doc-1");
  assert.equal(result.annotations.length, 1);
  const a = result.annotations[0];
  assert.equal(a.comments.length, 2);
  assert.equal(a.comments[0].body, "top");
  assert.equal(a.comments[0].parentCommentId, null);
  assert.equal(a.comments[1].parentCommentId, "c1");
  assert.equal(a.comments[0].author.role, "PANELIST");
  assert.equal(a.comments[0].author.assignmentId, "pa1");
});

test("drops malformed comments but keeps the annotation", () => {
  const raw = {
    annotations: [
      annotation({
        comments: [
          comment(),
          null,
          { id: "bad" },
          { id: "c3", body: "ok", author: {}, annotationId: "a1", parentCommentId: null },
        ],
      }),
    ],
  };
  const result = parseCollaborationAnnotations(raw, "doc-1");
  assert.equal(result.annotations.length, 1);
  assert.deepEqual(
    result.annotations[0].comments.map((c) => c.id),
    ["c1", "c3"],
  );
});

test("still drops wrong-document and structurally invalid annotations", () => {
  const raw = {
    annotations: [
      annotation({ id: "a2", thesisDocumentId: "doc-2" }),
      annotation({ id: "a3", anchor: { anchorVersion: 99 } }),
      annotation({ id: "a4" }),
    ],
  };
  const result = parseCollaborationAnnotations(raw, "doc-1");
  assert.deepEqual(result.annotations.map((a) => a.id), ["a4"]);
  assert.equal(result.skipped, 2);
});

test("topLevelComments and repliesFor partition a flat thread", () => {
  const a = annotation({
    comments: [comment({ id: "c1" }), comment({ id: "c2", parentCommentId: "c1" })],
  });
  assert.deepEqual(topLevelComments(a).map((c) => c.id), ["c1"]);
  assert.deepEqual(repliesFor(a, "c1").map((c) => c.id), ["c2"]);
});

// ---- Role gating ----------------------------------------------------------

test("annotation creation is Chairman/Panelist only", () => {
  assert.equal(canAnnotateRole("CHAIRMAN"), true);
  assert.equal(canAnnotateRole("PANELIST"), true);
  assert.equal(canAnnotateRole("RAPPORTEUR"), false);
  assert.equal(canAnnotateRole("ADVISER"), false);
  assert.equal(canAnnotateRole("FACILITATOR"), false);
});

test("commenting/reply is Chairman/Panelist/Rapporteur", () => {
  assert.equal(canCommentRole("CHAIRMAN"), true);
  assert.equal(canCommentRole("PANELIST"), true);
  assert.equal(canCommentRole("RAPPORTEUR"), true);
  assert.equal(canCommentRole("ADVISER"), false);
  assert.equal(canCommentRole("FACILITATOR"), false);
});

// ---- State locking / polling ---------------------------------------------

test("collaboration is writable only in active, non-frozen states", () => {
  assert.equal(isCollaborationActive("SCHEDULED", null), true);
  assert.equal(isCollaborationActive("IN_PROGRESS", "DRAFT"), true);
  assert.equal(isCollaborationActive("AWAITING_CONCLUSION", "DRAFT"), true);
  assert.equal(isCollaborationActive("AWAITING_CONCLUSION", null), true);
  for (const frozen of ["FOR_SIGNATURE", "PARTIALLY_SIGNED", "ALL_SIGNED", "FINALIZED"]) {
    assert.equal(isCollaborationActive("IN_PROGRESS", frozen), false);
    assert.equal(isCollaborationActive("AWAITING_CONCLUSION", frozen), false);
  }
  assert.equal(isCollaborationActive("CONCLUDED", "FINALIZED"), false);
  assert.equal(isCollaborationActive("CANCELLED", null), false);
  assert.equal(isCollaborationActive("UNSCHEDULED", null), false);
});

test("polling is active only while collaboration is active", () => {
  assert.equal(collaborationPollIntervalMs("IN_PROGRESS", null), COLLAB_POLL_INTERVAL_MS);
  assert.equal(collaborationPollIntervalMs("SCHEDULED", null), COLLAB_POLL_INTERVAL_MS);
  assert.equal(collaborationPollIntervalMs("CONCLUDED", "FINALIZED"), false);
  assert.equal(collaborationPollIntervalMs("CANCELLED", null), false);
  assert.equal(collaborationPollIntervalMs("AWAITING_CONCLUSION", "FOR_SIGNATURE"), false);
});

// ---- Query contract -------------------------------------------------------

test("annotation query key + url are scoped to the exact attempt document", () => {
  assert.deepEqual(annotationsQueryKey("s1", "doc-1"), ["defenseAnnotations", "s1", "doc-1"]);
  assert.equal(
    defenseAnnotationsUrl("s1", "doc-1"),
    "/thesis/defense/s1/collaboration/annotations?documentId=doc-1",
  );
  assert.equal(
    defenseAnnotationsUrl("s1", "doc/ with space"),
    "/thesis/defense/s1/collaboration/annotations?documentId=doc%2F%20with%20space",
  );
});

// ---- Comment input --------------------------------------------------------

test("normalizeCommentInput trims, rejects blank, enforces max length", () => {
  assert.deepEqual(normalizeCommentInput("  hi  "), { ok: true, body: "hi" });
  assert.equal(normalizeCommentInput("   ").ok, false);
  assert.equal(normalizeCommentInput("").ok, false);
  assert.equal(normalizeCommentInput(undefined).ok, false);
  assert.equal(normalizeCommentInput(123).ok, false);
  assert.equal(normalizeCommentInput("x".repeat(MAX_COMMENT_LENGTH)).ok, true);
  assert.equal(normalizeCommentInput("x".repeat(MAX_COMMENT_LENGTH + 1)).ok, false);
});

test("collaborationErrorMessage maps states to safe messages (no raw backend text)", () => {
  assert.match(collaborationErrorMessage({ statusCode: 409 }), /state changed/i);
  assert.match(collaborationErrorMessage({ statusCode: 403 }), /permission/i);
  assert.match(collaborationErrorMessage({ statusCode: 400 }), /could not be saved/i);
  const generic = collaborationErrorMessage(new Error("P2002 raw prisma"));
  assert.doesNotMatch(generic, /P2002|prisma/i);
  assert.ok(generic.length > 0);
});

// ---- Source contracts -----------------------------------------------------

test("collaboration UI components exist", () => {
  for (const file of [CONTAINER, RAIL, THREAD, HOOK]) {
    assert.equal(existsSync(resolve(root, file)), true, `${file} should exist`);
  }
});

test("one React Query source owns the annotation read (hook), not the viewer", () => {
  const hook = read(HOOK);
  assert.match(hook, /\/collaboration\/annotations/);
  const container = read(CONTAINER);
  assert.match(container, /parseCollaborationAnnotations/);
  const viewer = read(VIEWER);
  // Viewer is controlled: no internal annotation fetch.
  assert.doesNotMatch(viewer, /\/collaboration\/annotations/);
  assert.doesNotMatch(viewer, /useQuery/);
  assert.match(viewer, /annotations/);
});

test("viewer + page still perform no write/mutation request", () => {
  const combined = read(VIEWER) + read(PAGE);
  assert.doesNotMatch(combined, /method:\s*["'`](POST|PUT|PATCH|DELETE)/i);
  assert.doesNotMatch(combined, /\bFormData\b/);
});

test("the collaboration container uses the exact server-resolved document id (no latest fallback)", () => {
  const container = read(CONTAINER);
  assert.match(container, /documentId/);
  assert.doesNotMatch(container, /documents\/latest|latestDocument|isCurrent/i);
  const page = read("src/app/(portal)/panelist/defense-workspace/[scheduleId]/page.tsx");
  assert.match(page, /StudentDocumentCollaboration/);
  assert.match(page, /documentId=\{primaryDoc\.id\}/);
});

test("highlight overlay stays pointer-transparent and page hit-tests highlight clicks", () => {
  const css = read("src/components/defense-workspace/manuscript-viewer.css");
  assert.match(css, /\.mwOverlay[\s\S]*?pointer-events:\s*none/);
  const page = read(PAGE);
  assert.match(page, /onAnnotationSelect/);
});

test("no Socket.IO / realtime in the CDW-3 collaboration UI", () => {
  const combined = read(HOOK) + read(CONTAINER) + read(RAIL) + read(THREAD);
  assert.doesNotMatch(combined, /socket\.io|Socket\.IO|io\(/);
  // NOTE: Insert into Report is implemented in CDW-5 (see verify-cdw5-report).
});

test("text selection stages a pending anchor; persistence happens only on explicit submit", () => {
  const container = read(CONTAINER);
  // Selection only stages the draft; the atomic create carries the initialComment.
  assert.match(container, /setPendingAnchor\(anchor\)/);
  assert.match(container, /initialComment:\s*body/);
});

test("clicking an All Comments item selects the thread and focuses the PDF anchor", () => {
  const rail = read(RAIL);
  assert.match(rail, /onSelectAnnotation\(/);
  assert.match(rail, /onViewChange\("selected"\)/);
  assert.match(rail, /selectedAnnotationId/);
});

test("the rail exposes Selected + All Comments views and reply wiring", () => {
  const rail = read(RAIL);
  assert.match(rail, /Selected/);
  assert.match(rail, /All Comments/);
  const thread = read(THREAD);
  assert.match(thread, /parentCommentId|reply/i);
});

// ---- CDW-3 correction pass contracts --------------------------------------

test("read-only viewer preserves native text selection/copy (no anchor, no clearing)", () => {
  const page = read(PAGE);
  // When there is no annotation callback, a non-collapsed selection returns
  // BEFORE anchoring/clearing so the browser keeps the selection for copy.
  assert.match(page, /if\s*\(\s*!callbacksRef\.current\.onTextSelection\s*\)\s*return/);
  // Writable path still clears once the draft owns the interaction.
  assert.match(page, /removeAllRanges/);
});

test("409 conflict refreshes the workspace state, not only annotations", () => {
  const container = read(CONTAINER);
  assert.match(container, /useQueryClient/);
  assert.match(container, /invalidateQueries/);
  assert.match(container, /"defenseWorkspace",\s*scheduleId/);
});

test("mutation errors reset between composer sessions", () => {
  const container = read(CONTAINER);
  // Either `mutation.reset()` or a destructured reset helper is acceptable.
  assert.match(container, /\.reset\(\)|reset(Create|Reply)\(\)/);
});

test("comment timestamps use local time (never silently display UTC)", () => {
  assert.equal(formatCommentTimestamp(null), "");
  assert.equal(formatCommentTimestamp("not-a-date"), "");
  const iso = "2026-03-03T09:04:00.000Z";
  const date = new Date(iso);
  const options = {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  };
  const localExpected = new Intl.DateTimeFormat("en-US", options).format(date);
  assert.equal(formatCommentTimestamp(iso), localExpected);
  // When the environment is not UTC, local output must differ from a forced-UTC
  // rendering (i.e. it is not silently UTC).
  if (date.getTimezoneOffset() !== 0) {
    const utc = new Intl.DateTimeFormat("en-US", { ...options, timeZone: "UTC" }).format(date);
    assert.notEqual(formatCommentTimestamp(iso), utc);
  }
});
