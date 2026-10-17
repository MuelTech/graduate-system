// CDW-6 — Defense History + revision traceability (source contracts + pure rules).
//
// Run: node --experimental-strip-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/verify-cdw6-history.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  assignAttemptNumbers,
  defenseTypeLabel,
  groupHistoryItems,
  historyVerdictLabel,
} from "../src/lib/defense-history/history-view.ts";

const root = process.cwd();
const read = (relative) => readFileSync(resolve(root, relative), "utf8");

const PANEL = "src/components/defense-workspace/defense-history-panel.tsx";
const SHELL = "src/components/defense-workspace/workspace-shell.tsx";
const HOOKS = "src/hooks/use-defense-history.ts";
const HELPERS = "src/lib/defense-history/history-view.ts";
const TYPES = "src/types/defense-history.ts";
const WORKSPACE_TYPES = "src/types/defense-workspace.ts";
const OLD_PROPOSAL_PANEL = "src/components/defense-workspace/proposal-history-panel.tsx";

test("CDW-6 history files exist and the competing Proposal Context panel is gone", () => {
  for (const file of [PANEL, HOOKS, HELPERS, TYPES]) {
    assert.equal(existsSync(resolve(root, file)), true, `${file} should exist`);
  }
  assert.equal(
    existsSync(resolve(root, OLD_PROPOSAL_PANEL)),
    false,
    "the CP8 ProposalHistoryPanel must be replaced, not kept as a second history system",
  );
  assert.doesNotMatch(read(WORKSPACE_TYPES), /proposalHistory/);
});

test("the Student Document experience keeps Current Manuscript default and adds Defense History", () => {
  const shell = read(SHELL);
  assert.match(shell, /useState<CenterTab>\("doc"\)/);
  assert.match(shell, /DefenseHistoryControl/);
  assert.doesNotMatch(shell, /Proposal Context/);
});

test("history categories are the three canonical relationships", () => {
  const helpers = read(HELPERS);
  assert.match(helpers, /Previous Same-Stage Attempt/);
  assert.match(helpers, /Previous Stage/);
  assert.match(helpers, /Older History/);
  const grouped = groupHistoryItems([
    { relationship: "SAME_STAGE_REDEFENSE", scheduleId: "a" },
    { relationship: "PREVIOUS_STAGE", scheduleId: "b" },
    { relationship: "OLDER_HISTORY", scheduleId: "c" },
  ]);
  assert.deepEqual(grouped.sameStage.map((i) => i.scheduleId), ["a"]);
  assert.deepEqual(grouped.previousStage.map((i) => i.scheduleId), ["b"]);
  assert.deepEqual(grouped.olderHistory.map((i) => i.scheduleId), ["c"]);
});

test("verdicts and stages use human labels (legacy outcomes labelled honestly)", () => {
  assert.equal(historyVerdictLabel("PASSED"), "Passed");
  assert.equal(historyVerdictLabel("REDEFENSE_REQUIRED"), "Re-defense Required");
  assert.equal(historyVerdictLabel("REVISION_REQUIRED"), "Revision Required (legacy)");
  assert.equal(historyVerdictLabel(null), null);
  assert.equal(defenseTypeLabel("PROPOSAL_DEFENSE"), "Proposal Defense");
  assert.equal(defenseTypeLabel("TITLE_DEFENSE"), "Title Defense");
  assert.equal(defenseTypeLabel("FINAL_DEFENSE"), "Final Defense");
});

test("historical attempt numbers are deterministic (oldest first per stage)", () => {
  const numbers = assignAttemptNumbers([
    { stage: "PROPOSAL", scheduleId: "p2", concludedAt: "2026-09-05T00:00:00.000Z" },
    { stage: "PROPOSAL", scheduleId: "p1", concludedAt: "2026-07-05T00:00:00.000Z" },
    { stage: "TITLE", scheduleId: "t1", concludedAt: "2026-05-05T00:00:00.000Z" },
  ]);
  assert.deepEqual(numbers, { p1: 1, p2: 2, t1: 1 });
});

test("the panel exposes the required per-attempt actions", () => {
  const panel = read(PANEL);
  for (const label of [
    "View Previous Manuscript",
    "View Previous RAP",
    "View Historical Annotations",
    "Compare with Current",
  ]) {
    assert.match(panel, new RegExp(label));
  }
});

test("the historical viewer is read-only: no annotation-creation callback, no composer", () => {
  const panel = read(PANEL);
  // No text-selection callback anywhere → historical highlights can never be created.
  assert.doesNotMatch(panel, /onTextSelection/);
  // No composer / reply authoring in history.
  assert.doesNotMatch(panel, /AnnotationCommentComposer|onSubmitNewComment|onReply=\{\(.*\) => Promise/);
  assert.match(panel, /canComment=\{false\}/);
  assert.match(panel, /Read-only historical attempt/);
});

test("history never exposes prior private evaluator scores or raw signatures", () => {
  const combined = read(PANEL) + read(HOOKS) + read(TYPES);
  for (const forbidden of [
    "signatureData",
    "signature_data",
    "overallAverage",
    "groupAAverage",
    "groupBAverage",
    "officialSnapshot",
  ]) {
    assert.doesNotMatch(combined, new RegExp(forbidden));
  }
});

test("no automatic diff, no AI revision-compliance judgement", () => {
  const panel = read(PANEL);
  // The comparison is explicitly manual and non-judgemental.
  assert.match(panel, /Manual side-by-side comparison/);
  assert.match(panel, /does\s+not judge/i);
  for (const forbidden of [
    "textDiff",
    "semanticDiff",
    "visualDiff",
    "computeDiff",
    "revisionCompliant",
    "isCompliedWith",
    "aiAssessment",
  ]) {
    assert.doesNotMatch(panel, new RegExp(forbidden));
  }
});

test("history is queried read-only and keyed per current + historical attempt (no cache mixing)", () => {
  const hooks = read(HOOKS);
  assert.doesNotMatch(hooks, /useMutation/);
  assert.match(hooks, /defenseHistoryQueryKey\(scheduleId\)/);
  assert.match(hooks, /defenseHistoryAttemptQueryKey\(scheduleId, historicalScheduleId/);
  assert.match(hooks, /useQuery/);
});

test("structured historical RAP reuses the safe read-only renderer; legacy text is honest", () => {
  const panel = read(PANEL);
  assert.match(panel, /ReportDocumentView/);
  assert.match(panel, /normalizeReportDocument/);
  assert.match(panel, /Legacy historical report/);
  assert.match(panel, /Finalized RAP unavailable/);
});

test("unavailable historical data renders honest states (never a latest-document substitute)", () => {
  assert.match(read(HELPERS), /Historical manuscript unavailable/);
  assert.match(read(HELPERS), /Finalized RAP unavailable/);
  assert.match(read(HELPERS), /No historical annotations recorded/);
  const panel = read(PANEL);
  assert.match(panel, /Historical manuscript unavailable/);
});

test("Compare with Current is guarded when the workspace has no current document", () => {
  const panel = read(PANEL);
  const shell = read(SHELL);
  // The compare pane must never be reachable without the collaboration provider,
  // so the control threads the current-document capability down to it.
  assert.match(shell, /hasCurrentDocument/);
  assert.match(panel, /hasCurrentDocument/);
  // The pane renders an unavailable state instead of the provider-bound viewer.
  assert.match(panel, /!hasCurrentDocument/);
});

test("the historical manuscript loads only through the controlled authenticated viewer", () => {
  const panel = read(PANEL);
  assert.match(panel, /CollaborativeManuscriptViewer/);
  // No storage paths or direct public URLs are referenced.
  assert.doesNotMatch(panel, /uploads\/|\/public\/|filePath|storageKey/);
});
