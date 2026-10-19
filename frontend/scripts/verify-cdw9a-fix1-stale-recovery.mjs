// CDW-9A FIX-1 — explicit stale evaluation draft recovery.
//
// Run: node --experimental-strip-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/verify-cdw9a-fix1-stale-recovery.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  EvaluationAutosaveController,
} from "../src/lib/evaluation/evaluation-autosave.ts";

const root = process.cwd();
const read = (relative) => readFileSync(resolve(root, relative), "utf8");
const FORM = "src/components/defense-workspace/oral-evaluation-form.tsx";

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

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const conflict = () =>
  Object.assign(new Error("Evaluation state changed. Refresh and try again."), {
    statusCode: 409,
  });

test("conflict blocks automatic retry and unmount drain", async () => {
  let saves = 0;
  const controller = new EvaluationAutosaveController({
    save: async () => {
      saves += 1;
      throw conflict();
    },
    initialSnapshot: snapshot(),
    debounceMs: 1,
    maxWaitMs: 10,
    setTimer: () => 1,
    clearTimer: () => {},
  });

  controller.update(snapshot(1.5, "local unsaved work"));
  assert.equal(controller.flushNow(), true);
  await tick();
  assert.equal(saves, 1);
  assert.equal(controller.getState().status, "error");
  assert.equal(controller.getState().hasUnsavedChanges, true);

  controller.markConflict();
  assert.equal(controller.flushNow(), false);
  assert.equal(await controller.flushAndWait(), false);
  await controller.dispose();
  assert.equal(saves, 1);
});

test("explicit reconcile resets the saved baseline and allows a normal save", async () => {
  let fail = true;
  const saved = [];
  const controller = new EvaluationAutosaveController({
    save: async (next) => {
      if (fail) throw conflict();
      saved.push(next);
    },
    initialSnapshot: snapshot(),
    debounceMs: 1,
    maxWaitMs: 10,
    setTimer: () => 1,
    clearTimer: () => {},
  });

  controller.update(snapshot(1.5, "local unsaved work"));
  controller.flushNow();
  await tick();
  controller.markConflict();

  assert.equal(
    controller.reconcileWithPersisted(snapshot(2, "authoritative server draft")),
    true,
  );
  assert.equal(controller.getState().hasUnsavedChanges, false);
  assert.equal(controller.getState().status, "saved");

  fail = false;
  controller.update(snapshot(2.25, "edited after reload"));
  assert.equal(controller.flushNow(), true);
  await tick();

  assert.equal(saved.length, 1);
  assert.equal(saved[0].criteria.organization, 2.25);
  assert.equal(saved[0].recommendations, "edited after reload");
});

test("reconcile refuses to replace a baseline while a save is in flight", async () => {
  let release;
  const controller = new EvaluationAutosaveController({
    save: () =>
      new Promise((resolve) => {
        release = resolve;
      }),
    initialSnapshot: snapshot(),
    debounceMs: 1,
    maxWaitMs: 10,
    setTimer: () => 1,
    clearTimer: () => {},
  });

  controller.update(snapshot(1.5, "local"));
  controller.flushNow();
  assert.equal(
    controller.reconcileWithPersisted(snapshot(2, "server")),
    false,
  );
  release();
  await tick();
});

test("conflict UI preserves local work and requires explicit reload", () => {
  const source = read(FORM);

  assert.match(
    source,
    /This evaluation was updated in another tab or session\.\s+Your\s+unsaved changes are still here\.\s+Reload the latest saved\s+evaluation before continuing\./,
  );
  assert.match(source, /Reload latest saved evaluation/);
});

test("autosave conflict enters explicit recovery and blocks further edits", () => {
  const source = read(FORM);

  assert.match(source, /setConflict\(true\)/);
  assert.match(source, /controllerRef\.current\?\.markConflict\(\)/);
  assert.match(
    source,
    /const inputsDisabled = locked \|\| finalize\.isPending \|\| conflict/,
  );
});

test("explicit reload adopts the authoritative snapshot and row version", () => {
  const source = read(FORM);

  assert.match(source, /queryClient\.fetchQuery/);
  assert.match(source, /initialMatrixValues\(latest\)/);
  assert.match(source, /latestVersionRef\.current = latest\.updatedAt/);
  assert.match(source, /reconcileWithPersisted/);
  assert.match(source, /setConflict\(false\)/);
});

test("conflict recovery is not invoked automatically", () => {
  const source = read(FORM);

  assert.doesNotMatch(
    source,
    /useEffect\([^)]*conflict[\s\S]{0,240}loadLatestEvaluation/,
  );
});

test("FINALIZED authoritative state hides conflict and locks edits", () => {
  const source = read(FORM);

  assert.match(source, /conflict && !locked/);
  assert.match(source, /const inputsDisabled = locked/);
  assert.match(source, /\{locked && \(/);
});

test("FINALIZED transition presents authoritative values without remounting on draft refresh", () => {
  const source = read(FORM);

  assert.match(
    source,
    /const displayValues = locked\s*\?\s*initialMatrixValues\(evaluation\)\s*:\s*values/,
  );
  assert.match(
    source,
    /const displayRecommendations = locked\s*\?\s*evaluation\?\.recommendations \?\? ""\s*:\s*recommendations/,
  );
  assert.match(source, /values=\{displayValues\}/);
  assert.match(source, /value=\{displayRecommendations\}/);
  assert.doesNotMatch(source, /key=.*updatedAt/);
});

test("FINALIZED transition blocks stale autosave/dispose and closes finalization UI", () => {
  const source = read(FORM);

  assert.match(source, /const mountedLockedRef = useRef\(locked\)/);
  assert.match(source, /if \(mountedLockedRef\.current\) return/);
  assert.match(
    source,
    /if \(locked\) controllerRef\.current\?\.markConflict\(\)/,
  );
  assert.match(source, /void controller\.dispose\(\)/);
  assert.match(source, /showFinalization && !locked/);
});

test("blocked dispose does not drain a dirty local draft during finalized transition", async () => {
  let saves = 0;
  const controller = new EvaluationAutosaveController({
    save: async () => {
      saves += 1;
    },
    initialSnapshot: snapshot(),
    debounceMs: 1,
    maxWaitMs: 10,
    setTimer: () => 1,
    clearTimer: () => {},
  });

  controller.update(snapshot(1.5, "stale local work"));
  controller.markConflict();
  await controller.dispose();

  assert.equal(saves, 0);
  assert.equal(controller.getState().hasUnsavedChanges, true);
});

test("finalization still drains autosave before the irreversible request", () => {
  const source = read(FORM);
  const start = source.indexOf("const finalize = useMutation({");
  const end = source.indexOf("\n  const inputsDisabled", start);
  const mutation = source.slice(start, end);

  const flush = mutation.indexOf("controller.flushAndWait()");
  const finalize = mutation.indexOf("evaluation/finalize");
  assert.ok(flush >= 0);
  assert.ok(finalize > flush);
  assert.match(mutation, /if \(!settled\)/);
});
