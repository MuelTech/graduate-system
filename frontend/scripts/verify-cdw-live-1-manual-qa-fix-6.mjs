// CDW-LIVE-1 MANUAL-QA FIX-6 — parallel Committee Report signing + faculty UI language.
//
// Run: node --experimental-strip-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/verify-cdw-live-1-manual-qa-fix-6.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { DEFENSE_REALTIME_EVENT_NAMES } from "../src/lib/realtime/defense-realtime-events.ts";

const root = process.cwd();
const read = (relative) => readFileSync(resolve(root, relative), "utf8");
/** Strip comments so documentation prose cannot satisfy a UI contract. */
const code = (relative) =>
  read(relative)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

const REPORT_PANEL = "src/components/defense-workspace/committee-report-panel.tsx";
const SIGNATURE_PANEL = "src/components/defense-workspace/rap-signature-panel.tsx";
const SIGNATURE_DIALOG =
  "src/components/defense-workspace/committee-report-signature-dialog.tsx";
const VERDICT_PANEL = "src/components/defense-workspace/chairman-verdict-panel.tsx";
const ROLE_RAIL = "src/components/defense-workspace/role-rail.tsx";
const SECONDARY_SIGNATURES = "src/app/(portal)/panelist/signatures/page.tsx";
const COLLABORATION_SERVICE = "../backend/src/services/defense-collaboration.service.ts";
const CONCLUSION_SERVICE = "../backend/src/services/defense-conclusion.service.ts";

const facultyCode = () =>
  [
    code(REPORT_PANEL),
    code(SIGNATURE_PANEL),
    code(SIGNATURE_DIALOG),
    code(VERDICT_PANEL),
    code(ROLE_RAIL),
  ].join("\n");

test("Rapporteur authoring no longer renders an evaluator/Summary readiness checklist", () => {
  const panel = code(SIGNATURE_PANEL);

  assert.doesNotMatch(panel, /Committee Report readiness/);
  assert.doesNotMatch(panel, /freezeReadiness/);
  assert.doesNotMatch(panel, /evaluation:\$\{/);
  assert.doesNotMatch(panel, /Oral Examination Summary/);
});

test("Rapporteur uses the approved report-finalization action and confirmation copy", () => {
  const panel = code(SIGNATURE_PANEL);

  assert.match(panel, /Finalize Committee Report/);
  assert.match(panel, /Finalize Committee Report\?/);
  assert.match(
    panel,
    /Once finalized, the report can no longer be edited\.\s+Required committee\s+members can review and sign it immediately\./,
  );
  assert.match(
    panel,
    /Evaluations can be completed separately before the Chairman records the\s+formal verdict\./,
  );
  assert.match(panel, /Finalize Report/);
  assert.match(panel, /Finalizing…/);
  assert.match(panel, /The Committee Report could not be finalized\. Please try again\./);
  assert.match(panel, /Cancel/);
});

test("faculty UI no longer exposes freeze/version/snapshot implementation jargon", () => {
  const combined = facultyCode();

  for (const forbidden of [
    "Freeze for Signatures",
    "Freeze this report for signatures?",
    "Confirm Freeze",
    "Freezing…",
    "Frozen version",
    "frozen report",
    "frozen snapshot",
    "contentVersion",
    "V1",
    "version 1",
    "snapshot",
    "hash",
  ]) {
    assert.doesNotMatch(combined, new RegExp(forbidden.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
  }
});

test("finalized report states use approved faculty language", () => {
  const panel = code(SIGNATURE_PANEL);

  assert.match(panel, /Ready for Signatures/);
  assert.match(panel, /Awaiting Signatures/);
  assert.match(panel, /Committee Report Complete/);
  assert.match(panel, /signatures completed/);
  assert.match(panel, /Your signature is required\. Review the finalized report before signing\./);
  assert.match(panel, /Review & Sign/);
  assert.match(panel, /Signed/);
  assert.match(panel, /You signed this Committee Report on/);
});

test("Review & Sign dialog uses the approved Step 1 and Step 2 copy", () => {
  const dialog = code(SIGNATURE_DIALOG);

  assert.match(dialog, /Review and Sign Committee Report/);
  assert.match(
    dialog,
    /Please review the finalized Committee Report before signing\.\s+Your\s+signature will be recorded for this report and cannot be changed\s+after confirmation\./,
  );
  assert.match(dialog, /Nothing is signed until you confirm your signature in the next step\./);
  assert.match(dialog, /Continue to Sign/);
  assert.match(dialog, /Add Your Signature/);
  assert.match(dialog, /Draw your signature below, then confirm to sign the Committee Report\./);
  assert.match(dialog, /Confirm Signature/);
  assert.match(dialog, /Signing…/);
  assert.match(dialog, /allowTyped=\{false\}/);
  assert.match(dialog, /ESignaturePad/);
});

test("the dialog never displays an internal report version", () => {
  const dialog = code(SIGNATURE_DIALOG);

  assert.doesNotMatch(dialog, /contentVersion/);
  assert.doesNotMatch(dialog, /version \$\{/);
});

test("Formal Verdict uses concise faculty progress and keeps the strict server gate", () => {
  const verdict = code(VERDICT_PANEL);

  assert.match(verdict, /label: "Evaluations"/);
  assert.match(verdict, /finalized`/);
  assert.match(verdict, /Committee Report Signatures/);
  assert.match(verdict, /Waiting for finalized report/);
  assert.match(verdict, /readyForConclusion/);
  assert.match(verdict, /Record Formal Verdict/);
  assert.doesNotMatch(verdict, /Oral Examination Summary ready/);
  assert.doesNotMatch(verdict, /Committee Report frozen/);
  assert.doesNotMatch(verdict, /RAP finalized/);
  assert.doesNotMatch(verdict, /contentVersion/);
});

test("Rapporteur rail copy uses Finalize Committee Report, not freeze terminology", () => {
  const rail = code(ROLE_RAIL);

  assert.match(rail, /Finalize\s+Committee Report/);
  assert.doesNotMatch(rail, /Freeze for Signatures/);
});

test("secondary E-Signatures page uses Committee Report terminology", () => {
  const page = read(SECONDARY_SIGNATURES);

  assert.match(page, /pending Committee Report signatures/);
  assert.match(page, /No pending Committee Report signatures\./);
  assert.match(page, /Committee Report/);
  assert.match(page, /official Committee Report/);
  assert.match(page, /No signed Committee Report slots loaded/);
  assert.doesNotMatch(page, /RAP Report/);
  assert.doesNotMatch(page, /pending RAP signatures/i);
  assert.doesNotMatch(page, /official RAP record/i);
});

test("Committee Report finalization no longer ensures the Oral Examination Summary", () => {
  const service = code(COLLABORATION_SERVICE);
  const freezeStart = service.indexOf("async freezeReportForSignatures");
  const freezeEnd = service.indexOf("async signReportForSignatures", freezeStart);
  const freezeBody = service.slice(freezeStart, freezeEnd);

  assert.ok(freezeStart > 0, "freezeReportForSignatures must exist");
  assert.ok(freezeEnd > freezeStart, "signReportForSignatures must follow it");
  assert.doesNotMatch(freezeBody, /ensureOralExamSummary/);
  assert.match(freezeBody, /frozenContentHash/);
  assert.match(freezeBody, /resolveRapSignatureRequirements/);
});

test("signing remains own-slot and bound to the finalized report snapshot", () => {
  const service = read(COLLABORATION_SERVICE);
  const signStart = service.indexOf("async signReportForSignatures");
  const signEnd = service.indexOf("getConclusionReadiness", signStart);
  const signBody = service.slice(signStart, signEnd);

  assert.match(signBody, /userId/);
  assert.match(signBody, /slot\.required === false/);
  assert.match(signBody, /signedContentHash: rap\.frozenContentHash/);
  assert.match(signBody, /signedContentVersion: rap\.contentVersion/);
  assert.doesNotMatch(signBody, /oralExamScores|oralExamSummary|FINALIZED.*evaluation/i);
});

test("the Chairman conclusion gate still requires evaluations, Summary, and finalized signatures", () => {
  const service = read(CONCLUSION_SERVICE);

  assert.match(service, /All required evaluator evaluations must be finalized before formal conclusion/);
  assert.match(service, /Oral Examination Summary must be generated/);
  assert.match(service, /rapStatus !== "FINALIZED"/);
  assert.match(service, /Members? of the Committee Report|Committee Report must be finalized/i);
});

test("no tenth realtime event and the existing report-signature events remain", () => {
  assert.equal(DEFENSE_REALTIME_EVENT_NAMES.length, 9);
  for (const eventName of [
    "report.ready_for_signature",
    "rap.signature.recorded",
    "rap.finalized",
    "evaluation.finalized",
  ]) {
    assert.ok(DEFENSE_REALTIME_EVENT_NAMES.includes(eventName), `${eventName} must remain`);
  }
  assert.ok(!DEFENSE_REALTIME_EVENT_NAMES.some((name) => /finalize.*report|report.*finalize/i.test(name)));
});
