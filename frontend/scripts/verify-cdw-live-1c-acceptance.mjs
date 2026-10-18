// CDW-LIVE-1C — final cross-feature acceptance contracts.
//
// Run: node --experimental-strip-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/verify-cdw-live-1c-acceptance.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { ReportAutosaveController } from "../src/lib/report/report-autosave.ts";
import { EvaluationAutosaveController } from "../src/lib/evaluation/evaluation-autosave.ts";
import {
  REPORT_PREVIEW_EVENT,
  parseLiveReportPreview,
  shouldDisplayLiveReportPreview,
} from "../src/lib/realtime/report-preview.ts";
import { DEFENSE_REALTIME_EVENT_NAMES } from "../src/lib/realtime/defense-realtime-events.ts";

const root = process.cwd();
const read = (relative) => readFileSync(resolve(root, relative), "utf8");

const PAGE =
  "src/app/(portal)/panelist/defense-workspace/[scheduleId]/page.tsx";
const HOOK = "src/hooks/use-defense-realtime.ts";
const REPORT_PANEL = "src/components/defense-workspace/committee-report-panel.tsx";
const REPORT_AUTOSAVE = "src/lib/report/report-autosave.ts";
const REPORT_THROTTLE = "src/lib/report/report-preview-throttle.ts";
const REPORT_PREVIEW = "src/lib/realtime/report-preview.ts";
const DEFENSE_CONTEXT =
  "src/components/defense-workspace/defense-realtime-context.tsx";
const EVAL_FORM = "src/components/defense-workspace/oral-evaluation-form.tsx";
const EVAL_AUTOSAVE = "src/lib/evaluation/evaluation-autosave.ts";
const EVENTS = "src/lib/realtime/defense-realtime-events.ts";
const HISTORY = "src/components/defense-workspace/defense-history-panel.tsx";

const BACKEND_PREVIEW_RULES =
  "../backend/src/realtime/defense-report-preview.rules.ts";
const BACKEND_PREVIEW_AUTH =
  "../backend/src/realtime/defense-report-preview.authorization.ts";
const BACKEND_PREVIEW_SERVER =
  "../backend/src/realtime/defense-report-preview.server.ts";
const BACKEND_PREVIEW_STORE =
  "../backend/src/realtime/defense-report-preview.store.ts";
const BACKEND_PUBLISHER =
  "../backend/src/realtime/defense-realtime.publisher.ts";
const BACKEND_REALTIME_SERVER =
  "../backend/src/realtime/defense-realtime.server.ts";
const BACKEND_EVAL_SERVICE =
  "../backend/src/services/oral-evaluation.service.ts";
const BACKEND_WORKSPACE_SERVICE =
  "../backend/src/services/defense-collaboration.service.ts";

const readBackend = (relative) =>
  read(relative.startsWith("../") ? relative : `../backend/${relative}`);

const CANONICAL = [
  "annotation.comment.created",
  "annotation.created",
  "defense.concluded",
  "defense.started",
  "evaluation.finalized",
  "rap.finalized",
  "rap.signature.recorded",
  "report.draft.updated",
  "report.ready_for_signature",
];

function reportDoc(text) {
  return {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text, marks: [] }],
      },
    ],
  };
}

const CRITERIA_KEYS = [
  "timelinessRelevance",
  "organization",
  "depthComprehensiveness",
  "relevanceConclusions",
  "evidenceOriginalThinking",
  "presentation",
  "masterySubject",
  "communicationSkill",
  "attitude",
];

function evalSnapshot(organization, recommendations = "") {
  const criteria = {};
  for (const key of CRITERIA_KEYS) criteria[key] = null;
  criteria.organization = organization;
  return { criteria, recommendations };
}

class FakeClock {
  constructor() {
    this.now = 0;
    this.seq = 0;
    this.timers = new Map();
  }

  setTimer = (fn, ms) => {
    const id = ++this.seq;
    this.timers.set(id, { at: this.now + Math.max(0, ms), fn });
    return id;
  };

  clearTimer = (id) => {
    this.timers.delete(id);
  };

  advance(ms) {
    const target = this.now + ms;
    for (;;) {
      let next = null;
      for (const [id, timer] of this.timers) {
        if (timer.at <= target && (!next || timer.at < next.timer.at)) {
          next = { id, timer };
        }
      }
      if (!next) break;
      this.timers.delete(next.id);
      this.now = next.timer.at;
      next.timer.fn();
    }
    this.now = target;
  }
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}

function makeReportController({ clock, save, doc = "initial" }) {
  return new ReportAutosaveController({
    save,
    initialBody: reportDoc(doc),
    initialBodyVersion: 1,
    debounceMs: 2000,
    maxWaitMs: 10000,
    now: () => clock.now,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
  });
}

function makeEvaluationController({ clock, save }) {
  return new EvaluationAutosaveController({
    save,
    initialSnapshot: evalSnapshot(1.5, "initial"),
    initialPersisted: true,
    debounceMs: 2000,
    maxWaitMs: 10000,
    now: () => clock.now,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
  });
}

// ---------------------------------------------------------------------------
// Accepted artifacts and canonical event integrity
// ---------------------------------------------------------------------------

test("accepted 1A and 1B artifacts remain present", () => {
  for (const file of [
    REPORT_AUTOSAVE,
    REPORT_THROTTLE,
    REPORT_PREVIEW,
    REPORT_PANEL,
    HOOK,
    DEFENSE_CONTEXT,
    EVAL_AUTOSAVE,
    EVAL_FORM,
  ]) {
    assert.equal(existsSync(resolve(root, file)), true, `${file} should exist`);
  }
});

test("the canonical nine persisted events are unchanged in frontend and backend", () => {
  assert.deepEqual([...DEFENSE_REALTIME_EVENT_NAMES].sort(), CANONICAL);

  const backendTypes = readBackend("src/realtime/defense-realtime.types.ts");
  for (const event of CANONICAL) {
    assert.match(backendTypes, new RegExp(`"${event.replace(/\./g, "\\.")}"`));
  }
  assert.doesNotMatch(
    backendTypes,
    /"evaluation\.(draft|preview|typing|score)\.?[a-z]*"/i,
  );
});

test("report:preview remains transport-only and outside the canonical publisher", () => {
  const backendTypes = readBackend("src/realtime/defense-realtime.types.ts");
  assert.equal(REPORT_PREVIEW_EVENT, "report:preview");
  assert.equal(CANONICAL.includes(REPORT_PREVIEW_EVENT), false);
  assert.doesNotMatch(backendTypes, /report:preview/);
  assert.equal((DEFENSE_REALTIME_EVENT_NAMES).includes("report:preview"), false);
  assert.doesNotMatch(readBackend(BACKEND_PUBLISHER), /report:preview/);
});

test("no evaluation draft/score/preview realtime event exists in any direction", () => {
  const combined = [
    read(EVENTS),
    read(HOOK),
    read(EVAL_FORM),
    read(EVAL_AUTOSAVE),
    readBackend("src/realtime/defense-realtime.types.ts"),
    readBackend(BACKEND_PUBLISHER),
    readBackend(BACKEND_REALTIME_SERVER),
  ].join("\n");

  assert.doesNotMatch(
    combined,
    /evaluation\.(draft|preview|typing|score)/i,
  );
  assert.match(combined, /evaluation\.finalized/);
});

test("evaluation.finalized remains metadata-only in the publisher allow-list", () => {
  const backendTypes = readBackend("src/realtime/defense-realtime.types.ts");
  assert.match(backendTypes, /"evaluation\.finalized":\s*\[\s*\]/);
});

// ---------------------------------------------------------------------------
// Single socket owner / React Query authority / polling
// ---------------------------------------------------------------------------

test("the workspace still owns exactly one socket lifecycle", () => {
  const page = read(PAGE);
  const hook = read(HOOK);
  const report = read(REPORT_PANEL);
  const evaluation = read(EVAL_FORM);
  const context = read(DEFENSE_CONTEXT);

  assert.equal((page.match(/useDefenseRealtime\(/g) ?? []).length, 1);
  assert.equal((hook.match(/createDefenseSocket\(/g) ?? []).length, 1);
  for (const leaf of [report, evaluation]) {
    assert.doesNotMatch(
      leaf,
      /socket\.io-client|createDefenseSocket|useDefenseRealtime/,
    );
  }
  assert.doesNotMatch(context, /socket\.io-client|createDefenseSocket|\bio\(/);
  assert.doesNotMatch(report, /\bio\(/);
});

test("realtime remains invalidation-only and preview is not React Query authority", () => {
  const hook = read(HOOK);
  const report = read(REPORT_PANEL);
  const evaluation = read(EVAL_FORM);

  assert.doesNotMatch(hook, /setQueryData/);
  assert.doesNotMatch(report, /setQueryData/);
  assert.doesNotMatch(evaluation, /setQueryData/);
  assert.doesNotMatch(hook, /apiClientRequest|method:\s*"(POST|PUT|PATCH|DELETE)"/);
  assert.match(hook, /invalidateQueries/);
});

test("polling fallback remains in the workspace and read-only report", () => {
  assert.match(read(PAGE), /20000/);
  assert.match(read(REPORT_PANEL), /20000/);
});

// ---------------------------------------------------------------------------
// Preview isolation and freeze/conclusion cleanup
// ---------------------------------------------------------------------------

test("preview parsing strips unrelated evaluation fields", () => {
  const parsed = parseLiveReportPreview({
    scheduleId: "sched-1",
    baseBodyVersion: 2,
    previewSequence: 1,
    senderUserId: "rapporteur-1",
    body: reportDoc("report text"),
    criteria: { organization: 1.0 },
    recommendations: "private evaluation",
    signatureData: "data:image/png;base64,secret",
  });

  assert.ok(parsed);
  assert.equal(Object.prototype.hasOwnProperty.call(parsed, "criteria"), false);
  assert.equal(
    Object.prototype.hasOwnProperty.call(parsed, "recommendations"),
    false,
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(parsed, "signatureData"),
    false,
  );
  assert.equal(JSON.stringify(parsed).includes("private evaluation"), false);
});

test("authoritative saved body and freeze/conclusion states supersede preview", () => {
  const preview = parseLiveReportPreview({
    scheduleId: "sched-1",
    baseBodyVersion: 4,
    previewSequence: 2,
    senderUserId: "rapporteur-1",
    body: reportDoc("unsaved words"),
  });
  assert.ok(preview);

  assert.equal(
    shouldDisplayLiveReportPreview({
      preview,
      scheduleId: "sched-1",
      reportStatus: "DRAFT",
      authoritativeBodyVersion: 4,
    }),
    true,
  );
  assert.equal(
    shouldDisplayLiveReportPreview({
      preview,
      scheduleId: "sched-1",
      reportStatus: "DRAFT",
      authoritativeBodyVersion: 5,
    }),
    false,
  );
  for (const status of [
    "FOR_SIGNATURE",
    "PARTIALLY_SIGNED",
    "ALL_SIGNED",
    "DISTRIBUTED",
    "FINALIZED",
  ]) {
    assert.equal(
      shouldDisplayLiveReportPreview({
        preview,
        scheduleId: "sched-1",
        reportStatus: status,
        authoritativeBodyVersion: 4,
      }),
      false,
    );
  }
});

test("the socket owner keeps preview on save and clears it on terminal events", () => {
  const hook = read(HOOK);
  const preview = read(REPORT_PREVIEW);
  assert.match(hook, /reportPreviewDispositionForEvent/);
  assert.match(preview, /"report\.draft\.updated"|default:\s*\n\s*return "keep"/);
  for (const token of [
    '"report.ready_for_signature"',
    '"rap.signature.recorded"',
    '"rap.finalized"',
    '"defense.concluded"',
  ]) {
    assert.match(preview, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(hook, /previewAccepting = false/);
  assert.match(hook, /setLiveReportPreview\(null\)/);
  assert.match(hook, /throttleRef\.current\?\.clear\(\)/);
});

test("report preview backend is read-only transport and does not log bodies", () => {
  const rules = readBackend(BACKEND_PREVIEW_RULES);
  const auth = readBackend(BACKEND_PREVIEW_AUTH);
  const server = readBackend(BACKEND_PREVIEW_SERVER);
  const store = readBackend(BACKEND_PREVIEW_STORE);
  const combined = [rules, auth, server, store].join("\n");

  assert.match(rules, /100 \* 1024/);
  assert.doesNotMatch(combined, /prisma\.\w+\.(create|update|delete|upsert)\s*\(/);
  assert.doesNotMatch(combined, /\.(create|update|delete|upsert)\s*\(/);
  assert.doesNotMatch(combined, /console\.(log|debug|info)/);
  assert.doesNotMatch(combined, /JSON\.stringify\(.*body/i);
  assert.match(store, /findUnique|findMany/);
});

test("report preview is never routed through the persisted publisher", () => {
  const server = readBackend(BACKEND_REALTIME_SERVER);
  assert.match(server, /DEFENSE_REPORT_PREVIEW_EVENT/);
  assert.match(server, /createDefenseReportPreviewHandler/);
  assert.doesNotMatch(server, /publishDefenseRealtimeEvent\([\s\S]*report:preview/);
});

// ---------------------------------------------------------------------------
// Evaluation privacy / finalization boundary
// ---------------------------------------------------------------------------

test("evaluation autosave payload is private criteria + recommendations only", async () => {
  const clock = new FakeClock();
  const calls = [];
  const controller = makeEvaluationController({
    clock,
    save: async (snapshot) => {
      calls.push(snapshot);
    },
  });

  controller.update(evalSnapshot(1.75, "private notes"));
  clock.advance(2000);
  await flush();

  assert.equal(calls.length, 1);
  assert.deepEqual(Object.keys(calls[0]).sort(), ["criteria", "recommendations"]);
  const serialized = JSON.stringify(calls[0]);
  assert.doesNotMatch(serialized, /signature|signatureData|panelId|score|average/i);
});

test("evaluation autosave cannot finalize, sign, or call an academic endpoint", () => {
  const controller = read(EVAL_AUTOSAVE);
  const form = read(EVAL_FORM);

  assert.doesNotMatch(controller, /evaluation\/finalize|\.finalize\(/);
  assert.doesNotMatch(controller, /signatureData/);
  assert.match(form, /const settled = await controller\.flushAndWait\(\)/);
  const flushIndex = form.indexOf("flushAndWait");
  const finalizeIndex = form.indexOf("evaluation/finalize");
  assert.ok(flushIndex >= 0 && finalizeIndex > flushIndex);
  assert.match(form, /mutationFn: async \(signatureData: string\)/);
  assert.match(form, /signatureData,/);
  assert.match(form, /if \(!settled\)/);
});

test("finalized evaluation remains server-immutable and autosave-protected", () => {
  const service = readBackend(BACKEND_EVAL_SERVICE);
  const form = read(EVAL_FORM);

  assert.match(service, /existing\?\.status === "FINALIZED"[\s\S]*already finalized/);
  assert.match(service, /status: "DRAFT"/);
  assert.match(form, /const locked = evaluation\?\.isLocked === true/);
  assert.match(form, /if \(locked\) return;/);
});

test("legacy evaluation rows stay read-only", () => {
  const form = read(EVAL_FORM);
  assert.match(form, /evaluation\.scoringVersion === "LEGACY_POINTS_V1"/);
  assert.match(form, /LegacyEvaluationNotice/);
});

// ---------------------------------------------------------------------------
// Report authority / CAS / autosave boundaries
// ---------------------------------------------------------------------------

test("only the exact assigned Rapporteur retains report edit authority", () => {
  const service = readBackend(BACKEND_WORKSPACE_SERVICE);
  const rules = readBackend("src/services/report-edit-authority.rules.ts");
  const report = read(REPORT_PANEL);
  const evaluation = read(EVAL_FORM);

  assert.match(service, /Only the assigned Rapporteur may edit the committee report/);
  assert.match(rules, /role.*RAPPORTEUR/);
  assert.match(report, /canEditBody/);
  assert.doesNotMatch(evaluation, /\/collaboration\/report/);
});

test("report CAS and FIX-1 drain behavior remain present", () => {
  const controller = read(REPORT_AUTOSAVE);
  const panel = read(REPORT_PANEL);

  assert.match(controller, /expectedBodyVersion/);
  assert.match(controller, /syncServerVersion/);
  assert.match(controller, /reloadFromServer/);
  assert.match(controller, /draining/);
  assert.match(panel, /void controller\.dispose\(\)/);
});

test("report autosave/preview code cannot freeze, sign, or conclude", () => {
  const combined = [
    read(REPORT_AUTOSAVE),
    read(REPORT_PREVIEW),
    read(REPORT_THROTTLE),
  ].join("\n");

  assert.doesNotMatch(
    combined,
    /\/collaboration\/report\/(freeze|sign)|\/thesis\/defense\/[^"'`]*\/(conclusion|conclude)/,
  );
  assert.doesNotMatch(combined, /signatureData/);
});

// ---------------------------------------------------------------------------
// Cross-feature behavioral interactions
// ---------------------------------------------------------------------------

test("Scenario A — report and evaluation autosave remain independent", async () => {
  const clock = new FakeClock();
  const reportCalls = [];
  const evaluationCalls = [];

  const report = makeReportController({
    clock,
    save: async (input) => {
      reportCalls.push(input);
      return { bodyVersion: input.expectedBodyVersion + 1 };
    },
  });
  const evaluation = makeEvaluationController({
    clock,
    save: async (snapshot) => {
      evaluationCalls.push(snapshot);
    },
  });

  report.update(reportDoc("committee wording"));
  evaluation.update(evalSnapshot(1.75, "private evaluator notes"));
  clock.advance(2000);
  await flush();

  assert.equal(reportCalls.length, 1);
  assert.equal(evaluationCalls.length, 1);
  assert.equal(
    reportCalls[0].body.content[0].content[0].text,
    "committee wording",
  );
  assert.equal(evaluationCalls[0].recommendations, "private evaluator notes");
  assert.equal(JSON.stringify(reportCalls[0]).includes("private evaluator notes"), false);
  assert.equal(JSON.stringify(evaluationCalls[0]).includes("committee wording"), false);
});

test("Scenario B — evaluator finalization drain does not disturb report drafting", async () => {
  const clock = new FakeClock();
  const first = deferred();
  const second = deferred();
  const evaluationCalls = [];
  const reportCalls = [];

  const evaluation = makeEvaluationController({
    clock,
    save: async (snapshot) => {
      evaluationCalls.push(snapshot);
      if (evaluationCalls.length === 1) return first.promise;
      return second.promise;
    },
  });
  const report = makeReportController({
    clock,
    save: async (input) => {
      reportCalls.push(input);
      return { bodyVersion: input.expectedBodyVersion + 1 };
    },
  });

  evaluation.update(evalSnapshot(1.75, "A"));
  evaluation.flushNow();
  await flush();
  evaluation.update(evalSnapshot(2.0, "B"));

  report.update(reportDoc("report still editing"));
  clock.advance(2000);
  await flush();
  assert.equal(reportCalls.length, 1);
  assert.equal(report.getState().status, "saved");

  let settled;
  const wait = evaluation.flushAndWait().then((value) => {
    settled = value;
  });
  first.resolve();
  await flush();
  assert.equal(evaluationCalls.length, 2);
  assert.equal(settled, undefined);
  second.resolve();
  await wait;
  assert.equal(settled, true);
  assert.equal(reportCalls.length, 1, "evaluation finalize drain never re-saves the report");
  assert.equal(report.hasUnsavedChanges(), false);
});

test("Scenario C — saved report version supersedes the live preview", () => {
  const preview = parseLiveReportPreview({
    scheduleId: "sched-1",
    baseBodyVersion: 3,
    previewSequence: 1,
    senderUserId: "rapporteur-1",
    body: reportDoc("preview"),
  });
  assert.ok(preview);

  assert.equal(
    shouldDisplayLiveReportPreview({
      preview,
      scheduleId: "sched-1",
      reportStatus: "DRAFT",
      authoritativeBodyVersion: 3,
    }),
    true,
  );
  assert.equal(
    shouldDisplayLiveReportPreview({
      preview,
      scheduleId: "sched-1",
      reportStatus: "DRAFT",
      authoritativeBodyVersion: 4,
    }),
    false,
  );
});

test("Scenario D — freeze invalidates preview and no terminal autosave resumes", () => {
  const hook = read(HOOK);
  const preview = read(REPORT_PREVIEW);
  const report = read(REPORT_PANEL);
  assert.match(preview, /"report\.ready_for_signature"/);
  assert.match(hook, /reportPreviewDispositionForEvent/);
  assert.match(hook, /previewAccepting = false/);
  assert.match(report, /REPORT_FROZEN_STATUSES/);
  assert.match(report, /canEditBody/);
});

test("Scenario E — REST autosave works without any socket dependency", async () => {
  const clock = new FakeClock();
  const reportCalls = [];
  const evaluationCalls = [];

  const report = makeReportController({
    clock,
    save: async (input) => {
      reportCalls.push(input);
      return { bodyVersion: input.expectedBodyVersion + 1 };
    },
  });
  const evaluation = makeEvaluationController({
    clock,
    save: async (snapshot) => {
      evaluationCalls.push(snapshot);
    },
  });

  report.update(reportDoc("offline-safe report"));
  evaluation.update(evalSnapshot(1.75, "offline-safe evaluation"));
  clock.advance(2000);
  await flush();

  assert.equal(reportCalls.length, 1);
  assert.equal(evaluationCalls.length, 1);

  for (const file of [REPORT_AUTOSAVE, EVAL_AUTOSAVE]) {
    assert.doesNotMatch(
      read(file),
      /socket\.io|createDefenseSocket|useDefenseRealtime|report:preview/i,
    );
  }
});

test("concurrent unmount drains keep independent one-in-flight pipelines", async () => {
  const clock = new FakeClock();
  const reportFirst = deferred();
  const reportSecond = deferred();
  const evalFirst = deferred();
  const evalSecond = deferred();
  const reportCalls = [];
  const evaluationCalls = [];

  const report = makeReportController({
    clock,
    save: async (input) => {
      reportCalls.push(input);
      return reportCalls.length === 1 ? reportFirst.promise : reportSecond.promise;
    },
  });
  const evaluation = makeEvaluationController({
    clock,
    save: async (snapshot) => {
      evaluationCalls.push(snapshot);
      return evaluationCalls.length === 1 ? evalFirst.promise : evalSecond.promise;
    },
  });

  report.update(reportDoc("A"));
  report.flushNow();
  evaluation.update(evalSnapshot(1.75, "A"));
  evaluation.flushNow();
  await flush();
  assert.equal(reportCalls.length, 1);
  assert.equal(evaluationCalls.length, 1);

  report.update(reportDoc("B"));
  evaluation.update(evalSnapshot(2.0, "B"));
  const reportDisposal = report.dispose();
  const evaluationDisposal = evaluation.dispose();
  assert.equal(reportCalls.length, 1);
  assert.equal(evaluationCalls.length, 1);

  reportFirst.resolve({ bodyVersion: 2 });
  evalFirst.resolve();
  await flush();
  assert.equal(reportCalls.length, 2);
  assert.equal(evaluationCalls.length, 2);
  assert.equal(reportCalls[1].body.content[0].content[0].text, "B");
  assert.equal(evaluationCalls[1].recommendations, "B");

  reportSecond.resolve({ bodyVersion: 3 });
  evalSecond.resolve();
  await Promise.all([reportDisposal, evaluationDisposal]);

  assert.equal(report.getLifecycleState(), "disposed");
  assert.equal(evaluation.getLifecycleState(), "disposed");
});

// ---------------------------------------------------------------------------
// Historical, persistence, logging, and scope guards
// ---------------------------------------------------------------------------

test("historical mode remains socket-free and read-only", () => {
  const history = read(HISTORY);
  assert.doesNotMatch(history, /socket|realtime|report:preview/i);
  assert.match(history, /read-only|readOnly|read only/i);
});

test("no sensitive persistent browser storage was introduced", () => {
  const combined = [
    read(REPORT_AUTOSAVE),
    read(REPORT_PANEL),
    read(HOOK),
    read(EVAL_AUTOSAVE),
    read(EVAL_FORM),
  ].join("\n");

  assert.doesNotMatch(combined, /localStorage|sessionStorage|indexedDB/i);
});

test("no draft criteria/recommendations or signature evidence is logged", () => {
  const combined = [
    read(REPORT_AUTOSAVE),
    read(EVAL_AUTOSAVE),
    read(EVAL_FORM),
    read(HOOK),
    readBackend(BACKEND_PREVIEW_SERVER),
  ].join("\n");

  assert.doesNotMatch(combined, /console\.(log|debug|info)\(/);
  assert.doesNotMatch(combined, /console\.(log|debug|info)\([^)]*signature/i);
  assert.doesNotMatch(combined, /console\.(log|debug|info)\([^)]*recommendation/i);
  assert.doesNotMatch(combined, /console\.(log|debug|info)\([^)]*criteria/i);
});

test("no CRDT/presence/cursor/typing/Redis stack was introduced", () => {
  const combined = [
    read(REPORT_AUTOSAVE),
    read(REPORT_PANEL),
    read(HOOK),
    read(EVAL_AUTOSAVE),
    read(EVAL_FORM),
    readBackend(BACKEND_PREVIEW_SERVER),
  ].join("\n");

  assert.doesNotMatch(combined, /crdt|yjs|operational transform|\bot\b/i);
  assert.doesNotMatch(combined, /presence|cursor|typing indicator|redis/i);
});

test("CDW-9 remains not started and is not implemented by this package", () => {
  const plan = read(
    "../docs/superpowers/plans/2026-10-15-collaborative-defense-workspace-implementation.md",
  );
  assert.match(plan, /CDW-9/);
  assert.doesNotMatch(plan, /CDW-9[^\n]*ACCEPTED/);
});
