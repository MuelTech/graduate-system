// CDW-LIVE-1 MANUAL-QA FIX-2 — evaluation finalization UX + rail layout.
//
// Run: node --experimental-strip-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/verify-cdw-live-1-manual-qa-fix-2.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const read = (relative) => readFileSync(resolve(root, relative), "utf8");

const FORM = "src/components/defense-workspace/oral-evaluation-form.tsx";
const DIALOG =
  "src/components/defense-workspace/evaluation-finalization-dialog.tsx";
const SIGNATURE = "src/components/defense-workspace/e-signature-pad.tsx";
const RAIL = "src/components/defense-workspace/role-rail.tsx";
const SHELL = "src/components/defense-workspace/workspace-shell.tsx";
const COMPLETION =
  "src/components/defense-workspace/evaluation-completion-tracker.tsx";
const EVENTS = "src/lib/realtime/defense-realtime-events.ts";

test("FIX-2 files exist", () => {
  for (const file of [FORM, DIALOG, SIGNATURE, RAIL, SHELL]) {
    assert.equal(existsSync(resolve(root, file)), true, `${file} should exist`);
  }
});

test("evaluator Save now is gone while autosave feedback remains", () => {
  const form = read(FORM);

  assert.doesNotMatch(form, /Save now/);
  assert.doesNotMatch(form, /\bSave\b.*from "lucide-react"/);
  assert.match(form, /EvaluationSaveStatus/);
  assert.match(form, /Unsaved changes/);
  assert.match(form, /Offline — changes not saved/);
  assert.match(form, /Save failed/);
  assert.match(form, /Saved/);
});

test("Review & Finalize remains the single evaluator action", () => {
  const form = read(FORM);

  assert.match(form, /Review &amp; Finalize/);
  assert.match(form, /setShowFinalization\(true\)/);
  assert.match(form, /<EvaluationFinalizationDialog/);
});

test("finalization is not inline: another signature component is absent from the rail form", () => {
  const form = read(FORM);
  const rail = read(RAIL);

  assert.doesNotMatch(form, /ESignaturePad/);
  assert.doesNotMatch(rail, /ESignaturePad|Confirm Finalize|Review Evaluation/);
  assert.match(form, /EvaluationFinalizationDialog/);
});

test("Step 1 review content and actions are present", () => {
  const dialog = read(DIALOG);

  assert.match(dialog, /Review Evaluation/);
  assert.match(dialog, /Group I/);
  assert.match(dialog, /Group II/);
  assert.match(dialog, /Group I Average/);
  assert.match(dialog, /Group II Average/);
  assert.match(dialog, /Recommendations/);
  assert.match(dialog, /Cancel/);
  assert.match(dialog, /Continue to Sign/);
  assert.doesNotMatch(dialog, /Overall|Final Rating/);
});

test("Step 1 incomplete evaluation cannot continue to signing", () => {
  const dialog = read(DIALOG);

  assert.match(dialog, /!allCriteriaComplete/);
  assert.match(dialog, /disabled=\{finalizePending \|\| !allCriteriaComplete\}/);
  assert.match(dialog, /All nine criteria are required/);
});

test("Step 2 contains the signature UI and Back / Confirm Finalize", () => {
  const dialog = read(DIALOG);

  assert.match(dialog, /Sign Your Evaluation/);
  assert.match(dialog, /<ESignaturePad/);
  assert.match(dialog, /Back/);
  assert.match(dialog, /Confirm Finalize/);
  assert.match(dialog, /cannot be undone/);
});

test("closing, cancelling, or going Back never finalizes and clears the signature", () => {
  const dialog = read(DIALOG);

  assert.match(dialog, /const close = \(\) => \{/);
  assert.match(dialog, /setSignature\(""\)/);
  assert.match(dialog, /setStep\("review"\)/);
  assert.doesNotMatch(dialog, /apiClientRequest|fetch\(|\/evaluation\/finalize/);
  assert.match(dialog, /onOpenChange\(false\)/);
});

test("finalize drains autosave before the explicit finalize POST", () => {
  const form = read(FORM);
  const flushIndex = form.indexOf("controller.flushAndWait()");
  const finalizeIndex = form.indexOf("evaluation/finalize");

  assert.ok(flushIndex >= 0);
  assert.ok(finalizeIndex > flushIndex);
  assert.match(form, /if \(!settled\)[\s\S]{0,180}throw new Error/);
});

test("Confirm Finalize is guarded against duplicate submission", () => {
  const dialog = read(DIALOG);
  const form = read(FORM);

  assert.match(dialog, /confirmingRef/);
  assert.match(dialog, /finalizePending/);
  assert.match(dialog, /disabled=\{finalizePending \|\| !signatureReady/);
  assert.match(form, /const finalize = useMutation/);
  assert.match(form, /finalize\.isPending/);
});

test("finalized evaluation renders a compact locked state", () => {
  const form = read(FORM);

  assert.match(form, /Evaluation finalized/);
  assert.match(form, /Signed\s*\{/);
  assert.match(form, /evaluation\?\.signedAt/);
  assert.match(form, /isLocked === true/);
  assert.doesNotMatch(form, /This evaluation is locked\./);
});

test("Chairman and Panelist share the same evaluator form and modal flow", () => {
  const rail = read(RAIL);

  assert.match(rail, /<OralEvaluationForm scheduleId=\{scheduleId\} \/>/);
  assert.doesNotMatch(rail, /isChairman[\s\S]{0,120}OralEvaluationForm/);
});

test("Formal Verdict remains separate from evaluation finalization", () => {
  const rail = read(RAIL);
  const dialog = read(DIALOG);

  const evaluation = rail.indexOf("<OralEvaluationForm");
  const completion = rail.indexOf("<EvaluationCompletionTracker");
  const verdict = rail.indexOf("<ChairmanVerdictPanel");
  const roster = rail.indexOf("Committee roster");

  assert.ok(evaluation >= 0);
  assert.ok(completion > evaluation);
  assert.ok(verdict > completion);
  assert.ok(roster > verdict);
  assert.doesNotMatch(dialog, /Formal Verdict|PASSED|REDEFENSE_REQUIRED|\/conclusion/);
});

test("role rail keeps stacked normal-flow sections and no sticky evaluator footer", () => {
  const rail = read(RAIL);
  const form = read(FORM);

  assert.match(rail, /\[&>\*\]:shrink-0/);
  assert.doesNotMatch(rail, /absolute[\s\S]{0,120}(Evaluation|Verdict|Roster)/);
  assert.doesNotMatch(form, /sticky bottom-0/);
  assert.doesNotMatch(form, /fixed inset-0/);
  assert.match(form, /<div className="space-y-4 p-3">/);
});

test("shared Dialog primitive is reused", () => {
  const dialog = read(DIALOG);

  assert.match(dialog, /from "@\/components\/ui\/dialog"/);
  assert.match(dialog, /DialogContent/);
  assert.match(dialog, /DialogTitle/);
  assert.match(dialog, /DialogDescription/);
  assert.match(dialog, /DialogFooter/);
});

test("dialog is centered, bounded, internally scrollable, and accessible", () => {
  const dialog = read(DIALOG);

  assert.match(dialog, /max-h-\[85vh\]/);
  assert.match(dialog, /overflow-y-auto/);
  assert.match(dialog, /sm:max-w-2xl/);
  assert.match(dialog, /role="alert"/);
  assert.match(dialog, /DialogTitle/);
  assert.match(dialog, /DialogDescription/);
  assert.match(dialog, /handleOpenChange/);
  assert.match(dialog, /if \(finalizePending\) return/);
});

test("signature canvas scales pointer coordinates and is touch-friendly", () => {
  const signature = read(SIGNATURE);

  assert.match(signature, /canvas\.width \/ r\.width/);
  assert.match(signature, /canvas\.height \/ r\.height/);
  assert.match(signature, /width=\{720\}/);
  assert.match(signature, /height=\{240\}/);
  assert.match(signature, /touch-none/);
  assert.match(signature, /aria-label="Draw your signature"/);
  assert.match(signature, /aria-label="Type your full name as e-signature"/);
  assert.match(signature, /data:image\/png;base64/);
});

test("no evaluation-draft realtime event or socket usage in the finalization UI", () => {
  const combined = [read(FORM), read(DIALOG), read(SIGNATURE), read(RAIL)].join(
    "\n",
  );

  assert.doesNotMatch(combined, /socket\.io|createDefenseSocket|useDefenseRealtime/i);
  assert.doesNotMatch(
    combined,
    /evaluation\.(draft|preview|typing|score)/i,
  );
  assert.doesNotMatch(read(EVENTS), /evaluation\.(draft|preview|typing|score)/i);
});

test("no local signature persistence and no schema/migration work", () => {
  const combined = [read(FORM), read(DIALOG), read(SIGNATURE)].join("\n");

  assert.doesNotMatch(combined, /localStorage|sessionStorage|indexedDB/i);
  assert.doesNotMatch(combined, /prisma|schema\.prisma|migration/i);
});

test("evaluation completion remains status-only and private", () => {
  const completion = read(COMPLETION);

  assert.match(completion, /finalizedEvaluations/);
  assert.match(completion, /evaluatorAssignments/);
  assert.doesNotMatch(completion, /groupIValue|groupIIValue|recommendations|signature/);
});
