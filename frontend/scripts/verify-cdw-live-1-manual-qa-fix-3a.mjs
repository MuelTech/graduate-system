// CDW-LIVE-1 MANUAL-QA FIX-3A — readiness wording + printed-name cleanup.
//
// Run: node --experimental-strip-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/verify-cdw-live-1-manual-qa-fix-3a.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  queryTargetsForDefenseRealtimeEvent,
} from "../src/lib/realtime/defense-realtime-events.ts";

const root = process.cwd();
const read = (relative) => readFileSync(resolve(root, relative), "utf8");

const DIALOG =
  "src/components/defense-workspace/evaluation-finalization-dialog.tsx";
const FORM = "src/components/defense-workspace/oral-evaluation-form.tsx";
const VERDICT = "src/components/defense-workspace/chairman-verdict-panel.tsx";
const RAIL = "src/components/defense-workspace/role-rail.tsx";
const TYPE = "src/types/defense-workspace.ts";
const BACKEND = "../backend/src/services/defense-workspace.service.ts";
const DESIGN =
  "../docs/superpowers/cdw-live-1/cdw-live-1-manual-qa-fix-3-signature-verdict-roster-ux-design.md";

const base = {
  eventName: null,
  eventId: "evt-1",
  scheduleId: "sched-1",
  occurredAt: "2026-10-18T00:00:00.000Z",
};

function event(name, extra = {}) {
  return { ...base, eventName: name, ...extra };
}

test("Committee Report Signatures still exists with Waiting for report", () => {
  const verdict = read(VERDICT);

  assert.match(verdict, /Committee Report Signatures/);
  assert.match(verdict, /"Waiting for report"/);
});

test("old Pending readiness copy and 0 of 0 are absent", () => {
  const verdict = read(VERDICT);

  assert.doesNotMatch(verdict, /"Pending"/);
  assert.doesNotMatch(verdict, /0 of 0 completed/);
});

test("report signature progress still shows signed of required once slots exist", () => {
  const verdict = read(VERDICT);

  assert.match(
    verdict,
    /\$\{data\.signedSignatures\} of \$\{data\.requiredSignatures\} completed/,
  );
  assert.match(verdict, /requiredSignatures <= 0/);
});

test("verdict controls remain gated by server readyForConclusion", () => {
  const verdict = read(VERDICT);

  assert.match(verdict, /data\.readyForConclusion &&/);
  assert.match(verdict, /Record Formal Verdict/);
  assert.match(verdict, /Confirm Verdict/);
});

test("evaluation.finalized still invalidates conclusionReadiness", () => {
  const targets = queryTargetsForDefenseRealtimeEvent(
    event("evaluation.finalized"),
  );
  assert.ok(targets.some((target) => target.target === "conclusionReadiness"));
});

test("rap.signature.recorded still invalidates conclusionReadiness", () => {
  const targets = queryTargetsForDefenseRealtimeEvent(
    event("rap.signature.recorded", {
      reportId: "rap-1",
      contentVersion: 1,
    }),
  );
  assert.ok(targets.some((target) => target.target === "conclusionReadiness"));
});

test("rap.finalized still invalidates conclusionReadiness", () => {
  const targets = queryTargetsForDefenseRealtimeEvent(
    event("rap.finalized", { reportId: "rap-1", contentVersion: 1 }),
  );
  assert.ok(targets.some((target) => target.target === "conclusionReadiness"));
});

test("individual evaluation signing remains Draw-only", () => {
  const dialog = read(DIALOG);

  assert.match(dialog, /allowTyped=\{false\}/);
  assert.doesNotMatch(dialog, /Printed name:|supplied automatically/);
});

test("printed-name explanatory and label copy are removed", () => {
  const dialog = read(DIALOG);

  assert.doesNotMatch(dialog, /Your printed name/);
  assert.doesNotMatch(dialog, /Printed name:/);
});

test("no manual evaluator-name input exists", () => {
  const dialog = read(DIALOG);
  const form = read(FORM);

  assert.doesNotMatch(dialog, /<input|typedName|nameInput/);
  assert.doesNotMatch(form, /printedName|evaluatorName/);
});

test("evaluator-name plumbing was removed from type, rail, and backend read model", () => {
  const type = read(TYPE);
  const rail = read(RAIL);
  const backend = read(BACKEND);

  assert.match(
    type,
    /myAssignment: \{\s*panelAssignmentId: string;\s*role: WorkspaceRole;\s*\};/,
  );
  assert.doesNotMatch(rail, /evaluatorName|myAssignment\.name/);
  assert.doesNotMatch(backend, /myPrintedName|name: myPrintedName/);
});

test("flushAndWait remains before finalize and Back/Cancel clear signature", () => {
  const form = read(FORM);
  const dialog = read(DIALOG);
  const flush = form.indexOf("controller.flushAndWait()");
  const finalize = form.indexOf("evaluation/finalize");

  assert.ok(flush >= 0);
  assert.ok(finalize > flush);
  assert.match(dialog, /setSignature\(""\)/);
  assert.match(dialog, /setStep\("review"\)/);
});

test("no schema/migration and FIX-3 remains accepted for its bounded scope", () => {
  const combined = [read(DIALOG), read(FORM), read(VERDICT), read(RAIL)].join(
    "\n",
  );
  assert.doesNotMatch(combined, /prisma|schema\.prisma|migration/i);
  assert.match(read(DESIGN), /INDEPENDENT SOURCE REVIEW PASS/);
  assert.match(read(DESIGN), /BOUNDED PRODUCT REVIEW ACCEPTED/);
});
