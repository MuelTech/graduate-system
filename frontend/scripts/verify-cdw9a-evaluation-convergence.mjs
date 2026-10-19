// CDW-9A — evaluator/Summary stale-client recovery and finalization ordering.
//
// Run: node --test scripts/verify-cdw9a-evaluation-convergence.mjs
//
// This is a focused frontend source-contract verifier. The backend concurrency
// behavior is covered by deterministic Vitest service tests.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const read = (relative) => readFileSync(resolve(root, relative), "utf8");

const FORM = "src/components/defense-workspace/oral-evaluation-form.tsx";

function finalizeMutationSource(source) {
  const start = source.indexOf("const finalize = useMutation({");
  assert.ok(start >= 0, "finalize mutation is present");
  const end = source.indexOf("\n  const inputsDisabled", start);
  assert.ok(end > start, "finalize mutation boundary is present");
  return source.slice(start, end);
}

test("finalize 409 refreshes authoritative evaluation and workspace state", () => {
  const mutation = finalizeMutationSource(read(FORM));

  assert.match(
    mutation,
    /e instanceof ApiError && e\.statusCode === 409/,
    "finalize conflict is classified as HTTP 409",
  );
  assert.match(
    mutation,
    /queryKey: evalQueryKey\(scheduleId\)/,
    "finalize conflict refreshes the evaluator's own evaluation",
  );
  assert.match(
    mutation,
    /queryKey: \["defenseWorkspace", scheduleId\]/,
    "finalize conflict refreshes authoritative workspace state",
  );
});

test("autosave 409 still reconciles authoritative state", () => {
  const source = read(FORM);
  const saveStart = source.indexOf("save: async (snapshot) => {");
  const finalizeStart = source.indexOf("const finalize = useMutation({");
  assert.ok(saveStart >= 0 && finalizeStart > saveStart);

  const save = source.slice(saveStart, finalizeStart);
  assert.match(save, /error instanceof ApiError && error\.statusCode === 409/);
  assert.match(save, /queryKey: evalQueryKey\(scheduleId\)/);
  assert.match(save, /queryKey: \["defenseWorkspace", scheduleId\]/);
});

test("finalization still drains autosave before the irreversible request", () => {
  const mutation = finalizeMutationSource(read(FORM));
  const flush = mutation.indexOf("controller.flushAndWait()");
  const finalize = mutation.indexOf("evaluation/finalize");

  assert.ok(flush >= 0, "flushAndWait is present");
  assert.ok(finalize > flush, "finalize endpoint is called only after the drain");
  assert.match(mutation, /if \(!settled\)/);
});
