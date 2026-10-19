// CDW-8C — realtime acceptance / regression verifier.
//
// Focus: the accepted CDW-8 architecture remains an invalidation layer over
// REST/database, with no private academic payloads, no socket writes, one
// workspace-level socket owner, preserved polling, and safe conclusion/reconnect
// behavior.
//
// Run: node --experimental-strip-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/verify-cdw8c-acceptance.mjs
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

const PAGE = "src/app/(portal)/panelist/defense-workspace/[scheduleId]/page.tsx";
const HOOK = "src/hooks/use-defense-realtime.ts";
const SOCKET = "src/lib/realtime/defense-socket.ts";
const EVENTS = "src/lib/realtime/defense-realtime-events.ts";
const URL_HELPER = "src/lib/realtime/defense-socket-url.ts";
const COLLAB_HOOK = "src/hooks/use-defense-collaboration.ts";
const COLLAB_CLIENT = "src/lib/pdf-annotation/collaboration-client.ts";
const PROVIDER = "src/components/defense-workspace/student-document-collaboration.tsx";
const COMMENTS_RAIL = "src/components/defense-workspace/shared-comments-rail.tsx";
const REPORT = "src/components/defense-workspace/committee-report-panel.tsx";
const ORAL_FORM = "src/components/defense-workspace/oral-evaluation-form.tsx";
const RAP_PANEL = "src/components/defense-workspace/rap-signature-panel.tsx";
const VERDICT = "src/components/defense-workspace/chairman-verdict-panel.tsx";
const ROLE_RAIL = "src/components/defense-workspace/role-rail.tsx";
const SHELL = "src/components/defense-workspace/workspace-shell.tsx";
const HISTORY = "src/components/defense-workspace/defense-history-panel.tsx";
const HISTORY_HOOK = "src/hooks/use-defense-history.ts";
const PACKAGE = "package.json";

const base = {
  eventId: "evt-1",
  scheduleId: "sched-1",
  occurredAt: "2026-10-17T00:00:00.000Z",
};

function event(name, extra = {}) {
  return { eventName: name, ...base, ...extra };
}

const SAMPLES = {
  "defense.started": { sessionStatus: "IN_PROGRESS" },
  "annotation.created": {
    thesisDocumentId: "doc-1",
    annotationId: "ann-1",
  },
  "annotation.comment.created": {
    thesisDocumentId: "doc-1",
    annotationId: "ann-1",
    commentId: "comment-1",
  },
  "report.draft.updated": { reportId: "rap-1", bodyVersion: 3 },
  "evaluation.finalized": {},
  "report.ready_for_signature": { reportId: "rap-1", contentVersion: 2 },
  "rap.signature.recorded": { reportId: "rap-1", contentVersion: 2 },
  "rap.finalized": { reportId: "rap-1", contentVersion: 2 },
  "defense.concluded": { sessionStatus: "CONCLUDED" },
};

const TARGETS = {
  "defense.started": [{ target: "workspace" }, { target: "oralEvaluation" }],
  "annotation.created": [{ target: "annotations", documentId: "doc-1" }],
  "annotation.comment.created": [
    { target: "annotations", documentId: "doc-1" },
  ],
  "report.draft.updated": [{ target: "committeeReport" }],
  "evaluation.finalized": [
    { target: "workspace" },
    { target: "committeeReport" },
    { target: "conclusionReadiness" },
  ],
  "report.ready_for_signature": [
    { target: "committeeReport" },
    { target: "workspace" },
    { target: "conclusionReadiness" },
  ],
  "rap.signature.recorded": [
    { target: "committeeReport" },
    { target: "workspace" },
    { target: "conclusionReadiness" },
  ],
  "rap.finalized": [
    { target: "committeeReport" },
    { target: "workspace" },
    { target: "conclusionReadiness" },
  ],
  "defense.concluded": [
    { target: "workspace" },
    { target: "committeeReport" },
    { target: "conclusionReadiness" },
  ],
};

test("exactly nine canonical realtime events exist (no tenth)", () => {
  assert.equal(DEFENSE_REALTIME_EVENT_NAMES.length, 9);
  assert.deepEqual(
    [...DEFENSE_REALTIME_EVENT_NAMES].sort(),
    Object.keys(SAMPLES).sort(),
  );
});

test("all canonical realtime files exist", () => {
  for (const file of [PAGE, HOOK, SOCKET, EVENTS, URL_HELPER]) {
    assert.equal(existsSync(resolve(root, file)), true, `${file} should exist`);
  }
});

test("full event -> React Query invalidation map is exact", () => {
  for (const name of DEFENSE_REALTIME_EVENT_NAMES) {
    assert.deepEqual(
      queryTargetsForDefenseRealtimeEvent(event(name, SAMPLES[name])),
      TARGETS[name],
      name,
    );
  }
});

test("wrong scheduleId is ignored before invalidation", () => {
  for (const name of DEFENSE_REALTIME_EVENT_NAMES) {
    assert.deepEqual(
      targetsForMountedSchedule(event(name, SAMPLES[name]), "sched-OTHER"),
      [],
      name,
    );
  }
});

test("annotation events use the exact event thesisDocumentId", () => {
  for (const name of ["annotation.created", "annotation.comment.created"]) {
    const targets = queryTargetsForDefenseRealtimeEvent(
      event(name, {
        ...SAMPLES[name],
        thesisDocumentId: "doc-exact",
      }),
    );
    assert.deepEqual(targets, [
      { target: "annotations", documentId: "doc-exact" },
    ]);
  }
});

test("evaluation.finalized never refreshes another evaluator's private evaluation", () => {
  const targets = queryTargetsForDefenseRealtimeEvent(
    event("evaluation.finalized"),
  );
  assert.deepEqual(targets, TARGETS["evaluation.finalized"]);
  assert.equal(
    targets.some((target) => target.target === "oralEvaluation"),
    false,
  );
});

test("only active defense states permit realtime", () => {
  for (const status of ["SCHEDULED", "IN_PROGRESS", "AWAITING_CONCLUSION"]) {
    assert.equal(isDefenseRealtimeActiveStatus(status), true, status);
  }
  for (const status of [
    "CONCLUDED",
    "CANCELLED",
    "UNSCHEDULED",
    "RESCHEDULED",
    null,
    undefined,
  ]) {
    assert.equal(isDefenseRealtimeActiveStatus(status), false, String(status));
  }
});

test("reconnect convergence targets are exact and document-specific", () => {
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

test("frontend parser strips a comprehensive private-field payload", () => {
  const parsed = parseDefenseRealtimeEvent("annotation.comment.created", {
    ...base,
    thesisDocumentId: "doc-1",
    annotationId: "ann-1",
    commentId: "comment-1",
    criteria: { timelinessRelevance: 1.0 },
    criterionValues: [1.0, 1.25],
    grades: { groupI: 1.1 },
    groupAverage: 1.1,
    overallAverage: 1.2,
    rating: "E",
    recommendations: "private recommendation marker",
    signatureData: "data:image/png;base64,private-signature-marker",
    rapSignatureData: "data:image/png;base64,private-rap-signature-marker",
    bodyDocument: { type: "doc" },
    body: "private comment body marker",
    comments: [{ body: "private thread marker" }],
    thread: [{ body: "private thread marker" }],
    documentBytes: "private-document-bytes-marker",
    storagePath: "/private/storage/path.pdf",
    fileUrl: "https://private.example/file.pdf",
    outcome: "PASSED",
    verdict: "PASSED",
    finalRemarks: "private remarks marker",
    studentDocument: "private student document marker",
  });

  assert.deepEqual(parsed, {
    eventName: "annotation.comment.created",
    ...base,
    thesisDocumentId: "doc-1",
    annotationId: "ann-1",
    commentId: "comment-1",
  });
  const serialized = JSON.stringify(parsed);
  for (const marker of [
    "private recommendation marker",
    "private-signature-marker",
    "private-rap-signature-marker",
    "private comment body marker",
    "private thread marker",
    "private-document-bytes-marker",
    "/private/storage/path.pdf",
    "https://private.example/file.pdf",
    "private remarks marker",
    "private student document marker",
    "PASSED",
  ]) {
    assert.doesNotMatch(serialized, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("malformed/unknown events are rejected (no invalidation hint)", () => {
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
    parseDefenseRealtimeEvent("defense.concluded", {
      ...base,
      sessionStatus: "IN_PROGRESS",
    }),
    null,
  );
});

test("duplicate events map to the same harmless invalidations", () => {
  for (const name of DEFENSE_REALTIME_EVENT_NAMES) {
    const first = queryTargetsForDefenseRealtimeEvent(event(name, SAMPLES[name]));
    const second = queryTargetsForDefenseRealtimeEvent(event(name, SAMPLES[name]));
    assert.deepEqual(first, second, name);
    for (const target of first) {
      assert.equal("mutation" in target, false);
      assert.equal("write" in target, false);
    }
  }
});

test("out-of-order signature events target the same authoritative keys", () => {
  const recorded = queryTargetsForDefenseRealtimeEvent(
    event("rap.signature.recorded", SAMPLES["rap.signature.recorded"]),
  );
  const finalized = queryTargetsForDefenseRealtimeEvent(
    event("rap.finalized", SAMPLES["rap.finalized"]),
  );
  assert.deepEqual(recorded, finalized);
  const normalize = (targets) =>
    targets
      .map((target) => `${target.target}:${target.documentId ?? ""}`)
      .sort();
  assert.deepEqual(normalize(recorded), normalize(finalized));
});

test("join acknowledgements fail closed", () => {
  assert.deepEqual(parseDefenseJoinAck({ ok: true, room: "defense:sched-1" }), {
    ok: true,
    room: "defense:sched-1",
  });
  assert.deepEqual(parseDefenseJoinAck({ ok: false, code: "FORBIDDEN" }), {
    ok: false,
    code: "FORBIDDEN",
  });
  assert.deepEqual(parseDefenseJoinAck({ ok: false, code: "NOT_ACTIVE" }), {
    ok: false,
    code: "NOT_ACTIVE",
  });
  assert.deepEqual(parseDefenseJoinAck({ ok: false, code: "NOT_FOUND" }), {
    ok: false,
    code: "NOT_FOUND",
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

test("socket URL is the bare backend origin and never /api", () => {
  assert.equal(normalizeDefenseRealtimeBaseUrl(undefined), "http://localhost:5000");
  assert.equal(normalizeDefenseRealtimeBaseUrl("http://localhost:5000/"), "http://localhost:5000");
  assert.equal(normalizeDefenseRealtimeBaseUrl("http://localhost:5000/api"), "http://localhost:5000");
  assert.equal(normalizeDefenseRealtimeBaseUrl("http://localhost:5000/api/"), "http://localhost:5000");
  assert.equal(normalizeDefenseRealtimeBaseUrl("  http://localhost:5000//  "), "http://localhost:5000");

  const socket = read(SOCKET);
  assert.match(socket, /socket\.io-client/);
  assert.match(socket, /auth:\s*\{\s*token/);
  assert.doesNotMatch(socket, /query\s*:/);
  assert.doesNotMatch(socket, /\/api`|\/api\"|\/api'/);
  assert.doesNotMatch(socket, /userId|role/);
});

test("the hook joins on every connect, converges, and reauthorizes on reconnect", () => {
  const hook = read(HOOK);
  assert.match(hook, /useSession\(/);
  assert.match(hook, /createDefenseSocket/);
  assert.match(hook, /joinDefenseRoom/);
  assert.match(hook, /socket\.on\("connect"/);
  assert.match(hook, /convergenceQueryTargets/);
  assert.match(hook, /invalidateQueries/);
  assert.match(hook, /targetsForMountedSchedule\(/);
  assert.match(hook, /event\.eventName === "defense\.concluded"/);
  assert.match(hook, /disconnect\(\)/);
});

test("the hook removes listeners and disconnects on unmount", () => {
  const hook = read(HOOK);
  assert.match(hook, /socket\.off\("connect"/);
  assert.match(hook, /socket\.off\("connect_error"/);
  assert.match(hook, /socket\.off\(eventName/);
  assert.match(hook, /leaveDefenseRoom/);
  assert.match(hook, /return\s*\(\)\s*=>/);
  assert.match(hook, /socket\.disconnect\(\)/);
});

test("socket failure/denial never forces logout or blocks REST", () => {
  const hook = read(HOOK);
  assert.doesNotMatch(hook, /signOut/);
  assert.match(hook, /UNAUTHORIZED/);
  assert.match(hook, /catch/);
  assert.match(read(PAGE), /useQuery/);
  assert.match(read(COLLAB_HOOK), /useMutation/);
  assert.match(read(COLLAB_HOOK), /apiClientRequest/);
});

test("conclusion invalidates then disconnects and cannot rejoin", () => {
  const hook = read(HOOK);
  assert.match(hook, /invalidateTargets\(targets\)/);
  assert.match(hook, /event\.eventName === "defense\.concluded"/);
  assert.match(hook, /socket\.disconnect\(\)/);
  assert.match(hook, /isDefenseRealtimeActiveStatus/);
  assert.match(hook, /concluded = true/);
});

test("only the workspace page owns a realtime connection", () => {
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
    HISTORY,
    HISTORY_HOOK,
  ]
    .map(read)
    .join("\n");
  assert.doesNotMatch(
    leaves,
    /socket\.io-client|socket\.io|createDefenseSocket|useDefenseRealtime/i,
  );
});

test("history UI never joins a historical realtime room", () => {
  const history = read(HISTORY) + read(HISTORY_HOOK);
  assert.doesNotMatch(history, /socket|realtime|useDefenseRealtime/i);
});

test("realtime never performs an academic write or cache mutation", () => {
  const combined = [HOOK, SOCKET, EVENTS].map(read).join("\n");
  assert.doesNotMatch(
    combined,
    /["']annotation\.create["']|["']evaluation\.finalize["']|["']report\.freeze["']|["']rap\.sign["']|["']defense\.conclude["']/,
  );
  assert.doesNotMatch(combined, /method:\s*"POST"|apiClientRequest|fetch\(/);
  assert.doesNotMatch(combined, /setQueryData|queryClient\.setQueryData/);
  assert.doesNotMatch(combined, /useMutation/);
});

test("no presence, typing, cursor, CRDT, or Redis stack was added", () => {
  const combined = [HOOK, SOCKET, EVENTS, URL_HELPER].map(read).join("\n");
  assert.doesNotMatch(combined, /presence|typing|cursor|yjs|crdt|redis/i);
});

test("polling fallback intervals remain unchanged", () => {
  assert.match(read(PAGE), /refetchInterval/);
  assert.match(read(PAGE), /20000/);
  assert.match(read(COLLAB_CLIENT), /COLLAB_POLL_INTERVAL_MS\s*=\s*15000/);
  assert.match(read(COLLAB_HOOK), /refetchInterval/);
  assert.match(read(REPORT), /20000/);
  assert.match(read(VERDICT), /refetchInterval:\s*15000/);
});

test("only socket.io-client was added to the frontend realtime stack", () => {
  const pkg = JSON.parse(read(PACKAGE));
  assert.equal(
    typeof pkg.dependencies["socket.io-client"],
    "string",
    "socket.io-client dependency is required",
  );
  for (const forbidden of [
    "socket.io",
    "@socket.io/redis-adapter",
    "redis",
    "yjs",
    "y-websocket",
    "@yjs/y-websocket",
  ]) {
    assert.equal(
      pkg.dependencies[forbidden],
      undefined,
      `${forbidden} must not be a frontend dependency`,
    );
  }
});
