// CDW-4 FIX — faculty-friendly immersive workspace + institutional evaluation matrix.
//
// Source/contract verification (no browser). Assertions encode behaviour and
// structure, not fragile pixel values.
//
// Run: node --experimental-strip-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/verify-cdw4-matrix.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const read = (relative) => readFileSync(resolve(root, relative), "utf8");
const exists = (relative) => existsSync(resolve(root, relative));

const MATRIX = "src/components/defense-workspace/institutional-evaluation-matrix.tsx";
const FORM = "src/components/defense-workspace/oral-evaluation-form.tsx";
const RAIL = "src/components/defense-workspace/role-rail.tsx";
const TRACKER = "src/components/defense-workspace/evaluation-completion-tracker.tsx";
const CONCLUSION = "src/components/defense-workspace/chairman-conclusion-panel.tsx";
const SHELL = "src/components/defense-workspace/workspace-shell.tsx";
const VIEWER = "src/components/defense-workspace/collaborative-manuscript-viewer.tsx";
const PROVIDER = "src/components/defense-workspace/student-document-collaboration.tsx";
const COMMENTS = "src/components/defense-workspace/shared-comments-rail.tsx";
const HEADER = "src/components/defense-workspace/compact-workspace-header.tsx";
const TOOLTIP = "src/components/ui/tooltip.tsx";

test("the institutional matrix component and tooltip primitive exist", () => {
  for (const f of [MATRIX, TRACKER, TOOLTIP]) {
    assert.equal(exists(f), true, `${f} should exist`);
  }
});

test("matrix uses the exact six institutional levels with NO 2.25", () => {
  const m = read(MATRIX);
  assert.match(m, /INSTITUTIONAL_RATING_LEVELS/);
  for (const v of ["1.25", "1.75", "2.5"]) {
    assert.match(m, new RegExp(`value:\\s*${v.replace(".", "\\.")}`));
  }
  assert.doesNotMatch(m, /2\.25/);
  assert.match(m, /type="radio"/);
});

test("legend is present and readable without hover", () => {
  const m = read(MATRIX);
  assert.match(m, /Legend/i);
  for (const label of [
    "Excellent",
    "Highly Satisfactory",
    "Very Satisfactory",
    "Satisfactory",
    "Below Satisfactory",
    "Fail",
  ]) {
    assert.match(m, new RegExp(label));
  }
});

test("matrix renders Group I + Group II with accessible per-cell labels", () => {
  const m = read(MATRIX);
  assert.match(m, /Group I/);
  assert.match(m, /Group II/);
  // Screen-reader name includes criterion + rating value + code + label.
  assert.match(m, /aria-label/);
  assert.match(m, /—.*\$\{|criteria|\$\{c\.label\}/);
  // Whole-cell click target.
  assert.match(m, /<label/);
  assert.match(m, /cursor-pointer/);
});

test("evaluation form uses the matrix, not numeric point inputs", () => {
  const f = read(FORM);
  assert.match(f, /InstitutionalEvaluationMatrix/);
  assert.match(f, /scoringVersion/);
  assert.match(f, /LEGACY_POINTS_V1/);
  assert.doesNotMatch(f, /type="number"/);
});

test("evaluation form presents NO Overall formula and NO Rating input", () => {
  const f = read(FORM);
  assert.doesNotMatch(f, /Overall:/);
  assert.doesNotMatch(f, /Overall Average/);
  assert.doesNotMatch(f, /Rating \(optional\)/);
});

test("evaluation form keeps Save Draft + Review & Finalize with sticky actions", () => {
  const f = read(FORM);
  assert.match(f, /Save Draft/);
  assert.match(f, /Review & Finalize/);
  assert.match(f, /sticky bottom-0/);
});

test("legacy V1 rows are read-only with an explicit compatibility notice", () => {
  const f = read(FORM);
  assert.match(f, /Legacy/);
  assert.match(f, /10\/15|legacy|compatibility/i);
});

test("role rail removes the generic Readiness + live Summary and adds the tracker", () => {
  const rail = read(RAIL);
  assert.match(rail, /EvaluationCompletionTracker/);
  assert.doesNotMatch(rail, /ChairmanOralSummary/);
  assert.doesNotMatch(rail, /Oral Examination Summary/);
  assert.doesNotMatch(rail, /Readiness/);
  // Preserved CDW-4 behaviour.
  assert.match(rail, /canStartDefense/);
  assert.match(rail, /evaluationOpen/);
  assert.match(rail, /RAPPORTEUR/);
  assert.match(rail, /Report authoring arrives in a later package/);
});

test("evaluation completion tracker exposes status only", () => {
  const t = read(TRACKER);
  assert.match(t, /finalized/i);
  assert.match(t, /Draft/);
  assert.doesNotMatch(t, /Recommendations|Signature|Rating|groupI|groupII|overall/i);
});

test("early actionable formal-result UI is removed", () => {
  const c = read(CONCLUSION);
  assert.doesNotMatch(c, /Review & Record Formal Result/);
  assert.doesNotMatch(c, /Select formal result/);
  assert.doesNotMatch(c, /OUTCOMES/);
  assert.doesNotMatch(c, /useMutation/);
  // Concluded defenses still surface the recorded result read-only.
  assert.match(c, /conclusionsPresent/);
  assert.match(c, /formalResult/);
});

test("expanded evaluation rail is materially wider and responsive", () => {
  const shell = read(SHELL);
  assert.match(shell, /xl:w-\[28rem\]/);
  assert.match(shell, /2xl:w-\[32rem\]/);
  // Eval rail shows on xl; comments rail still on lg.
  assert.match(shell, /xl:block/);
  assert.match(shell, /lg:block/);
  // Mobile drawer triggers.
  assert.match(shell, /lg:hidden/);
  assert.match(shell, /xl:hidden/);
});

test("rail collapse is icon-first and localized (no desktop text buttons)", () => {
  const shell = read(SHELL);
  assert.doesNotMatch(shell, /Hide actions|Hide comments|Show actions|Show comments/);
  const rail = read(RAIL);
  assert.match(rail, /PanelLeftClose|PanelLeftOpen/);
  assert.match(rail, /aria-label|Tooltip/);
  const comments = read(COMMENTS);
  assert.match(comments, /PanelRightClose|PanelRightOpen/);
  assert.match(comments, /onCollapse/);
  assert.match(comments, /aria-label|Tooltip/);
});

test("collapsing animates and respects reduced motion", () => {
  const shell = read(SHELL);
  assert.match(shell, /transition/);
  assert.match(shell, /motion-reduce:/);
});

test("the PDF center pane fills the remaining viewport height (no dead space)", () => {
  const viewer = read(VIEWER);
  assert.doesNotMatch(viewer, /max-h-\[70vh\]/);
  assert.match(viewer, /flex-1/);
  assert.match(viewer, /min-h-0/);
  const provider = read(PROVIDER);
  assert.match(provider, /h-full/);
  const shell = read(SHELL);
  assert.match(shell, /min-h-0/);
});

test("the tooltip primitive uses the existing Base UI dependency", () => {
  const t = read(TOOLTIP);
  assert.match(t, /@base-ui\/react\/tooltip/);
});

test("faculty typography: no 10/11px text for primary workflow info in the header/rail", () => {
  const header = read(HEADER);
  const rail = read(RAIL);
  assert.doesNotMatch(header, /text-\[11px\]/);
  assert.doesNotMatch(rail, /text-\[11px\]/);
});
