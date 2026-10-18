// CDW-LIVE-1 MANUAL-QA FIX-3 — signature, verdict, and roster UX.
//
// Run: node --experimental-strip-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/verify-cdw-live-1-manual-qa-fix-3.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const read = (relative) => readFileSync(resolve(root, relative), "utf8");

const DIALOG =
  "src/components/defense-workspace/evaluation-finalization-dialog.tsx";
const SIGNATURE = "src/components/defense-workspace/e-signature-pad.tsx";
const FORM = "src/components/defense-workspace/oral-evaluation-form.tsx";
const VERDICT = "src/components/defense-workspace/chairman-verdict-panel.tsx";
const RAIL = "src/components/defense-workspace/role-rail.tsx";
const WORKSPACE_TYPE = "src/types/defense-workspace.ts";
const RAP_PANEL = "src/components/defense-workspace/rap-signature-panel.tsx";

const BACKEND_WORKSPACE =
  "../backend/src/services/defense-workspace.service.ts";
const DESIGN =
  "../docs/superpowers/cdw-live-1/cdw-live-1-manual-qa-fix-3-signature-verdict-roster-ux-design.md";

test("individual evaluation signing is draw-only", () => {
  const dialog = read(DIALOG);
  const signature = read(SIGNATURE);

  assert.match(dialog, /allowTyped=\{false\}/);
  assert.match(signature, /allowTyped = true/);
  assert.match(signature, /allowTyped \? "type" : "draw"/);
});

test("Type and typed-name input are absent from evaluation finalization", () => {
  const dialog = read(DIALOG);

  assert.doesNotMatch(dialog, />\s*Type\s*</);
  assert.doesNotMatch(dialog, /<input|placeholder="Type your full name"/);
  assert.doesNotMatch(dialog, /typedName|printedName\s*:\s*string.*onChange/);
});

test("printed evaluator identity is not re-entered in the signing UI", () => {
  const backend = read(BACKEND_WORKSPACE);
  const type = read(WORKSPACE_TYPE);
  const rail = read(RAIL);
  const form = read(FORM);
  const dialog = read(DIALOG);

  assert.doesNotMatch(dialog, /Printed name:|supplied automatically/);
  assert.doesNotMatch(form, /evaluatorName|printedName/);
  assert.doesNotMatch(rail, /myAssignment\.name/);
  assert.match(
    type,
    /myAssignment: \{\s*panelAssignmentId: string;\s*role: WorkspaceRole;\s*\};/,
  );
  assert.doesNotMatch(backend, /myPrintedName|name: myPrintedName/);
});

test("no manual printed-name field exists", () => {
  const dialog = read(DIALOG);
  const form = read(FORM);

  assert.doesNotMatch(dialog, /Printed name\s*:<\/label>|<input/);
  assert.doesNotMatch(form, /printedName.*onChange|nameInput/);
});

test("shared signature pad still supports Type for unrelated flows", () => {
  const signature = read(SIGNATURE);
  const rap = read(RAP_PANEL);

  assert.match(signature, /\{allowTyped && \(/);
  assert.match(signature, />\s*Type\s*</);
  assert.match(rap, /<ESignaturePad/);
  assert.doesNotMatch(rap, /allowTyped=\{false\}/);
});

test("evaluation Draw still emits PNG evidence and Clear remains", () => {
  const signature = read(SIGNATURE);

  assert.match(signature, /canvas\.toDataURL\("image\/png"\)/);
  assert.match(signature, /data:image\/png;base64/);
  assert.match(signature, /onClick=\{clear\}/);
  assert.match(signature, /Draw your signature/);
});

test("Back/Cancel/close clears abandoned evaluation signature state", () => {
  const dialog = read(DIALOG);

  assert.match(dialog, /setSignature\(""\)/);
  assert.match(dialog, /setStep\("review"\)/);
  assert.match(dialog, /onClick=\{close\}/);
});

test("flushAndWait still precedes the finalize endpoint", () => {
  const form = read(FORM);
  const flush = form.indexOf("controller.flushAndWait()");
  const finalize = form.indexOf("evaluation/finalize");

  assert.ok(flush >= 0);
  assert.ok(finalize > flush);
  assert.match(form, /if \(!settled\)/);
});

test("Formal Verdict exposes only the two faculty-facing readiness rows", () => {
  const verdict = read(VERDICT);
  const ui = verdict.replace(/\/\*[\s\S]*?\*\//g, "");

  assert.match(ui, /Evaluation Signatures/);
  assert.match(ui, /Committee Report Signatures/);
  assert.doesNotMatch(ui, /Oral Examination Summary ready/);
  assert.doesNotMatch(ui, /Committee Report frozen/);
  assert.doesNotMatch(ui, /RAP finalized/);
  assert.doesNotMatch(ui, /Unavailable until the Committee Report is finalized/);
});

test("evaluation signature progress maps to finalized/assigned counts", () => {
  const verdict = read(VERDICT);

  assert.match(
    verdict,
    /\$\{data\.finalizedEvaluations\} of \$\{data\.evaluatorAssignments\} completed/,
  );
  assert.match(verdict, /data\.allEvaluationsFinalized/);
});

test("report signature progress maps to signed/required or Waiting for report", () => {
  const verdict = read(VERDICT);

  assert.match(verdict, /requiredSignatures <= 0/);
  assert.match(verdict, /"Waiting for report"/);
  assert.doesNotMatch(verdict, /"Pending"/);
  assert.match(
    verdict,
    /\$\{data\.signedSignatures\} of \$\{data\.requiredSignatures\} completed/,
  );
  assert.match(verdict, /data\.allSignaturesSigned/);
  assert.doesNotMatch(verdict, /0 of 0/);
});

test("verdict controls remain gated by server readyForConclusion", () => {
  const verdict = read(VERDICT);

  assert.match(verdict, /data\.readyForConclusion &&/);
  assert.match(verdict, /<option value="PASSED">PASSED<\/option>/);
  assert.match(verdict, /<option value="REDEFENSE_REQUIRED">/);
  assert.match(verdict, /Record Formal Verdict/);
  assert.match(verdict, /Confirm Verdict/);
});

test("backend conclusion/readiness fields were not removed", () => {
  const verdict = read(VERDICT);

  for (const field of [
    "allEvaluationsFinalized",
    "oralSummaryExists",
    "reportFrozen",
    "requiredSignatures",
    "signedSignatures",
    "allSignaturesSigned",
    "reportFinalized",
    "readyForConclusion",
  ]) {
    assert.match(verdict, new RegExp(field));
  }
});

test("Committee Roster keeps native details/summary and adds a chevron", () => {
  const rail = read(RAIL);

  assert.match(rail, /<details className="group">/);
  assert.match(rail, /<summary/);
  assert.match(rail, /ChevronDown/);
  assert.match(rail, /group-open:rotate-180/);
  assert.match(rail, /motion-reduce:transition-none/);
  assert.match(rail, /aria-hidden="true"/);
});

test("FIX-2 dialog flow and normal-flow rail actions remain intact", () => {
  const form = read(FORM);
  const dialog = read(DIALOG);
  const rail = read(RAIL);

  assert.match(dialog, /Review Evaluation/);
  assert.match(dialog, /Continue to Sign/);
  assert.match(dialog, /Back/);
  assert.match(dialog, /Confirm Finalize/);
  assert.doesNotMatch(form, /Save now/);
  assert.doesNotMatch(form, /sticky bottom-0/);
  assert.match(form, /<EvaluationFinalizationDialog/);
  assert.match(rail, /\[&>\*\]:shrink-0/);
});

test("no evaluation-draft realtime or signature persistence was introduced", () => {
  const combined = [read(DIALOG), read(SIGNATURE), read(FORM), read(VERDICT)].join(
    "\n",
  );

  assert.doesNotMatch(combined, /socket\.io|createDefenseSocket|useDefenseRealtime/i);
  assert.doesNotMatch(combined, /evaluation\.(draft|preview|typing|score)/i);
  assert.doesNotMatch(combined, /localStorage|sessionStorage|indexedDB/i);
});

test("no schema or migration work belongs to this package", () => {
  const combined = [
    read(DIALOG),
    read(SIGNATURE),
    read(FORM),
    read(VERDICT),
    read(RAIL),
  ].join("\n");

  assert.doesNotMatch(combined, /prisma|schema\.prisma|migration/i);
  assert.match(read(DESIGN), /INDEPENDENT SOURCE REVIEW PASS/);
  assert.match(read(DESIGN), /BOUNDED PRODUCT REVIEW ACCEPTED/);
});
