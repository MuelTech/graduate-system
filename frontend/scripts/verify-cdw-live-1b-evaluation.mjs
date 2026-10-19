// CDW-LIVE-1B — private individual evaluation draft autosave.
//
// Run: node --experimental-strip-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/verify-cdw-live-1b-evaluation.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  EvaluationAutosaveController,
} from "../src/lib/evaluation/evaluation-autosave.ts";
import { DEFENSE_REALTIME_EVENT_NAMES } from "../src/lib/realtime/defense-realtime-events.ts";

const root = process.cwd();
const read = (relative) => readFileSync(resolve(root, relative), "utf8");

const FORM = "src/components/defense-workspace/oral-evaluation-form.tsx";
const CONTROLLER = "src/lib/evaluation/evaluation-autosave.ts";
const EVENTS = "src/lib/realtime/defense-realtime-events.ts";
const REPORT_AUTOSAVE = "src/lib/report/report-autosave.ts";
const REPORT_PANEL = "src/components/defense-workspace/committee-report-panel.tsx";
const HOOK = "src/hooks/use-defense-realtime.ts";

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

function snapshot(organization = null, recommendations = "") {
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

function makeController(overrides = {}) {
  const clock = overrides.clock ?? new FakeClock();
  const calls = [];
  const states = [];
  const baseSave = overrides.save ?? (async () => undefined);
  const save = async (input) => {
    calls.push(input);
    return baseSave(input);
  };

  const controller = new EvaluationAutosaveController({
    save,
    initialSnapshot: snapshot(1.5, "initial"),
    initialPersisted: true,
    debounceMs: 2000,
    maxWaitMs: 10000,
    now: () => clock.now,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
    onStateChange: (state) => states.push(state),
  });

  return { controller, clock, calls, states, save };
}

function lastState(states) {
  return states[states.length - 1];
}

function trackedSave(handlers) {
  const calls = [];
  const concurrency = { current: 0, max: 0 };

  const save = async (input) => {
    calls.push(input);
    concurrency.current += 1;
    concurrency.max = Math.max(concurrency.max, concurrency.current);
    try {
      const handler = handlers[calls.length - 1];
      if (handler) return await handler(input);
      return undefined;
    } finally {
      concurrency.current -= 1;
    }
  };

  return { save, calls, concurrency };
}

// ---------------------------------------------------------------------------
// A-F — timing, serialization, manual flush, saved-state truth
// ---------------------------------------------------------------------------

test("A — waits for the 2-second idle debounce before saving", async () => {
  const { controller, clock, calls } = makeController();

  controller.update(snapshot(1.75, "changed"));
  clock.advance(1999);
  await flush();
  assert.equal(calls.length, 0);

  clock.advance(1);
  await flush();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].criteria.organization, 1.75);
});

test("B — continuous editing still saves within the 10-second maximum window", async () => {
  const { controller, clock, calls } = makeController();

  for (let second = 0; second < 9; second += 1) {
    controller.update(snapshot(1.5, `typing-${second}`));
    clock.advance(1000);
    await flush();
  }
  assert.equal(calls.length, 0);

  controller.update(snapshot(1.5, "typing-9"));
  clock.advance(1000);
  await flush();

  assert.equal(calls.length, 1);
  assert.equal(calls[0].recommendations, "typing-9");
});

test("C — one request in flight; edits during it stay dirty without overlapping", async () => {
  const pending = deferred();
  const clock = new FakeClock();
  const calls = [];
  const controller = new EvaluationAutosaveController({
    save: async (input) => {
      calls.push(input);
      if (calls.length === 1) return pending.promise;
      return undefined;
    },
    initialSnapshot: snapshot(1.5),
    debounceMs: 2000,
    maxWaitMs: 10000,
    now: () => clock.now,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
  });

  controller.update(snapshot(1.75, "A"));
  clock.advance(2000);
  await flush();
  assert.equal(calls.length, 1);

  controller.update(snapshot(2.0, "B"));
  clock.advance(10000);
  await flush();
  assert.equal(calls.length, 1);
  assert.equal(controller.getState().status, "saving");
  assert.equal(controller.hasUnsavedChanges(), true);

  pending.resolve();
  await flush();
  assert.equal(calls.length, 2);
  assert.equal(calls[1].criteria.organization, 2.0);
  assert.equal(calls[1].recommendations, "B");
});

test("D — multiple edits during an in-flight save persist only the latest state", async () => {
  const pending = deferred();
  const clock = new FakeClock();
  const calls = [];
  const controller = new EvaluationAutosaveController({
    save: async (input) => {
      calls.push(input);
      if (calls.length === 1) return pending.promise;
      return undefined;
    },
    initialSnapshot: snapshot(1.5),
    debounceMs: 2000,
    maxWaitMs: 10000,
    now: () => clock.now,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
  });

  controller.update(snapshot(1.5, "A"));
  controller.flushNow();
  await flush();
  controller.update(snapshot(1.5, "B"));
  controller.update(snapshot(1.75, "C"));
  controller.update(snapshot(2.0, "D"));
  pending.resolve();
  await flush();

  assert.equal(calls.length, 2);
  assert.equal(calls[1].criteria.organization, 2.0);
  assert.equal(calls[1].recommendations, "D");
});

test("E — Save now flushes through the same controller pipeline", async () => {
  const { controller, clock, calls, states } = makeController();

  controller.update(snapshot(1.75, "manual"));
  assert.equal(controller.flushNow(), true);
  await flush();

  assert.equal(calls.length, 1);
  assert.equal(clock.timers.size, 0);
  assert.equal(lastState(states).status, "saved");
});

test("F — never reports Saved before the server confirms persistence", async () => {
  const pending = deferred();
  const clock = new FakeClock();
  const states = [];
  const controller = new EvaluationAutosaveController({
    save: async () => pending.promise,
    initialSnapshot: snapshot(1.5),
    initialPersisted: false,
    debounceMs: 2000,
    maxWaitMs: 10000,
    now: () => clock.now,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
    onStateChange: (state) => states.push(state),
  });

  controller.update(snapshot(1.75));
  controller.flushNow();
  await flush();

  assert.equal(controller.getState().status, "saving");
  assert.equal(states.some((state) => state.status === "saved"), false);

  pending.resolve();
  await flush();
  assert.equal(controller.getState().status, "saved");
});

// ---------------------------------------------------------------------------
// G-H — failure and offline semantics
// ---------------------------------------------------------------------------

test("G — failure keeps the draft dirty, does not loop, and allows manual retry", async () => {
  let attempt = 0;
  const clock = new FakeClock();
  const calls = [];
  const controller = new EvaluationAutosaveController({
    save: async (input) => {
      calls.push(input);
      attempt += 1;
      if (attempt === 1) throw new Error("draft save failed");
      return undefined;
    },
    initialSnapshot: snapshot(1.5),
    debounceMs: 2000,
    maxWaitMs: 10000,
    now: () => clock.now,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
  });

  controller.update(snapshot(1.75, "retry"));
  clock.advance(2000);
  await flush();

  assert.equal(controller.getState().status, "error");
  assert.equal(controller.hasUnsavedChanges(), true);
  assert.match(controller.getState().error, /failed/i);

  clock.advance(60_000);
  await flush();
  assert.equal(calls.length, 1, "no automatic retry loop");

  controller.flushNow();
  await flush();
  assert.equal(calls.length, 2);
  assert.equal(controller.getState().status, "saved");
});

test("H — offline edits stay local and flush on reconnect", async () => {
  const { controller, clock, calls } = makeController();

  controller.setOnline(false);
  controller.update(snapshot(2.0, "offline"));
  clock.advance(60_000);
  await flush();

  assert.equal(calls.length, 0);
  assert.equal(controller.getState().status, "offline");
  assert.equal(controller.hasUnsavedChanges(), true);

  controller.setOnline(true);
  await flush();

  assert.equal(calls.length, 1);
  assert.equal(calls[0].recommendations, "offline");
});

// ---------------------------------------------------------------------------
// I-K — unmount / draining durability (CDW-LIVE-1A FIX-1 equivalent)
// ---------------------------------------------------------------------------

test("I — unmount flushes a pending debounce", async () => {
  const { controller, clock, calls } = makeController();

  controller.update(snapshot(1.75, "pending"));
  const disposal = controller.dispose();
  await disposal;

  assert.equal(calls.length, 1);
  assert.equal(calls[0].recommendations, "pending");
  assert.equal(clock.timers.size, 0);
  assert.equal(controller.getLifecycleState(), "disposed");
});

test("J — unmount while a save is in flight drains the newest dirty state", async () => {
  const clock = new FakeClock();
  const first = deferred();
  const second = deferred();
  const { save, calls, concurrency } = trackedSave([
    () => first.promise,
    () => second.promise,
  ]);
  const controller = new EvaluationAutosaveController({
    save,
    initialSnapshot: snapshot(1.5),
    debounceMs: 2000,
    maxWaitMs: 10000,
    now: () => clock.now,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
  });

  controller.update(snapshot(1.75, "A"));
  controller.flushNow();
  await flush();
  assert.equal(calls.length, 1);

  controller.update(snapshot(2.0, "B"));
  const disposal = controller.dispose();

  assert.equal(controller.getLifecycleState(), "draining");
  assert.equal(calls.length, 1, "disposal must not start a parallel write");

  first.resolve();
  await flush();
  assert.equal(calls.length, 2);
  assert.equal(calls[1].criteria.organization, 2.0);
  assert.equal(calls[1].recommendations, "B");
  assert.equal(controller.getLifecycleState(), "draining");

  second.resolve();
  await disposal;
  assert.equal(controller.getLifecycleState(), "disposed");
  assert.equal(concurrency.max, 1);
});

test("K — multiple edits during drain persist only the newest state", async () => {
  const clock = new FakeClock();
  const first = deferred();
  const { save, calls } = trackedSave([() => first.promise]);
  const controller = new EvaluationAutosaveController({
    save,
    initialSnapshot: snapshot(1.5),
    debounceMs: 2000,
    maxWaitMs: 10000,
    now: () => clock.now,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
  });

  controller.update(snapshot(1.5, "A"));
  controller.flushNow();
  await flush();
  controller.update(snapshot(1.75, "B"));
  controller.update(snapshot(2.0, "C"));
  const disposal = controller.dispose();

  first.resolve();
  await disposal;

  assert.equal(calls.length, 2);
  assert.equal(calls[1].criteria.organization, 2.0);
  assert.equal(calls[1].recommendations, "C");
  assert.equal(controller.getLifecycleState(), "disposed");
});

// ---------------------------------------------------------------------------
// Finalization boundary
// ---------------------------------------------------------------------------

test("Q1 — flushAndWait resolves only after in-flight and newest state are saved", async () => {
  const clock = new FakeClock();
  const first = deferred();
  const second = deferred();
  const { save, calls } = trackedSave([
    () => first.promise,
    () => second.promise,
  ]);
  const controller = new EvaluationAutosaveController({
    save,
    initialSnapshot: snapshot(1.5),
    debounceMs: 2000,
    maxWaitMs: 10000,
    now: () => clock.now,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
  });

  controller.update(snapshot(1.75, "A"));
  controller.flushNow();
  await flush();
  controller.update(snapshot(2.0, "B"));

  let settled;
  const wait = controller.flushAndWait().then((value) => {
    settled = value;
  });
  await flush();
  assert.equal(calls.length, 1);
  assert.equal(settled, undefined, "must wait while work remains");

  first.resolve();
  await flush();
  assert.equal(calls.length, 2);
  assert.equal(settled, undefined, "must wait for the queued newest state");

  second.resolve();
  await wait;
  assert.equal(settled, true);
  assert.equal(controller.hasUnsavedChanges(), false);
});

test("Q2 — flushAndWait returns false on a failed save so finalization cannot proceed silently", async () => {
  const clock = new FakeClock();
  const controller = new EvaluationAutosaveController({
    save: async () => {
      throw new Error("draft save failed");
    },
    initialSnapshot: snapshot(1.5),
    debounceMs: 2000,
    maxWaitMs: 10000,
    now: () => clock.now,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
  });

  controller.update(snapshot(1.75, "unsaved"));
  assert.equal(await controller.flushAndWait(), false);
  assert.equal(controller.getState().status, "error");
  assert.equal(controller.hasUnsavedChanges(), true);
});

test("Q3 — flushAndWait is immediate when there is nothing to save", async () => {
  const { controller, calls } = makeController();
  assert.equal(await controller.flushAndWait(), true);
  assert.equal(calls.length, 0);
});

// ---------------------------------------------------------------------------
// Source / privacy contracts
// ---------------------------------------------------------------------------

test("CDW-LIVE-1B files exist", () => {
  for (const file of [FORM, CONTROLLER]) {
    assert.equal(existsSync(resolve(root, file)), true, `${file} should exist`);
  }
});

test("L — legacy LEGACY_POINTS_V1 rows never mount the autosave editor", () => {
  const form = read(FORM);
  assert.match(form, /scoringVersion === "LEGACY_POINTS_V1"/);
  assert.match(form, /<LegacyEvaluationNotice/);
});

test("M — finalized evaluations are locked and do not start autosave", () => {
  const form = read(FORM);
  assert.match(form, /evaluation\?\.isLocked === true/);
  assert.match(form, /if \(mountedLockedRef\.current\) return;/);
  assert.match(
    form,
    /if \(locked\) controllerRef\.current\?\.markConflict\(\)/,
  );
  assert.match(form, /disabled=\{inputsDisabled\}/);
});

test("N - autosave payload contains draft fields/version only, never signatures", () => {
  const form = read(FORM);
  assert.match(
    form,
    /body: JSON\.stringify\(\{\s*criteria: snapshot\.criteria,\s*recommendations: snapshot\.recommendations,\s*expectedUpdatedAt: latestVersionRef\.current,\s*\}\)/s,
  );
  const autosaveSection = form.slice(
    form.indexOf("save: async (snapshot)"),
    form.indexOf("initialSnapshot:"),
  );
  assert.ok(autosaveSection.length > 0);
  assert.doesNotMatch(autosaveSection, /signature/i);
  assert.doesNotMatch(autosaveSection, /panelId|clientPanelId/);
  assert.doesNotMatch(autosaveSection, /localStorage|sessionStorage|indexedDB/i);
});

test("O — autosave never calls the finalize endpoint or handles signatures", () => {
  const controller = read(CONTROLLER);
  assert.doesNotMatch(controller, /evaluation\/finalize|\.finalize\(/);
  assert.doesNotMatch(controller, /signatureData|signature\s*:/i);
  const form = read(FORM);
  const finalizeIndex = form.indexOf("evaluation/finalize");
  const autosaveIndex = form.indexOf("evaluation/draft");
  assert.ok(autosaveIndex >= 0 && finalizeIndex > autosaveIndex);
});

test("P — no evaluation draft realtime event or socket usage", () => {
  const controller = read(CONTROLLER);
  const form = read(FORM);
  for (const file of [controller, form]) {
    assert.doesNotMatch(
      file,
      /socket\.io|createDefenseSocket|useDefenseRealtime|report:preview/i,
    );
    assert.doesNotMatch(
      file,
      /evaluation\.draft|evaluation\.preview|evaluation\.typing|evaluation\.score/i,
    );
  }

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

test("Q4 — finalization drains autosave before calling the finalize endpoint", () => {
  const form = read(FORM);
  const flushIndex = form.indexOf("flushAndWait");
  const finalizeIndex = form.indexOf("evaluation/finalize");
  assert.ok(flushIndex >= 0, "finalize path must drain autosave");
  assert.ok(finalizeIndex > flushIndex, "drain must precede finalize");
  assert.match(form, /const settled = await controller\.flushAndWait\(\)/);
  assert.match(form, /if \(!settled\)/);
});

test("the evaluation form has no competing Save Draft mutation or manual Save now", () => {
  const form = read(FORM);
  assert.doesNotMatch(form, /saveDraft\s*=\s*useMutation/);
  assert.doesNotMatch(form, /Save now/);
  assert.match(form, /EvaluationAutosaveController/);
  assert.match(form, /Review &amp; Finalize/);
});

test("accepted CDW-LIVE-1A report autosave and realtime ownership remain intact", () => {
  const reportController = read(REPORT_AUTOSAVE);
  const reportPanel = read(REPORT_PANEL);
  const hook = read(HOOK);
  assert.match(reportController, /getLifecycleState/);
  assert.match(reportPanel, /void controller\.dispose\(\)/);
  assert.match(hook, /REPORT_PREVIEW_EVENT/);
  assert.match(hook, /createDefenseSocket/);
  assert.equal((reportPanel.match(/createDefenseSocket/g) ?? []).length, 0);
});

test("no sensitive local persistence or draft logging was introduced", () => {
  const combined = [read(FORM), read(CONTROLLER)].join("\n");
  assert.doesNotMatch(combined, /localStorage|sessionStorage|indexedDB/i);
  assert.doesNotMatch(combined, /console\.(log|debug|info)\(/);
});
