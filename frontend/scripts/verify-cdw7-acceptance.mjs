// CDW-7 — acceptance/regression verifier (cross-feature UI contracts).
//
// This does NOT re-test implementation details already covered by the CDW-1..6
// verifiers. It locks the assembled workflow: no realtime requirement, no stale
// pre-RAP conclusion path, correct role gating, and read-only history.
//
// Run: node --experimental-strip-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/verify-cdw7-acceptance.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  canAnnotateRole,
  canCommentRole,
  isCollaborationActive,
} from "../src/lib/pdf-annotation/collaboration-client.ts";

const root = process.cwd();
const read = (relative) => readFileSync(resolve(root, relative), "utf8");

const SHELL = "src/components/defense-workspace/workspace-shell.tsx";
const RAIL = "src/components/defense-workspace/role-rail.tsx";
const VERDICT = "src/components/defense-workspace/chairman-verdict-panel.tsx";
const CONCLUSION = "src/components/defense-workspace/chairman-conclusion-panel.tsx";
const REPORT = "src/components/defense-workspace/committee-report-panel.tsx";
const RAP_PANEL = "src/components/defense-workspace/rap-signature-panel.tsx";
const PROVIDER = "src/components/defense-workspace/student-document-collaboration.tsx";
const HISTORY = "src/components/defense-workspace/defense-history-panel.tsx";
const HISTORY_HOOKS = "src/hooks/use-defense-history.ts";
const PAGE = "src/app/(portal)/panelist/defense-workspace/[scheduleId]/page.tsx";

test("the complete workspace shell exists without any realtime dependency", () => {
  for (const file of [SHELL, RAIL, VERDICT, REPORT, RAP_PANEL, PROVIDER, HISTORY, PAGE]) {
    assert.equal(existsSync(resolve(root, file)), true, `${file} should exist`);
  }
  const combined = [SHELL, RAIL, VERDICT, REPORT, RAP_PANEL, PROVIDER, HISTORY, PAGE]
    .map(read)
    .join("\n");
  assert.doesNotMatch(combined, /socket\.io|Socket\.IO|WebSocket|new WebSocket/i);
});

test("Current Manuscript remains the default surface", () => {
  const shell = read(SHELL);
  assert.match(shell, /useState<CenterTab>\("doc"\)/);
  assert.match(shell, /Student Document/);
  assert.match(shell, /Committee Report/);
});

test("official scoring is gated on evaluationOpen (IN_PROGRESS only), never role alone", () => {
  const rail = read(RAIL);
  assert.match(rail, /evaluationOpen/);
  assert.match(rail, /OralEvaluationForm/);
  // The workspace DTO field is server-authoritative for IN_PROGRESS-only scoring.
  assert.match(read("src/types/defense-workspace.ts"), /evaluationOpen/);
});

test("Start Defense is only exposed through the Chairman capability", () => {
  const rail = read(RAIL);
  assert.match(rail, /canStartDefense/);
  assert.match(rail, /Start Defense/);
});

test("the role rail uses the RAP-C1 verdict panel, and the old panel is read-only", () => {
  const rail = read(RAIL);
  assert.match(rail, /ChairmanVerdictPanel/);
  assert.match(rail, /ChairmanConclusionPanel/);
  const old = read(CONCLUSION);
  assert.doesNotMatch(old, /useMutation|apiClientRequest|method:\s*"POST"/);
  assert.match(old, /Read-only/);
});

test("the verdict panel is server-readiness driven and offers only the canonical verdicts", () => {
  const verdict = read(VERDICT);
  assert.match(verdict, /conclusion-readiness/);
  assert.match(verdict, /readyForConclusion/);
  assert.match(verdict, /reportFinalized/);
  assert.match(verdict, /allSignaturesSigned/);
  assert.match(verdict, /value="PASSED"/);
  assert.match(verdict, /value="REDEFENSE_REQUIRED"/);
  assert.doesNotMatch(verdict, /value="FAILED"|value="REVISION_REQUIRED"|value="APPROVED"/);
  // Never derives the outcome from a score.
  assert.doesNotMatch(verdict, /overallAverage|finalRating|groupAAverage/);
});

test("freeze/signing is present in the report; the body is read-only once frozen", () => {
  const report = read(REPORT);
  assert.match(report, /RapSignaturePanel/);
  assert.match(report, /canEditBody/);
  assert.match(report, /canFreeze/);
  assert.match(report, /canSign/);
});

test("collaboration writes are closed for frozen/concluded attempts (pure policy)", () => {
  // Frozen RAP → read-only even mid-session.
  assert.equal(isCollaborationActive("AWAITING_CONCLUSION", "FOR_SIGNATURE"), false);
  assert.equal(isCollaborationActive("AWAITING_CONCLUSION", "PARTIALLY_SIGNED"), false);
  assert.equal(isCollaborationActive("AWAITING_CONCLUSION", "FINALIZED"), false);
  // Concluded → read-only.
  assert.equal(isCollaborationActive("CONCLUDED", null), false);
  // Active pre-freeze states remain writable.
  assert.equal(isCollaborationActive("SCHEDULED", null), true);
  assert.equal(isCollaborationActive("IN_PROGRESS", "DRAFT"), true);
  assert.equal(isCollaborationActive("AWAITING_CONCLUSION", "DRAFT"), true);
});

test("only Chairman/Panelist annotate; Rapporteur comments; Adviser/Facilitator have no academic write", () => {
  assert.equal(canAnnotateRole("CHAIRMAN"), true);
  assert.equal(canAnnotateRole("PANELIST"), true);
  assert.equal(canAnnotateRole("RAPPORTEUR"), false);
  assert.equal(canAnnotateRole("ADVISER"), false);
  assert.equal(canAnnotateRole("FACILITATOR"), false);
  assert.equal(canCommentRole("RAPPORTEUR"), true);
  assert.equal(canCommentRole("ADVISER"), false);
  assert.equal(canCommentRole("FACILITATOR"), false);
});

test("Defense History remains read-only and is not a current-attempt editor", () => {
  const history = read(HISTORY);
  assert.doesNotMatch(history, /onTextSelection|AnnotationCommentComposer|useMutation/);
  assert.match(history, /canComment=\{false\}/);
  assert.match(history, /Compare with Current/);
  assert.doesNotMatch(history, /textDiff|semanticDiff|computeDiff|revisionCompliant/);
});

test("history never renders raw signatures or private evaluator scores", () => {
  const combined = read(HISTORY) + read(HISTORY_HOOKS);
  for (const forbidden of ["signatureData", "signature_data", "overallAverage", "groupAAverage", "officialSnapshot"]) {
    assert.doesNotMatch(combined, new RegExp(forbidden));
  }
});

test("the report is authored in-system only (no Word/DOCX/PDF upload path)", () => {
  const combined = read(REPORT) + read("src/components/defense-workspace/rich-text-report-editor.tsx");
  assert.doesNotMatch(combined, /\.docx|\.doc\b|accept=".*pdf|upload/i);
  assert.match(read("src/components/defense-workspace/rich-text-report-editor.tsx"), /Tiptap|useEditor/);
});

test("polling keeps the persisted workflow correct without realtime", () => {
  const page = read(PAGE);
  assert.match(page, /refetchInterval/);
  assert.match(page, /20000/);
  const provider = read(PROVIDER);
  assert.match(provider, /collaborationPollIntervalMs/);
  assert.match(read(HISTORY_HOOKS), /useQuery/);
});
