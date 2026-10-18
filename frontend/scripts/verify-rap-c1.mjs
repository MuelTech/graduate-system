// RAP-C1 — freeze + required signatures + Chairman verdict gating (frontend).
//
// Static source contracts over the in-system Rapporteur freeze/signing UX and the
// Chairman verdict readiness UI. Framework-free: it asserts the components wire
// the authoritative server capabilities and never expose sensitive signature
// material or an external authoring-upload path.
//
// Run: node --experimental-strip-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/verify-rap-c1.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const read = (relative) => readFileSync(resolve(root, relative), "utf8");
const exists = (relative) => existsSync(resolve(root, relative));
/** Strip comments so documentation prose can never satisfy a code contract. */
const code = (relative) =>
  read(relative)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

const PANEL = "src/components/defense-workspace/committee-report-panel.tsx";
const RAP_PANEL = "src/components/defense-workspace/rap-signature-panel.tsx";
const RAP_DIALOG =
  "src/components/defense-workspace/committee-report-signature-dialog.tsx";
const VERDICT = "src/components/defense-workspace/chairman-verdict-panel.tsx";
const RAIL = "src/components/defense-workspace/role-rail.tsx";
const COLLAB = "src/lib/pdf-annotation/collaboration-client.ts";
const SIGNATURE_PAD = "src/components/defense-workspace/e-signature-pad.tsx";

test("RAP-C1 components exist", () => {
  for (const file of [
    RAP_PANEL,
    RAP_DIALOG,
    VERDICT,
    PANEL,
    RAIL,
    COLLAB,
    SIGNATURE_PAD,
  ]) {
    assert.equal(exists(file), true, `${file} should exist`);
  }
});

test("the report read model mirrors the RAP-C1 freeze/signature contract", () => {
  const p = read(PANEL);
  for (const field of [
    "canFreeze",
    "freezeReadiness",
    "signatures",
    "signatureProgress",
    "mySignature",
    "canSign",
  ]) {
    assert.match(p, new RegExp(field), `${field} expected in the read model`);
  }
});

test("the assigned Rapporteur gets the Committee Report readiness checklist", () => {
  const rap = read(RAP_PANEL);
  assert.match(rap, /Committee Report readiness/);
  assert.match(rap, /freezeReadiness\.checks/);
  // Freeze is capability-gated, never an unconditional button.
  assert.match(rap, /canFreeze/);
});

test("freeze is a non-casual, explicit two-step confirmation", () => {
  const rap = read(RAP_PANEL);
  assert.match(rap, /confirmingFreeze/);
  assert.match(rap, /Freeze this report for signatures\?/);
  assert.match(rap, /becomes read-only/i);
  assert.match(rap, /comments become read-only/i);
  assert.match(rap, /sign this exact frozen version/i);
  assert.match(rap, /Freeze for Signatures/);
});

test("freeze and sign call the collaboration report endpoints", () => {
  const rap = read(RAP_PANEL);
  assert.match(rap, /collaboration\/report\/freeze/);
  assert.match(rap, /collaboration\/report\/sign/);
  assert.match(rap, /method:\s*"POST"/);
});

test("signing is own-slot gated and uses the focused draw-only dialog", () => {
  const rap = read(RAP_PANEL);
  const dialog = read(RAP_DIALOG);
  assert.match(rap, /canSign/);
  assert.match(rap, /CommitteeReportSignatureDialog/);
  assert.match(dialog, /ESignaturePad/);
  assert.match(dialog, /allowTyped=\{false\}/);
  assert.match(dialog, /data:image\/png;base64/);
  assert.match(dialog, /Confirm Signature/);
});

test("aggregate signature progress remains visible without a cross-signer roster", () => {
  const rap = code(RAP_PANEL);
  assert.match(rap, /required\s+signatures completed/);
  assert.match(rap, /signatureProgress\.signed/);
  assert.match(rap, /signatureProgress\.required/);
  assert.match(rap, /You signed this report/);
  assert.doesNotMatch(rap, /signatures\.map/);
  assert.doesNotMatch(rap, /signer\.name|signer\.signedAt/);
  // No raw signature evidence is exposed by the faculty surface.
  assert.doesNotMatch(rap, /signer\.signatureData|mySignature\.signatureData/);
  assert.doesNotMatch(rap, /<img[^>]*signature/i);
  assert.doesNotMatch(rap, /base64/);
});

test("the report body becomes read-only once frozen", () => {
  const p = read(PANEL);
  assert.match(p, /REPORT_FROZEN_STATUSES/);
  assert.match(p, /FOR_SIGNATURE/);
  assert.match(p, /FINALIZED/);
  // Authoring panel is only rendered for canEditBody.
  assert.match(p, /data\.canEditBody \?/);
});

test("freeze makes manuscript comments/annotations read-only on the client", () => {
  const collab = read(COLLAB);
  assert.match(collab, /FROZEN_RAP_STATUSES/);
  for (const status of ["FOR_SIGNATURE", "PARTIALLY_SIGNED", "FINALIZED"]) {
    assert.match(collab, new RegExp(status));
  }
  assert.match(collab, /isCollaborationActive/);
});

test("the Chairman verdict is gated by RAP finalization readiness", () => {
  const v = read(VERDICT);
  assert.match(v, /conclusion-readiness/);
  assert.match(v, /readyForConclusion/);
  assert.match(v, /reportFinalized/);
  assert.match(v, /allSignaturesSigned/);
  assert.doesNotMatch(v, /Unavailable until the Committee Report is finalized/);
  assert.match(v, /Record Formal Verdict/);
  // Only the two canonical new verdicts are offered.
  assert.match(v, /value="PASSED"/);
  assert.match(v, /value="REDEFENSE_REQUIRED"/);
  assert.doesNotMatch(v, /value="FAILED"|value="REVISION/);
  // No score-derived verdict: the panel never reads an average.
  assert.doesNotMatch(v, /overallAverage|finalRating/);
});

test("the Chairman verdict panel is surfaced in the role rail", () => {
  const rail = read(RAIL);
  assert.match(rail, /ChairmanVerdictPanel/);
});

test("no word/docx/pdf authoring-upload fallback exists in the report flow", () => {
  const combined = code(PANEL) + code(RAP_PANEL) + code(VERDICT) + code(RAIL);
  assert.doesNotMatch(combined, /Upload from Word|Upload completed report|Import DOCX|Use external report|mammoth|\.docx/i);
  assert.doesNotMatch(combined, /sourceType|UPLOADED_FILE/);
});

test("no official-form / PDF / print scope creep", () => {
  const combined = code(PANEL) + code(RAP_PANEL) + code(VERDICT);
  assert.doesNotMatch(combined, /jsPDF|@react-pdf|html2canvas|window\.print|@media\s+print/i);
  assert.doesNotMatch(combined, /GS Form No\. 22|GS-022|Official Form Renderer/i);
});
