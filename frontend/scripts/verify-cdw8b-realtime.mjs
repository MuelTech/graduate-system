// CDW-8B — realtime event contracts, React Query invalidation mapping, socket
// lifecycle source contracts, and polling fallback.
//
// Run: node --experimental-strip-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/verify-cdw8b-realtime.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  DEFENSE_REALTIME_EVENT_NAMES,
  convergenceQueryTargets,
  isDefenseRealtimeActiveStatus,
  parseDefenseJoinAck,
  parseDefenseRealtimeEvent,
  queryTargetsForDefenseRealtimeEvent,
  targetsForMountedSchedule,
} from "../src/lib/realtime/defense-realtime-events.ts";
import { normalizeDefenseRealtimeBaseUrl } from "../src/lib/realtime/defense-socket-url.ts";

const root = process.cwd();
const read = (relative) => readFileSync(resolve(root, relative), "utf8");

const PAGE =
  "src/app/(portal)/panelist/defense-workspace/[scheduleId]/page.tsx";
const HOOK = "src/hooks/use-defense-realtime.ts";
const SOCKET = "src/lib/realtime/defense-socket.ts";
const EVENTS = "src/lib/realtime/defense-realtime-events.ts";
const URL_HELPER = "src/lib/realtime/defense-socket-url.ts";
const COLLAB_HOOK = "src/hooks/use-defense-collaboration.ts";
const COLLAB_CLIENT = "src/lib/pdf-annotation/collaboration-client.ts";
const PROVIDER =
  "src/components/defense-workspace/student-document-collaboration.tsx";
const REPORT = "src/components/defense-workspace/committee-report-panel.tsx";
const VERDICT = "src/components/defense-workspace/chairman-verdict-panel.tsx";
const RAP_PANEL = "src/components/defense-workspace/rap-signature-panel.tsx";
const ORAL_FORM = "src/components/defense-workspace/oral-evaluation-form.tsx";
const COMMENTS_RAIL =
  "src/components/defense-workspace/shared-comments-rail.tsx";
const ROLE_RAIL = "src/components/defense-workspace/role-rail.tsx";
const SHELL = "src/components/defense-workspace/workspace-shell.tsx";

const base = {
  eventId: "evt-1",
  scheduleId: "sched-1",
  occurredAt: "2026-10-17T00:00:00.000Z",
};

function event(name, extra = {}) {
  return { eventName: name, ...base, ...extra };
}

test("CDW-8B realtime files exist", () => {
  for (const file of [PAGE, HOOK, SOCKET, EVENTS, URL_HELPER]) {
    assert.equal(existsSync(resolve(root, file)), true, `${file} should exist`);
  }
});

test("exactly the nine canonical events are declared", () => {
  assert.deepEqual([...DEFENSE_REALTIME_EVENT_NAMES].sort(), [
    "annotation.comment.created",
    "annotation.created",
    "defense.concluded",
    "defense.started",
    "evaluation.finalized",
    "rap.finalized",
    "rap.signature.recorded",
    "report.draft.updated",
    "report.ready_for_signature",
  ]);
});

test("defense.started invalidates workspace + own evaluation only", () => {
  assert.deepEqual(
    queryTargetsForDefenseRealtimeEvent(
      event("defense.started", { sessionStatus: "IN_PROGRESS" }),
    ),
    [{ target: "workspace" }, { target: "oralEvaluation" }],
  );
});

test("annotation events use the exact documentId from the event", () => {
  assert.deepEqual(
    queryTargetsForDefenseRealtimeEvent(
      event("annotation.created", {
        thesisDocumentId: "doc-exact",
        annotationId: "ann-1",
      }),
    ),
    [{ target: "annotations", documentId: "doc-exact" }],
  );
  assert.deepEqual(
    queryTargetsForDefenseRealtimeEvent(
      event("annotation.comment.created", {
        thesisDocumentId: "doc-exact",
        annotationId: "ann-1",
        commentId: "comment-1",
      }),
    ),
    [{ target: "annotations", documentId: "doc-exact" }],
  );
});

test("report draft invalidates only the committee report", () => {
  assert.deepEqual(
    queryTargetsForDefenseRealtimeEvent(
      event("report.draft.updated", { reportId: "rap-1", bodyVersion: 3 }),
    ),
    [{ target: "committeeReport" }],
  );
});

test("evaluation.finalized never targets another user's evaluation", () => {
  assert.deepEqual(
    queryTargetsForDefenseRealtimeEvent(event("evaluation.finalized")),
    [
      { target: "workspace" },
      { target: "committeeReport" },
      { target: "conclusionReadiness" },
    ],
  );
});

test("freeze/signature/finalization events invalidate report + workspace + readiness", () => {
  const expected = [
    { target: "committeeReport" },
    { target: "workspace" },
    { target: "conclusionReadiness" },
  ];
  for (const [name, extra] of [
    ["report.ready_for_signature", { reportId: "rap-1", contentVersion: 2 }],
    ["rap.signature.recorded", { reportId: "rap-1", contentVersion: 2 }],
    ["rap.finalized", { reportId: "rap-1", contentVersion: 2 }],
  ]) {
    assert.deepEqual(
      queryTargetsForDefenseRealtimeEvent(event(name, extra)),
      expected,
    );
  }
});

test("defense.concluded invalidates workspace + report + readiness", () => {
  assert.deepEqual(
    queryTargetsForDefenseRealtimeEvent(
      event("defense.concluded", { sessionStatus: "CONCLUDED" }),
    ),
    [
      { target: "workspace" },
      { target: "committeeReport" },
      { target: "conclusionReadiness" },
    ],
  );
});

test("an event for another schedule is ignored", () => {
  assert.deepEqual(
    targetsForMountedSchedule(
      event("annotation.created", {
        thesisDocumentId: "doc-1",
        annotationId: "ann-1",
      }),
      "sched-OTHER",
    ),
    [],
  );
  assert.equal(
    targetsForMountedSchedule(
      event("annotation.created", {
        thesisDocumentId: "doc-1",
        annotationId: "ann-1",
      }),
      "sched-1",
    ).length,
    1,
  );
});

test("reconnect convergence targets are authoritative and document-exact", () => {
  assert.deepEqual(convergenceQueryTargets({ documentId: "doc-1" }), [
    { target: "workspace" },
    { target: "annotations", documentId: "doc-1" },
    { target: "committeeReport" },
    { target: "conclusionReadiness" },
    { target: "oralEvaluation" },
  ]);
  assert.deepEqual(convergenceQueryTargets({ documentId: null }), [
    { target: "workspace" },
    { target: "committeeReport" },
    { target: "conclusionReadiness" },
    { target: "oralEvaluation" },
  ]);
});

test("only SCHEDULED / IN_PROGRESS / AWAITING_CONCLUSION permit realtime", () => {
  for (const status of ["SCHEDULED", "IN_PROGRESS", "AWAITING_CONCLUSION"]) {
    assert.equal(isDefenseRealtimeActiveStatus(status), true, status);
  }
  for (const status of [
    "CONCLUDED",
    "CANCELLED",
    "UNSCHEDULED",
    null,
    undefined,
  ]) {
    assert.equal(isDefenseRealtimeActiveStatus(status), false, String(status));
  }
});

test("event parsing accepts canonical payloads and strips private fields", () => {
  const parsed = parseDefenseRealtimeEvent("annotation.created", {
    ...base,
    thesisDocumentId: "doc-1",
    annotationId: "ann-1",
    body: "private comment",
    signatureData: "data:image/png;base64,secret",
  });
  assert.deepEqual(parsed, {
    eventName: "annotation.created",
    ...base,
    thesisDocumentId: "doc-1",
    annotationId: "ann-1",
  });
  assert.doesNotMatch(
    JSON.stringify(parsed),
    /private comment|signatureData|secret/,
  );
});

test("event parsing rejects malformed / unknown events", () => {
  assert.equal(parseDefenseRealtimeEvent("report.body", { ...base }), null);
  assert.equal(parseDefenseRealtimeEvent("evaluation.finalized", {}), null);
  assert.equal(
    parseDefenseRealtimeEvent("annotation.created", {
      ...base,
      annotationId: "ann-1",
    }),
    null,
  );
  assert.equal(
    parseDefenseRealtimeEvent("report.draft.updated", {
      ...base,
      reportId: "rap-1",
      bodyVersion: "3",
    }),
    null,
  );
  assert.equal(
    parseDefenseRealtimeEvent("defense.concluded", {
      ...base,
      sessionStatus: "IN_PROGRESS",
    }),
    null,
  );
});

test("join acknowledgements are validated and fail closed", () => {
  assert.deepEqual(parseDefenseJoinAck({ ok: true, room: "defense:sched-1" }), {
    ok: true,
    room: "defense:sched-1",
  });
  assert.deepEqual(parseDefenseJoinAck({ ok: false, code: "NOT_ACTIVE" }), {
    ok: false,
    code: "NOT_ACTIVE",
  });
  assert.deepEqual(parseDefenseJoinAck({ ok: false, code: "UNKNOWN" }), {
    ok: false,
    code: "FORBIDDEN",
  });
  assert.deepEqual(parseDefenseJoinAck(null), {
    ok: false,
    code: "FORBIDDEN",
  });
});

test("backend URL normalization never appends or keeps /api", () => {
  assert.equal(
    normalizeDefenseRealtimeBaseUrl(undefined),
    "http://localhost:5000",
  );
  assert.equal(
    normalizeDefenseRealtimeBaseUrl("http://localhost:5000/"),
    "http://localhost:5000",
  );
  assert.equal(
    normalizeDefenseRealtimeBaseUrl("http://localhost:5000/api"),
    "http://localhost:5000",
  );
  assert.equal(
    normalizeDefenseRealtimeBaseUrl("http://localhost:5000/api/"),
    "http://localhost:5000",
  );
  assert.equal(
    normalizeDefenseRealtimeBaseUrl("  http://localhost:5000//  "),
    "http://localhost:5000",
  );
});

test("the workspace page is the single realtime connection owner", () => {
  const page = read(PAGE);
  assert.match(page, /useDefenseRealtime\(/);
  assert.equal((page.match(/useDefenseRealtime\(/g) ?? []).length, 1);

  const leaves = [
    PROVIDER,
    COMMENTS_RAIL,
    REPORT,
    ORAL_FORM,
    RAP_PANEL,
    VERDICT,
    ROLE_RAIL,
    SHELL,
  ]
    .map(read)
    .join("\n");
  assert.doesNotMatch(
    leaves,
    /socket\.io-client|createDefenseSocket|useDefenseRealtime/,
  );
});

test("socket module authenticates through handshake auth, never a query token", () => {
  const socket = read(SOCKET);
  assert.match(socket, /socket\.io-client/);
  assert.match(socket, /auth:\s*\{\s*token/);
  assert.match(socket, /autoConnect:\s*false/);
  assert.doesNotMatch(socket, /query\s*:/);
  assert.doesNotMatch(socket, /\/api`|\/api\"|\/api'/);
});

test("the hook joins on every connect, converges, and cleans up on unmount", () => {
  const hook = read(HOOK);
  assert.match(hook, /useSession\(/);
  assert.match(hook, /createDefenseSocket/);
  assert.match(hook, /joinDefenseRoom/);
  assert.match(hook, /leaveDefenseRoom/);
  assert.match(hook, /socket\.on\("connect"/);
  assert.match(hook, /connect_error/);
  assert.match(hook, /convergenceQueryTargets/);
  assert.match(hook, /invalidateQueries/);
  assert.match(hook, /socket\.off/);
  assert.match(hook, /removeAllListeners|socket\.off/);
  assert.match(hook, /disconnect\(\)/);
  assert.match(hook, /return\s*\(\)\s*=>/);
  assert.match(hook, /targetsForMountedSchedule\(/);
  assert.match(hook, /UNAUTHORIZED/);
  assert.doesNotMatch(hook, /setQueryData|queryClient\.setQueryData/);
  assert.doesNotMatch(hook, /apiClientRequest|method:\s*"POST"|fetch\(/);
});

test("defense.concluded invalidates then disconnects without rejoining", () => {
  const hook = read(HOOK);
  assert.match(hook, /defense\.concluded/);
  assert.match(hook, /disconnect\(\)/);
  assert.match(hook, /isDefenseRealtimeActiveStatus/);
});

test("duplicate event delivery is idempotent invalidation only", () => {
  const payload = event("annotation.created", {
    thesisDocumentId: "doc-1",
    annotationId: "ann-1",
  });
  const first = queryTargetsForDefenseRealtimeEvent(payload);
  const second = queryTargetsForDefenseRealtimeEvent(payload);
  assert.deepEqual(first, second);
  for (const target of first) {
    assert.equal("mutation" in target, false);
    assert.equal(target.target, "annotations");
  }
});

test("polling fallback remains in the workspace and collaboration layer", () => {
  const page = read(PAGE);
  assert.match(page, /refetchInterval/);
  assert.match(page, /20000/);

  const collabClient = read(COLLAB_CLIENT);
  assert.match(collabClient, /COLLAB_POLL_INTERVAL_MS\s*=\s*15000/);
  assert.match(read(COLLAB_HOOK), /refetchInterval/);
  assert.match(read(REPORT), /refetchInterval/);
  assert.match(read(VERDICT), /refetchInterval:\s*15000/);

  const hook = read(HOOK);
  assert.match(hook, /polling|fallback|REST/i);
});

test("the realtime layer performs no academic writes", () => {
  const combined = [HOOK, SOCKET, EVENTS].map(read).join("\n");
  assert.doesNotMatch(
    combined,
    /["']annotation\.create["']|["']evaluation\.finalize["']|["']report\.freeze["']|["']rap\.sign["']|["']defense\.conclude["']/,
  );
  assert.doesNotMatch(combined, /method:\s*"POST"|apiClientRequest/);
});
