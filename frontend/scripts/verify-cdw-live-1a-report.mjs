// CDW-LIVE-1A — report draft autosave + ephemeral live preview contracts.
//
// Run: node --experimental-strip-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/verify-cdw-live-1a-report.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  ReportAutosaveConflictError,
  ReportAutosaveController,
} from "../src/lib/report/report-autosave.ts";
import { ReportPreviewThrottle } from "../src/lib/report/report-preview-throttle.ts";
import {
  REPORT_PREVIEW_EVENT,
  isNewerLiveReportPreview,
  parseLiveReportPreview,
  shouldDisplayLiveReportPreview,
} from "../src/lib/realtime/report-preview.ts";

const root = process.cwd();
const read = (relative) => readFileSync(resolve(root, relative), "utf8");

const PANEL = "src/components/defense-workspace/committee-report-panel.tsx";
const HOOK = "src/hooks/use-defense-realtime.ts";
const CONTEXT =
  "src/components/defense-workspace/defense-realtime-context.tsx";
const PAGE =
  "src/app/(portal)/panelist/defense-workspace/[scheduleId]/page.tsx";
const EVENTS = "src/lib/realtime/defense-realtime-events.ts";
const PREVIEW = "src/lib/realtime/report-preview.ts";
const AUTOSAVE = "src/lib/report/report-autosave.ts";
const THROTTLE = "src/lib/report/report-preview-throttle.ts";
const SOCKET = "src/lib/realtime/defense-socket.ts";

function doc(text) {
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
  const baseSave =
    overrides.save ??
    (async (input) => ({ bodyVersion: input.expectedBodyVersion + 1 }));
  const save = async (input) => {
    calls.push(input);
    return baseSave(input);
  };

  const controller = new ReportAutosaveController({
    save,
    initialBody: doc("initial"),
    initialBodyVersion: 1,
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

// ---------------------------------------------------------------------------
// Autosave
// ---------------------------------------------------------------------------

test("waits for the 2-second idle debounce before autosaving", async () => {
  const { controller, clock, calls } = makeController();

  controller.update(doc("hello"));
  clock.advance(1999);
  await flush();
  assert.equal(calls.length, 0);

  clock.advance(1);
  await flush();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].body.content[0].content[0].text, "hello");
});

test("continuous typing still saves within the 10-second max window", async () => {
  const { controller, clock, calls } = makeController();

  for (let second = 0; second < 9; second += 1) {
    controller.update(doc(`typing-${second}`));
    clock.advance(1000);
    await flush();
  }
  assert.equal(calls.length, 0, "idle debounce keeps resetting while typing");

  controller.update(doc("typing-9"));
  clock.advance(1000);
  await flush();
  assert.equal(calls.length, 1, "max window forces a save at 10s");
  assert.equal(calls[0].body.content[0].content[0].text, "typing-9");
});

test("only one save is in flight; edits during it are saved afterwards", async () => {
  const pending = deferred();
  const calls = [];
  const clock = new FakeClock();
  const controller = new ReportAutosaveController({
    save: async (input) => {
      calls.push(input);
      if (calls.length === 1) return pending.promise;
      return { bodyVersion: input.expectedBodyVersion + 1 };
    },
    initialBody: doc("initial"),
    initialBodyVersion: 1,
    debounceMs: 2000,
    maxWaitMs: 10000,
    now: () => clock.now,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
  });

  controller.update(doc("first"));
  clock.advance(2000);
  await flush();
  assert.equal(calls.length, 1);

  controller.update(doc("second"));
  clock.advance(10000);
  await flush();
  assert.equal(calls.length, 1, "no competing request while one is in flight");
  assert.equal(controller.getState().status, "saving");
  assert.equal(controller.hasUnsavedChanges(), true);

  pending.resolve({ bodyVersion: 2 });
  await flush();

  assert.equal(calls.length, 2, "newest body is saved immediately after success");
  assert.equal(calls[1].body.content[0].content[0].text, "second");
  assert.equal(calls[1].expectedBodyVersion, 2, "uses the server-returned version");
});

test("server bodyVersion advances the next CAS token", async () => {
  const { controller, clock, calls } = makeController({
    save: async (input) => {
      return { bodyVersion: input.expectedBodyVersion + 5 };
    },
  });

  controller.update(doc("one"));
  clock.advance(2000);
  await flush();
  controller.update(doc("two"));
  clock.advance(2000);
  await flush();

  assert.equal(calls[0].expectedBodyVersion, 1);
  assert.equal(calls[1].expectedBodyVersion, 6);
  assert.equal(controller.getState().bodyVersion, 11);
});

test("Save now flushes immediately through the same pipeline", async () => {
  const { controller, clock, calls, states } = makeController();

  controller.update(doc("manual"));
  assert.equal(controller.flushNow(), true);
  await flush();

  assert.equal(calls.length, 1);
  assert.equal(clock.timers.size, 0, "no debounce timer remains after manual save");
  assert.equal(lastState(states).status, "saved");
});

// ---------------------------------------------------------------------------
// FIX-6 source-review correction — awaitable drain before report finalization
// ---------------------------------------------------------------------------

test("flushAndWait persists a DIRTY body before resolving", async () => {
  const clock = new FakeClock();
  const pending = deferred();
  const calls = [];
  const controller = new ReportAutosaveController({
    save: async (input) => {
      calls.push(input);
      return pending.promise;
    },
    initialBody: doc("saved"),
    initialBodyVersion: 1,
    debounceMs: 2000,
    maxWaitMs: 10000,
    now: () => clock.now,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
  });

  controller.update(doc("newest final wording"));
  assert.equal(controller.getState().hasUnsavedChanges, true);

  let finalized = false;
  const finalizeAfterDrain = controller.flushAndWait().then(() => {
    finalized = true;
  });
  await flush();

  assert.equal(calls.length, 1, "dirty body starts one save");
  assert.equal(calls[0].body.content[0].content[0].text, "newest final wording");
  assert.equal(calls[0].expectedBodyVersion, 1);
  assert.equal(finalized, false, "finalization must wait for persistence");

  pending.resolve({ bodyVersion: 2 });
  await finalizeAfterDrain;

  assert.equal(finalized, true);
  assert.equal(controller.getState().status, "saved");
  assert.equal(controller.getState().hasUnsavedChanges, false);
});

test("flushAndWait waits for an in-flight save and the newest dirty edit behind it", async () => {
  const clock = new FakeClock();
  const first = deferred();
  const second = deferred();
  const { save, calls, concurrency } = trackedSave([
    () => first.promise,
    () => second.promise,
  ]);
  const controller = new ReportAutosaveController({
    save,
    initialBody: doc("initial"),
    initialBodyVersion: 1,
    debounceMs: 2000,
    maxWaitMs: 10000,
    now: () => clock.now,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
  });

  controller.update(doc("body A"));
  controller.flushNow();
  await flush();
  assert.equal(calls.length, 1);

  controller.update(doc("body B newest"));
  let finalized = false;
  const finalizeAfterDrain = controller.flushAndWait().then(() => {
    finalized = true;
  });
  await flush();

  assert.equal(calls.length, 1, "no competing save starts while one is in flight");
  first.resolve({ bodyVersion: 2 });
  await flush();

  assert.equal(calls.length, 2, "newest edit is saved after the in-flight save");
  assert.equal(calls[1].body.content[0].content[0].text, "body B newest");
  assert.equal(calls[1].expectedBodyVersion, 2);
  assert.equal(finalized, false);
  assert.equal(concurrency.max, 1, "the drain never exceeds one save in flight");

  second.resolve({ bodyVersion: 3 });
  await finalizeAfterDrain;

  assert.equal(finalized, true);
  assert.equal(controller.getState().bodyVersion, 3);
  assert.equal(controller.getState().hasUnsavedChanges, false);
});

test("flushAndWait rejects on save failure and leaves the report editable", async () => {
  const clock = new FakeClock();
  const calls = [];
  const controller = new ReportAutosaveController({
    save: async (input) => {
      calls.push(input);
      throw new Error("Network request failed.");
    },
    initialBody: doc("initial"),
    initialBodyVersion: 2,
    debounceMs: 2000,
    maxWaitMs: 10000,
    now: () => clock.now,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
  });

  controller.update(doc("unsaved final wording"));
  await assert.rejects(controller.flushAndWait(), /Network request failed/);

  assert.equal(calls.length, 1);
  assert.equal(controller.getState().status, "error");
  assert.equal(controller.getState().hasUnsavedChanges, true);
  assert.equal(controller.getLifecycleState(), "active", "draft remains editable");
});

test("flushAndWait rejects on CAS conflict and preserves conflict state", async () => {
  const clock = new FakeClock();
  let saveCalls = 0;
  const controller = new ReportAutosaveController({
    save: async () => {
      saveCalls += 1;
      throw new ReportAutosaveConflictError("Server draft changed.");
    },
    initialBody: doc("initial"),
    initialBodyVersion: 3,
    debounceMs: 2000,
    maxWaitMs: 10000,
    now: () => clock.now,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
  });

  controller.update(doc("conflicting final wording"));
  await assert.rejects(
    controller.flushAndWait(),
    (error) => error instanceof ReportAutosaveConflictError,
  );

  assert.equal(controller.getState().status, "conflict");
  assert.equal(controller.getState().hasUnsavedChanges, true);
  assert.equal(controller.getLifecycleState(), "active");

  await assert.rejects(
    controller.flushAndWait(),
    (error) => error instanceof ReportAutosaveConflictError,
  );
  assert.equal(saveCalls, 1, "a conflict is never automatically retried");
});

test("flushAndWait rejects immediately when offline with unsaved changes", async () => {
  const clock = new FakeClock();
  const { controller, calls } = makeController({ clock });

  controller.setOnline(false);
  controller.update(doc("offline final wording"));

  await assert.rejects(controller.flushAndWait(), /offline/i);
  assert.equal(calls.length, 0, "finalization must not try to save or freeze offline");
  assert.equal(controller.getState().status, "offline");
  assert.equal(controller.getState().hasUnsavedChanges, true);
});

test("flushAndWait resolves without a save when the report is already clean", async () => {
  const { controller, calls } = makeController();

  await controller.flushAndWait();

  assert.equal(calls.length, 0);
  assert.equal(controller.getState().hasUnsavedChanges, false);
  assert.equal(controller.getLifecycleState(), "active");
});

test("never reports Saved before the server confirms persistence", async () => {
  const pending = deferred();
  const clock = new FakeClock();
  const states = [];
  const controller = new ReportAutosaveController({
    save: async () => pending.promise,
    initialBody: doc("initial"),
    initialBodyVersion: 1,
    debounceMs: 2000,
    maxWaitMs: 10000,
    now: () => clock.now,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
    onStateChange: (state) => states.push(state),
  });

  controller.update(doc("draft"));
  controller.flushNow();
  await flush();

  assert.equal(controller.getState().status, "saving");
  assert.equal(states.some((state) => state.status === "saved"), false);

  pending.resolve({ bodyVersion: 2 });
  await flush();
  assert.equal(controller.getState().status, "saved");
});

test("a stale CAS preserves local text, reports conflict, and does not retry", async () => {
  const clock = new FakeClock();
  const calls = [];
  const states = [];
  const controller = new ReportAutosaveController({
    save: async (input) => {
      calls.push(input);
      throw new ReportAutosaveConflictError("Report changed.");
    },
    initialBody: doc("initial"),
    initialBodyVersion: 3,
    debounceMs: 2000,
    maxWaitMs: 10000,
    now: () => clock.now,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
    onStateChange: (state) => states.push(state),
  });

  controller.update(doc("my local text"));
  controller.flushNow();
  await flush();

  assert.equal(calls.length, 1);
  assert.equal(controller.getState().status, "conflict");
  assert.match(controller.getState().error, /conflict/i);
  assert.equal(controller.hasUnsavedChanges(), true);

  clock.advance(60_000);
  await flush();
  assert.equal(calls.length, 1, "conflict is never auto-overwritten");
  assert.equal(lastState(states).status, "conflict");
});

test("offline edits stay in memory and flush on reconnect", async () => {
  const { controller, clock, calls } = makeController();

  controller.setOnline(false);
  controller.update(doc("offline text"));
  clock.advance(60_000);
  await flush();

  assert.equal(calls.length, 0);
  assert.equal(controller.getState().status, "offline");
  assert.equal(controller.hasUnsavedChanges(), true);

  controller.setOnline(true);
  await flush();

  assert.equal(calls.length, 1);
  assert.equal(calls[0].body.content[0].content[0].text, "offline text");
});

test("transient save failure keeps the draft dirty and allows a manual retry", async () => {
  let attempt = 0;
  const { controller, clock, calls } = makeController({
    save: async (input) => {
      attempt += 1;
      if (attempt === 1) throw new Error("network down");
      return { bodyVersion: input.expectedBodyVersion + 1 };
    },
  });

  controller.update(doc("retry me"));
  clock.advance(2000);
  await flush();

  assert.equal(controller.getState().status, "error");
  assert.equal(controller.hasUnsavedChanges(), true);

  controller.flushNow();
  await flush();

  assert.equal(calls.length, 2);
  assert.equal(controller.getState().status, "saved");
});

test("reloadFromServer is the explicit reconciliation reset", async () => {
  const { controller, calls } = makeController({
    save: async () => {
      throw new ReportAutosaveConflictError("conflict");
    },
  });

  controller.update(doc("local"));
  controller.flushNow();
  await flush();
  assert.equal(controller.getState().status, "conflict");

  controller.reloadFromServer(doc("server saved"), 8);

  assert.equal(controller.getState().status, "saved");
  assert.equal(controller.getState().bodyVersion, 8);
  assert.equal(controller.hasUnsavedChanges(), false);
  assert.equal(calls.length, 1);
});

test("initial state never claims Saved for an unsaved report", () => {
  const { controller } = makeController();
  assert.equal(controller.getState().status, "clean");
  assert.equal(controller.getState().hasUnsavedChanges, false);
});

test("syncServerVersion adopts a newer version only while the editor is clean", () => {
  const { controller } = makeController();

  controller.syncServerVersion(4);
  assert.equal(controller.getState().bodyVersion, 4);

  controller.update(doc("local edit"));
  controller.syncServerVersion(9);
  assert.equal(
    controller.getState().bodyVersion,
    4,
    "a dirty editor must keep its CAS base and produce a conflict instead of overwriting",
  );
});

// ---------------------------------------------------------------------------
// FIX-1 — unmount / in-flight durability drain
// ---------------------------------------------------------------------------

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
      return { bodyVersion: input.expectedBodyVersion + 1 };
    } finally {
      concurrency.current -= 1;
    }
  };

  return { save, calls, concurrency };
}

test("FIX-1 Test A — disposal drains the newest edit after the in-flight save", async () => {
  const clock = new FakeClock();
  const first = deferred();
  const second = deferred();
  const { save, calls, concurrency } = trackedSave([
    () => first.promise,
    () => second.promise,
  ]);
  const controller = new ReportAutosaveController({
    save,
    initialBody: doc("initial"),
    initialBodyVersion: 1,
    debounceMs: 2000,
    maxWaitMs: 10000,
    now: () => clock.now,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
  });

  controller.update(doc("report A"));
  controller.flushNow();
  await flush();
  assert.equal(calls.length, 1);
  assert.equal(controller.getLifecycleState(), "active");

  controller.update(doc("report B"));
  const disposal = controller.dispose();

  assert.equal(controller.getLifecycleState(), "draining");
  assert.equal(calls.length, 1, "disposal must not start a parallel request");
  assert.equal(controller.hasUnsavedChanges(), true);

  first.resolve({ bodyVersion: 2 });
  await flush();

  assert.equal(calls.length, 2, "newest dirty body starts after the first save");
  assert.equal(calls[1].body.content[0].content[0].text, "report B");
  assert.equal(calls[1].expectedBodyVersion, 2);
  assert.equal(controller.getLifecycleState(), "draining");

  second.resolve({ bodyVersion: 3 });
  await disposal;

  assert.equal(controller.getLifecycleState(), "disposed");
  assert.equal(calls.length, 2);
  assert.equal(concurrency.max, 1, "never more than one report save in flight");
});

test("FIX-1 Test B — multiple edits while draining persist only the latest body", async () => {
  const clock = new FakeClock();
  const first = deferred();
  const { save, calls } = trackedSave([() => first.promise]);
  const controller = new ReportAutosaveController({
    save,
    initialBody: doc("initial"),
    initialBodyVersion: 4,
    debounceMs: 2000,
    maxWaitMs: 10000,
    now: () => clock.now,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
  });

  controller.update(doc("A"));
  controller.flushNow();
  await flush();

  controller.update(doc("B"));
  controller.update(doc("C"));
  const disposal = controller.dispose();

  first.resolve({ bodyVersion: 5 });
  await flush();

  assert.equal(calls.length, 2);
  assert.equal(calls[1].body.content[0].content[0].text, "C");
  assert.equal(calls[1].expectedBodyVersion, 5);

  await disposal;
  assert.equal(controller.getLifecycleState(), "disposed");
  assert.equal(calls.length, 2);
});

test("FIX-1 Test C — the drain lifecycle never exceeds one concurrent request", async () => {
  const clock = new FakeClock();
  const pending = [deferred(), deferred(), deferred()];
  const { save, calls, concurrency } = trackedSave(
    pending.map((entry) => () => entry.promise),
  );
  const controller = new ReportAutosaveController({
    save,
    initialBody: doc("initial"),
    initialBodyVersion: 1,
    debounceMs: 2000,
    maxWaitMs: 10000,
    now: () => clock.now,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
  });

  controller.update(doc("A"));
  controller.flushNow();
  await flush();
  controller.update(doc("B"));
  const disposal = controller.dispose();
  await flush();
  assert.equal(concurrency.max, 1);

  pending[0].resolve({ bodyVersion: 2 });
  await flush();
  assert.equal(calls.length, 2);
  assert.equal(concurrency.max, 1);

  pending[1].resolve({ bodyVersion: 3 });
  await disposal;

  assert.equal(concurrency.max, 1);
  assert.equal(calls.length, 2);
  assert.equal(concurrency.current, 0);
});

test("FIX-1 Test D — a conflict while draining never overwrites or auto-retries", async () => {
  const clock = new FakeClock();
  const first = deferred();
  const { save, calls } = trackedSave([() => first.promise]);
  const controller = new ReportAutosaveController({
    save,
    initialBody: doc("initial"),
    initialBodyVersion: 2,
    debounceMs: 2000,
    maxWaitMs: 10000,
    now: () => clock.now,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
  });

  controller.update(doc("A"));
  controller.flushNow();
  await flush();
  controller.update(doc("B"));
  const disposal = controller.dispose();

  first.reject(new ReportAutosaveConflictError("Server draft changed."));
  await disposal;

  assert.equal(calls.length, 1, "no conflicting retry is attempted");
  assert.equal(controller.getState().status, "conflict");
  assert.equal(controller.hasUnsavedChanges(), true);
  assert.equal(controller.getLifecycleState(), "disposed");

  clock.advance(60_000);
  await flush();
  assert.equal(calls.length, 1);
});

test("FIX-1 Test D2 — a conflict on the queued drain save stops after that attempt", async () => {
  const clock = new FakeClock();
  const first = deferred();
  const second = deferred();
  const { save, calls } = trackedSave([
    () => first.promise,
    () => second.promise,
  ]);
  const controller = new ReportAutosaveController({
    save,
    initialBody: doc("initial"),
    initialBodyVersion: 3,
    debounceMs: 2000,
    maxWaitMs: 10000,
    now: () => clock.now,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
  });

  controller.update(doc("A"));
  controller.flushNow();
  await flush();
  controller.update(doc("B"));
  const disposal = controller.dispose();

  first.resolve({ bodyVersion: 4 });
  await flush();
  assert.equal(calls.length, 2);

  second.reject(new ReportAutosaveConflictError("Server draft changed."));
  await disposal;

  assert.equal(calls.length, 2, "queued conflict is not retried");
  assert.equal(controller.getState().status, "conflict");
  assert.equal(controller.getLifecycleState(), "disposed");
});

test("FIX-1 Test E — clean disposal creates no save request", async () => {
  const clock = new FakeClock();
  const { save, calls } = trackedSave([]);
  const controller = new ReportAutosaveController({
    save,
    initialBody: doc("saved"),
    initialBodyVersion: 7,
    debounceMs: 2000,
    maxWaitMs: 10000,
    now: () => clock.now,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
  });

  await controller.dispose();

  assert.equal(calls.length, 0);
  assert.equal(clock.timers.size, 0);
  assert.equal(controller.getLifecycleState(), "disposed");
  assert.equal(controller.getState().hasUnsavedChanges, false);
});

test("FIX-1 — disposal flushes pending dirty work when nothing is in flight", async () => {
  const clock = new FakeClock();
  const { save, calls } = trackedSave([]);
  const controller = new ReportAutosaveController({
    save,
    initialBody: doc("initial"),
    initialBodyVersion: 1,
    debounceMs: 2000,
    maxWaitMs: 10000,
    now: () => clock.now,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
  });

  controller.update(doc("pending"));
  const disposal = controller.dispose();
  await disposal;

  assert.equal(calls.length, 1, "unmount flushes a pending debounce");
  assert.equal(calls[0].body.content[0].content[0].text, "pending");
  assert.equal(calls[0].expectedBodyVersion, 1);
  assert.equal(controller.getLifecycleState(), "disposed");
  assert.equal(clock.timers.size, 0);
});

test("FIX-1 — late edits after a disposal request are ignored", async () => {
  const clock = new FakeClock();
  const { save, calls } = trackedSave([]);
  const controller = new ReportAutosaveController({
    save,
    initialBody: doc("initial"),
    initialBodyVersion: 1,
    debounceMs: 2000,
    maxWaitMs: 10000,
    now: () => clock.now,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
  });

  await controller.dispose();
  controller.update(doc("late edit"));
  assert.equal(controller.flushNow(), false);

  clock.advance(60_000);
  await flush();

  assert.equal(calls.length, 0);
  assert.equal(controller.getLifecycleState(), "disposed");
});

test("reverting an unsaved new report never claims Saved", async () => {
  const clock = new FakeClock();
  const states = [];
  const empty = { type: "doc", content: [{ type: "paragraph", content: [] }] };
  const controller = new ReportAutosaveController({
    save: async (input) => ({ bodyVersion: input.expectedBodyVersion + 1 }),
    initialBody: empty,
    initialBodyVersion: 0,
    debounceMs: 2000,
    maxWaitMs: 10000,
    now: () => clock.now,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
    onStateChange: (state) => states.push(state),
  });

  controller.update(doc("temporary"));
  controller.update(empty);
  clock.advance(10_000);
  await flush();

  assert.equal(controller.getState().status, "clean");
  assert.equal(
    states.some((state) => state.status === "saved"),
    false,
    "no server confirmation ever occurred",
  );
});

// ---------------------------------------------------------------------------
// Preview throttle
// ---------------------------------------------------------------------------

test("preview throttle sends immediately then coalesces to the newest body", () => {
  const clock = new FakeClock();
  const sent = [];
  const throttle = new ReportPreviewThrottle({
    intervalMs: 750,
    now: () => clock.now,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
    send: (value) => sent.push(value),
  });

  throttle.push("a");
  assert.deepEqual(sent, ["a"]);

  clock.advance(100);
  throttle.push("b");
  clock.advance(100);
  throttle.push("c");
  clock.advance(100);
  throttle.push("d");
  assert.deepEqual(sent, ["a"]);

  clock.advance(450);
  assert.deepEqual(sent, ["a", "d"], "only the newest snapshot is sent");
});

test("preview throttle never sends more than once per interval", () => {
  const clock = new FakeClock();
  const sentAt = [];
  const throttle = new ReportPreviewThrottle({
    intervalMs: 750,
    now: () => clock.now,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
    send: () => sentAt.push(clock.now),
  });

  for (let index = 0; index < 20; index += 1) {
    throttle.push(`value-${index}`);
    clock.advance(100);
  }

  for (let index = 1; index < sentAt.length; index += 1) {
    assert.ok(sentAt[index] - sentAt[index - 1] >= 750);
  }
  assert.ok(sentAt.length <= 4);
});

test("clearing the throttle drops a pending preview", () => {
  const clock = new FakeClock();
  const sent = [];
  const throttle = new ReportPreviewThrottle({
    intervalMs: 750,
    now: () => clock.now,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
    send: (value) => sent.push(value),
  });

  throttle.push("a");
  throttle.push("b");
  throttle.clear();
  clock.advance(10_000);

  assert.deepEqual(sent, ["a"]);
});

// ---------------------------------------------------------------------------
// Preview parsing / ordering
// ---------------------------------------------------------------------------

function preview(overrides = {}) {
  return {
    scheduleId: "sched-1",
    baseBodyVersion: 4,
    previewSequence: 2,
    senderUserId: "rapporteur-1",
    body: doc("live wording"),
    ...overrides,
  };
}

test("parses and normalizes a valid live report preview", () => {
  const parsed = parseLiveReportPreview(preview());

  assert.ok(parsed);
  assert.equal(parsed.scheduleId, "sched-1");
  assert.equal(parsed.baseBodyVersion, 4);
  assert.equal(parsed.previewSequence, 2);
  assert.equal(parsed.senderUserId, "rapporteur-1");
  assert.equal(parsed.body.content[0].content[0].text, "live wording");
});

test("ignores malformed or untrusted preview payloads", () => {
  for (const value of [
    null,
    undefined,
    "preview",
    [],
    {},
    preview({ scheduleId: "" }),
    preview({ scheduleId: "defense:sched-1" }),
    preview({ baseBodyVersion: -1 }),
    preview({ baseBodyVersion: 1.5 }),
    preview({ previewSequence: -1 }),
    preview({ previewSequence: "2" }),
    preview({ senderUserId: "" }),
    preview({ body: null }),
    preview({ body: { type: "doc", content: "bad" } }),
  ]) {
    assert.equal(parseLiveReportPreview(value), null);
  }
});

test("stale or duplicate previews from the same sender are ignored", () => {
  assert.equal(isNewerLiveReportPreview(null, preview()), true);
  assert.equal(
    isNewerLiveReportPreview(preview({ previewSequence: 3 }), preview({ previewSequence: 4 })),
    true,
  );
  assert.equal(
    isNewerLiveReportPreview(preview({ previewSequence: 4 }), preview({ previewSequence: 4 })),
    false,
  );
  assert.equal(
    isNewerLiveReportPreview(preview({ previewSequence: 5 }), preview({ previewSequence: 4 })),
    false,
  );
});

test("a replacement Rapporteur's preview sequence starts a new stream", () => {
  assert.equal(
    isNewerLiveReportPreview(
      preview({ senderUserId: "old-rapporteur", previewSequence: 99 }),
      preview({ senderUserId: "new-rapporteur", previewSequence: 1 }),
    ),
    true,
  );
});

test("live preview displays only while editable and not behind saved REST state", () => {
  const base = {
    preview: preview({ baseBodyVersion: 4 }),
    scheduleId: "sched-1",
    reportStatus: "DRAFT",
  };

  assert.equal(
    shouldDisplayLiveReportPreview({ ...base, authoritativeBodyVersion: 4 }),
    true,
  );
  assert.equal(
    shouldDisplayLiveReportPreview({ ...base, authoritativeBodyVersion: 3 }),
    true,
  );
  assert.equal(
    shouldDisplayLiveReportPreview({ ...base, authoritativeBodyVersion: 5 }),
    false,
    "saved REST state has advanced past the preview",
  );
  assert.equal(
    shouldDisplayLiveReportPreview({
      ...base,
      scheduleId: "sched-2",
      authoritativeBodyVersion: 4,
    }),
    false,
  );
});

test("frozen/for-signature/finalized reports never display a live preview", () => {
  for (const reportStatus of [
    "FOR_SIGNATURE",
    "PARTIALLY_SIGNED",
    "ALL_SIGNED",
    "DISTRIBUTED",
    "FINALIZED",
  ]) {
    assert.equal(
      shouldDisplayLiveReportPreview({
        preview: preview(),
        scheduleId: "sched-1",
        reportStatus,
        authoritativeBodyVersion: 4,
      }),
      false,
    );
  }
});

test("the transport event name is report:preview and not a persisted domain event", () => {
  assert.equal(REPORT_PREVIEW_EVENT, "report:preview");
  const events = read(EVENTS);
  assert.equal(events.includes('"report:preview"'), false);
});

// ---------------------------------------------------------------------------
// Source contracts (filled in when the UI wiring lands)
// ---------------------------------------------------------------------------

test("CDW-LIVE-1A files exist", () => {
  for (const file of [AUTOSAVE, THROTTLE, PREVIEW, CONTEXT]) {
    assert.equal(existsSync(resolve(root, file)), true, `${file} should exist`);
  }
});

test("the workspace still owns exactly one socket connection", () => {
  const panel = read(PANEL);
  const page = read(PAGE);
  const hook = read(HOOK);
  const context = read(CONTEXT);

  assert.equal(panel.includes("io("), false);
  assert.equal(panel.includes("createDefenseSocket"), false);
  assert.equal(panel.includes("socket.io-client"), false);
  assert.equal(
    (page.match(/useDefenseRealtime\(/g) ?? []).length,
    1,
    "the page owns exactly one realtime hook call",
  );
  assert.equal(context.includes("useDefenseRealtime("), false);
  assert.equal(hook.includes("createDefenseSocket"), true);
  assert.equal(hook.split("createDefenseSocket(").length - 1, 1);
});

test("canonical nine realtime events remain unchanged", () => {
  const events = read(EVENTS);
  assert.equal(events.includes('"report:preview"'), false);
  assert.equal(events.includes('"defense.started"'), true);
  assert.equal(events.includes('"defense.concluded"'), true);
});

test("report authoring uses the serialized autosave pipeline, not a second save", () => {
  const panel = read(PANEL);
  assert.equal(panel.includes("ReportAutosaveController"), true);
  assert.equal(panel.includes("useMutation"), false, "no competing save mutation");
  assert.equal(panel.includes("flushNow"), true);
  assert.equal(panel.includes("controller.flushNow()"), true);
});

test("a clean editor adopts a newer authoritative body instead of overwriting it", () => {
  const panel = read(PANEL);
  assert.equal(panel.includes("serverVersion > state.bodyVersion"), true);
  assert.equal(panel.includes("reloadFromServer"), true);
});

test("FIX-1 — unmount drains through dispose instead of racing flush then dispose", () => {
  const panel = read(PANEL);
  assert.equal(panel.includes("void controller.dispose()"), true);
  assert.doesNotMatch(
    panel,
    /controller\.flushNow\(\);\s*\n\s*controller\.dispose\(\)/,
  );
});

test("read-only viewers receive an ephemeral live preview with no edit controls", () => {
  const panel = read(PANEL);
  assert.equal(panel.includes("Live preview"), true);
  assert.equal(panel.includes("shouldDisplayLiveReportPreview"), true);
  assert.equal(panel.includes("ReportDocumentView doc={livePreview.body}"), true);
  assert.equal(panel.includes("queryClient.setQueryData"), false);
});

test("the report socket hook wires the preview transport and clears it on terminal state", () => {
  const hook = read(HOOK);
  const preview = read(PREVIEW);
  const context = read(CONTEXT);

  assert.equal(hook.includes("REPORT_PREVIEW_EVENT"), true);
  assert.equal(hook.includes("ReportPreviewThrottle"), true);
  assert.equal(hook.includes("parseLiveReportPreview"), true);
  assert.equal(hook.includes("isNewerLiveReportPreview"), true);
  assert.equal(hook.includes("reportPreviewDispositionForEvent"), true);
  assert.equal(hook.includes("report.draft.updated"), true);
  for (const terminal of [
    "report.ready_for_signature",
    "rap.signature.recorded",
    "rap.finalized",
    "defense.concluded",
  ]) {
    assert.equal(preview.includes(terminal), true, terminal);
  }
  assert.equal(context.includes("sendReportPreview"), true);
  assert.equal(context.includes("liveReportPreview"), true);
});

test("autosave flushes on blur/visibility and warns before unload when dirty", () => {
  const panel = read(PANEL);
  assert.equal(panel.includes("beforeunload"), true);
  assert.equal(panel.includes("visibilitychange"), true);
  assert.equal(panel.includes("flushNow"), true);
  assert.equal(panel.includes("navigator.onLine"), true);
});

test("the read-only committee report polling fallback remains 20 seconds", () => {
  const panel = read(PANEL);
  assert.match(panel, /refetchInterval:[\s\S]*?20000/);
});

test("no evaluation autosave or private draft broadcast was introduced", () => {
  const panel = read(PANEL);
  const preview = read(PREVIEW);
  assert.equal(panel.includes("oralEvaluation"), false);
  assert.equal(preview.includes("recommendation"), false);
  assert.equal(preview.includes("criterion"), false);
});
