// CDW-LIVE-1 MANUAL-QA FIX-5 — Committee Report signing + Defense Records UX.
//
// Run: node --experimental-strip-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/verify-cdw-live-1-manual-qa-fix-5.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { DEFENSE_REALTIME_EVENT_NAMES } from "../src/lib/realtime/defense-realtime-events.ts";

const root = process.cwd();
const read = (relative) => readFileSync(resolve(root, relative), "utf8");

const PANEL = "src/components/defense-workspace/rap-signature-panel.tsx";
const REPORT_PANEL = "src/components/defense-workspace/committee-report-panel.tsx";
const DIALOG =
  "src/components/defense-workspace/committee-report-signature-dialog.tsx";
const SIGNATURE_PAD = "src/components/defense-workspace/e-signature-pad.tsx";
const ADMIN =
  "src/app/(portal)/admin/thesis/defense-records/[scheduleId]/page.tsx";

test("frozen faculty signing panel no longer maps the full signer roster", () => {
  const panel = read(PANEL);

  assert.doesNotMatch(panel, /signatures\.map/);
  assert.doesNotMatch(panel, /signer\.name/);
  assert.doesNotMatch(panel, /signer\.signedAt/);
  assert.doesNotMatch(panel, /roleLabel/);
  assert.match(panel, /signatureProgress\.signed/);
});

test("faculty signing panel does not render other signer timestamps or names", () => {
  const panel = read(PANEL);
  const reportPanel = read(REPORT_PANEL);

  assert.doesNotMatch(panel, /signatures: RapSignerStatus\[\]/);
  assert.doesNotMatch(reportPanel, /signatures=\{report\.signatures\}/);
  assert.doesNotMatch(panel, /Another signer/);
});

test("unsigned required signer sees Sign Committee Report", () => {
  const panel = read(PANEL);

  assert.match(panel, /Sign Committee Report/);
  assert.match(panel, /Your signature is required\./);
  assert.match(panel, /\{canSign && \(/);
  assert.doesNotMatch(panel, /Review & Sign/);
});

test("non-required viewer gets no signing control", () => {
  const panel = read(PANEL);

  assert.match(panel, /\{canSign && \(/);
  assert.doesNotMatch(panel, /signatures\.map/);
  assert.doesNotMatch(panel, /Sign \/ E-Sign/);
});

test("already-signed current user sees only their own signed state/timestamp", () => {
  const panel = read(PANEL);

  assert.match(panel, /You signed this Committee Report/);
  assert.match(panel, /mySignature\.signedAt/);
  assert.doesNotMatch(panel, /signatures\.map/);
});

test("finalized faculty copy uses Committee Report terminology, not RAP finalized", () => {
  const panel = read(PANEL);

  assert.match(panel, /Committee Report Complete/);
  assert.doesNotMatch(panel, /RAP finalized/);
});

test("Sign Committee Report opens a focused single-step dialog component", () => {
  assert.equal(existsSync(resolve(root, DIALOG)), true);
  const dialog = read(DIALOG);
  const panel = read(PANEL);

  assert.match(panel, /CommitteeReportSignatureDialog/);
  assert.match(dialog, /Sign Committee Report/);
  assert.match(dialog, /Draw your signature below\. Once confirmed, your signature cannot be changed\./);
  assert.match(dialog, /Cancel/);
  assert.match(dialog, /Confirm Signature/);
  assert.match(dialog, /DialogContent/);
  assert.doesNotMatch(dialog, /Review and Sign Committee Report/);
  assert.doesNotMatch(dialog, /Continue to Sign/);
  assert.doesNotMatch(dialog, /Add Your Signature/);
});

test("Committee Report signing is draw-only and uses shared ESignaturePad", () => {
  const dialog = read(DIALOG);
  const pad = read(SIGNATURE_PAD);

  assert.match(dialog, /ESignaturePad/);
  assert.match(dialog, /allowTyped=\{false\}/);
  assert.match(pad, /allowTyped = true/);
  assert.match(pad, /Signature ready for evaluation finalize\./);
});

test("shared signature pad helper copy is parameterizable for report signing", () => {
  const dialog = read(DIALOG);
  const pad = read(SIGNATURE_PAD);

  assert.match(pad, /readyText/);
  assert.match(pad, /requiredText/);
  assert.match(dialog, /Signature ready\./);
  assert.match(dialog, /Draw your signature before confirming\./);
});

test("opening and cancelling never sign; confirm is guarded", () => {
  const dialog = read(DIALOG);
  const panel = read(PANEL);

  assert.match(dialog, /confirmingRef/);
  assert.match(dialog, /if \(confirmingRef\.current/);
  assert.match(dialog, /onClick=\{close\}/);
  assert.match(dialog, /setSignature\(""\)/);
  assert.doesNotMatch(dialog, /setStep|step ===/);
  assert.match(panel, /onConfirm=\{/);
  assert.match(panel, /setSignDialogOpen\(false\)/);
  assert.doesNotMatch(panel, /onClick=\{\(\) => sign\.mutate\(\)\}/);
});

test("existing Committee Report sign endpoint and invalidation remain", () => {
  const panel = read(PANEL);

  assert.match(panel, /collaboration\/report\/sign/);
  assert.match(panel, /committeeReport/);
  assert.match(panel, /defenseWorkspace/);
  assert.match(panel, /conclusionReadiness/);
});

test("pre-finalization action and confirmation use Committee Report language", () => {
  const panel = read(PANEL);

  assert.match(panel, /Finalize Committee Report/);
  assert.match(panel, /Finalize Committee Report\?/);
  assert.match(panel, /Finalize Report/);
  assert.doesNotMatch(panel, /Freeze for Signatures/);
  assert.doesNotMatch(panel, /Confirm Freeze/);
  assert.doesNotMatch(panel, /freezeReadiness\.checks/);
});

test("Admin Evaluation Results uses operational columns and removes Overall/Criteria", () => {
  const admin = read(ADMIN);

  assert.match(admin, /Evaluation Status/);
  assert.match(admin, /Signature Status/);
  assert.match(admin, /Signed At/);
  assert.match(admin, /hasOfficialCriteria/);
  assert.match(admin, /formatSignedAt\(e\.signedAt\)/);
  assert.doesNotMatch(admin, /<th className="px-3 py-2">Overall<\/th>/);
  assert.doesNotMatch(admin, /<th className="px-3 py-2">Criteria<\/th>/);
});

test("Admin V2 Summary keeps Group A/B/Average and hides internal meta fields", () => {
  const admin = read(ADMIN);

  assert.match(admin, /isInstitutionalSummary \? "Group A" : "Group I"/);
  assert.match(admin, /isInstitutionalSummary \? "Group B" : "Group II"/);
  assert.match(admin, /isInstitutionalSummary \? "Average" : "Overall"/);
  assert.match(admin, /formatInstitutionalValue/);
  assert.match(admin, /!isInstitutionalSummary && \(/);
  assert.doesNotMatch(admin, /Internal Average/);
  // Legacy records may still show the historical meta fields, but only inside
  // the non-institutional branch.
  assert.match(admin, /!isInstitutionalSummary && \(\s*<div[\s\S]*Final Rating/);
});

test("Admin Committee Report keeps full signer audit and uses Committee Report wording", () => {
  const admin = read(ADMIN);

  assert.match(admin, />\s*Committee Report\s*</);
  assert.match(admin, /Signer/);
  assert.match(admin, /Signature Status/);
  assert.match(admin, /Signed At/);
  assert.match(admin, /required\s+signatures completed/);
  assert.doesNotMatch(admin, /RAP \/ Committee Report/);
  assert.doesNotMatch(admin, /RAP finalized/);
  assert.doesNotMatch(admin, /created after the formal conclusion/);
  assert.match(admin, /The Committee Report has not been prepared yet\./);
});

test("Admin official PDF actions are active; Committee Report stays deferred", () => {
  const admin = read(ADMIN);

  // FORM-INT-4 supersedes the earlier deferred-document placeholder.
  assert.match(admin, /records\/application\/pdf/);
  assert.match(admin, /records\/summary\/pdf/);
  assert.match(admin, /records\/evaluations\/pdf/);
  assert.doesNotMatch(admin, /criteria\/\$\{e\.panelAssignmentId\}\/pdf/);
  assert.match(admin, /e\.hasOfficialCriteria/);
  assert.match(admin, /!data\.oralExamSummary\.ready/);
  assert.match(admin, /Official Committee Report PDF is not available yet\./);
  // Still no browser-page printing or client-side PDF generation dependency.
  assert.doesNotMatch(admin, /window\.print\(\)/);
  assert.doesNotMatch(admin, /import .*jspdf|import .*pdf-lib/i);
});

test("no tenth realtime event was introduced", () => {
  assert.equal(DEFENSE_REALTIME_EVENT_NAMES.length, 9);
  assert.ok(
    !DEFENSE_REALTIME_EVENT_NAMES.some((name) => /committee|report.*sign/i.test(name) && name !== "report.ready_for_signature"),
  );
});
