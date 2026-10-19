// CDW-9E — Defense Workspace accessibility and responsive hardening.
//
// Run: node --test scripts/verify-cdw9e-accessibility.mjs
//
// Focused source-contract verifier. Manual keyboard/screen-reader/responsive
// QA is separate and is not claimed by this script.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const read = (relative) => readFileSync(resolve(root, relative), "utf8");

const WORKSPACE = "src/components/defense-workspace/workspace-shell.tsx";
const SIGNATURE_PAD = "src/components/defense-workspace/e-signature-pad.tsx";
const EVALUATION_DIALOG =
  "src/components/defense-workspace/evaluation-finalization-dialog.tsx";
const REPORT_SIGN_DIALOG =
  "src/components/defense-workspace/committee-report-signature-dialog.tsx";
const EVALUATION_FORM =
  "src/components/defense-workspace/oral-evaluation-form.tsx";
const REPORT_PANEL =
  "src/components/defense-workspace/committee-report-panel.tsx";
const COMMENTS_RAIL =
  "src/components/defense-workspace/shared-comments-rail.tsx";
const COMMENT_COMPOSER =
  "src/components/defense-workspace/annotation-comment-composer.tsx";
const ROLE_RAIL = "src/components/defense-workspace/role-rail.tsx";
const VERDICT_PANEL =
  "src/components/defense-workspace/chairman-verdict-panel.tsx";

test("mobile drawers isolate the background and trap/restore focus", () => {
  const source = read(WORKSPACE);

  assert.match(source, /inert=\{drawerOpen \? true : undefined\}/);
  assert.match(source, /aria-hidden=\{drawerOpen \? true : undefined\}/);
  assert.match(source, /role="dialog"/);
  assert.match(source, /aria-modal="true"/);
  assert.match(source, /aria-labelledby=\{titleId\}/);
  assert.match(source, /document\.addEventListener\("keydown", onKeyDown\)/);
  assert.match(source, /event\.key === "Escape"/);
  assert.match(source, /event\.key !== "Tab"/);
  assert.match(source, /previouslyFocused\?\.focus\(\)/);
  assert.match(source, /returnFocusRef\.current/);
  assert.match(source, /setOpenDrawer\("left"\)/);
  assert.match(source, /setOpenDrawer\("right"\)/);
  assert.match(source, /aria-label=\{`Close \$\{title\.toLowerCase\(\)\}`\}/);
});

test("center navigation uses tab semantics and keyboard activation", () => {
  const source = read(WORKSPACE);

  assert.match(source, /role="tablist"/);
  assert.match(source, /role="tab"/);
  assert.match(source, /aria-selected=\{selected\}/);
  assert.match(source, /aria-controls=\{controls\}/);
  assert.match(source, /tabIndex=\{selected \? 0 : -1\}/);
  assert.match(source, /role="tabpanel"/);
  assert.match(source, /aria-labelledby=\{`workspace-tab-\$\{tab\}`\}/);
  assert.match(source, /ArrowLeft/);
  assert.match(source, /ArrowRight/);
  assert.match(source, /Home/);
  assert.match(source, /End/);
  assert.match(source, /\(selected\)/);
});

test("finalization/signing dialogs keep focus and announce pending/errors", () => {
  for (const path of [EVALUATION_DIALOG, REPORT_SIGN_DIALOG]) {
    const source = read(path);
    assert.match(source, /aria-busy=/);
    assert.match(source, /role="status"/);
    assert.match(source, /aria-live="polite"/);
    assert.match(source, /role="alert"/);
    assert.match(source, /showCloseButton=\{!/);
    assert.match(source, /disabled=\{.*Pending\}/);
  }
  assert.match(read(EVALUATION_DIALOG), /allowTyped=\{false\}/);
  assert.match(read(REPORT_SIGN_DIALOG), /allowTyped=\{false\}/);
  assert.match(read(EVALUATION_DIALOG), /continueRef/);
  assert.match(read(EVALUATION_DIALOG), /warningRef/);
  assert.match(read(EVALUATION_DIALOG), /autoFocus/);
  assert.match(read(REPORT_SIGN_DIALOG), /autoFocus/);
});

test("draw-only signature pad is focusable and announces status without typed fallback", () => {
  const source = read(SIGNATURE_PAD);

  assert.match(source, /tabIndex=\{disabled \? -1 : 0\}/);
  assert.match(source, /aria-label="Signature drawing area"/);
  assert.match(source, /aria-describedby=\{`\$\{instructionsId\} \$\{statusId\}`\}/);
  assert.match(source, /role="status"/);
  assert.match(source, /aria-live="polite"/);
  assert.match(source, /not\s+keyboard-drawable/);
  assert.match(source, /allowTyped && mode === "type"/);
  assert.match(source, /focus-visible:ring-2/);
});

test("autosave, conflict, offline, and recovery states are programmatically perceivable", () => {
  for (const path of [EVALUATION_FORM, REPORT_PANEL]) {
    const source = read(path);
    assert.match(source, /role="status"/);
    assert.match(source, /aria-live="polite"/);
    assert.match(source, /role="alert"/);
  }
  assert.match(read(REPORT_PANEL), /Reload saved version/);
  assert.match(read(EVALUATION_FORM), /Reload latest saved evaluation/);
});

test("comment composer associates validation errors and keeps keyboard submission", () => {
  const source = read(COMMENT_COMPOSER);

  assert.match(source, /aria-invalid=/);
  assert.match(source, /aria-describedby=/);
  assert.match(source, /role="alert"/);
  assert.match(source, /characters/);
  assert.match(source, /event\.key === "Enter"/);
  assert.match(source, /event\.metaKey \|\| event\.ctrlKey/);
});

test("comment rail exposes loading/error and keyboard-visible list selection", () => {
  const source = read(COMMENTS_RAIL);

  assert.match(source, /role="status"/);
  assert.match(source, /role="alert"/);
  assert.match(source, /aria-pressed=\{isActive\}/);
  assert.match(source, /focus-visible:ring-2/);
  assert.match(source, /onRetry/);
});

test("role rail and verdict errors are announced and disclosures stay keyboard-visible", () => {
  const role = read(ROLE_RAIL);
  assert.match(role, /role="alert"/);
  assert.match(role, /focus-visible:ring-2/);
  assert.match(role, /<details/);
  assert.match(role, /<summary/);

  const verdict = read(VERDICT_PANEL);
  assert.match(verdict, /role="alert"/);
});

test("drawer and center layouts retain narrow-screen containment", () => {
  const source = read(WORKSPACE);
  assert.match(source, /max-w-\[88vw\]/);
  assert.match(source, /min-w-0/);
  assert.match(source, /overflow-x-hidden/);
  assert.match(source, /motion-reduce:animate-none/);
  assert.match(source, /min-w-0 flex-1 flex-col/);
});
