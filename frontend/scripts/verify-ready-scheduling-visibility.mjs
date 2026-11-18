// Run: node --test scripts/verify-ready-scheduling-visibility.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const read = (relative) => readFileSync(resolve(root, relative), "utf8");

const SCHEDULING_PAGE = "src/app/(portal)/admin/thesis/scheduling/page.tsx";
const READY_SUBMISSION =
  "src/components/admin/defense-scheduling/ready-defense-submission.tsx";
const SUMMARY_CARD =
  "src/components/admin/defense-scheduling/defense-summary-card.tsx";
const SCHEDULED_SUBMISSION =
  "src/components/admin/defense-scheduling/scheduled-defense-submission.tsx";
const APPLICATION_DETAIL =
  "src/app/(portal)/admin/thesis/applications/[id]/page.tsx";
const ADVISERS_PAGE = "src/app/(portal)/admin/thesis/advisers/page.tsx";

test("Admin Scheduling Ready view embeds ReadyDefenseSubmission with exact thesisId and stage", () => {
  const page = read(SCHEDULING_PAGE);

  assert.match(page, /<ReadyDefenseSubmission/);
  assert.match(page, /thesisId=\{selected\.thesisId \?\? selected\.id\}/);
  assert.match(page, /stage=\{selected\.stage\}/);
});

test("ReadyDefenseSubmission queries document-history scoped by viewer, stage, and renders read-only evidence", () => {
  const ready = read(READY_SUBMISSION);

  assert.match(
    ready,
    /\/thesis\/defense\/applications\/\$\{encodeURIComponent\(thesisId\)\}\/document-history\?stage=\$\{encodeURIComponent\(stage\)\}/,
  );
  assert.match(ready, /session\.user\.id.*session\.user\.role/);
  assert.match(ready, /queryKey: \["ready-defense-submission", viewerScope, thesisId, stage\]/);
  assert.match(ready, /stage === "PROPOSAL" \|\| stage === "FINAL"/);
  assert.match(
    ready,
    /<AdviserCertificationRecords thesisId=\{thesisId\} stage=\{stage\} \/>/,
  );
  assert.match(ready, /slot\.docType === "RECEIPT"/);
  assert.match(ready, /O\.R\. No\.:/);
  assert.match(ready, /Amount Paid:/);
  assert.match(ready, /\/api\/documents\/thesis-document\/\$\{encodeURIComponent\(id\)\}\/file/);
  assert.doesNotMatch(
    ready,
    /type="file"|<input|method:\s*["'](?:POST|PUT|PATCH|DELETE)|onUpload|onDelete|onReplace|signatureData|storageKey|checksum|filePath/,
  );
});

test("Stale Title Defense structured title copy is removed from DefenseSummaryCard and Application Detail", () => {
  const summary = read(SUMMARY_CARD);
  const detail = read(APPLICATION_DETAIL);

  assert.doesNotMatch(summary, /Proposed Research Titles/);
  assert.doesNotMatch(summary, /selected at Title Defense conclusion/);
  assert.doesNotMatch(summary, /application\.thesisTitles/);

  assert.doesNotMatch(detail, /Proposed Research Titles/);
  assert.doesNotMatch(detail, /selected by the committee during the Title Defense/);
  assert.doesNotMatch(detail, /app\.thesisTitles\.find/);
});

test("Application Detail resolves Proposal/Final title from authoritative manuscriptReview", () => {
  const detail = read(APPLICATION_DETAIL);

  assert.match(detail, /\(isProposal \|\| isFinal\)/);
  assert.match(detail, /Thesis \/ Dissertation Title/);
  assert.match(detail, /historyQuery\.data\?\.manuscriptReview\?\.certifiedManuscriptTitle/);
  assert.match(detail, /reviewedManuscriptVersion\?\.manuscriptTitle/);
});

test("ScheduledDefenseSubmission labels TITLE stage as Title Defense Proposal Package and gates Thesis/Dissertation Title to Proposal/Final", () => {
  const scheduled = read(SCHEDULED_SUBMISSION);

  assert.match(scheduled, /data\.stage === "TITLE"/);
  assert.match(scheduled, /Title Defense Proposal Package/);
  assert.match(
    scheduled,
    /\(data\.stage === "PROPOSAL" \|\| data\.stage === "FINAL"\)[\s\S]*Thesis\/Dissertation Title:/,
  );
});

test("Admin Adviser Request Review no longer displays stale Official selected title", () => {
  const advisers = read(ADVISERS_PAGE);

  assert.doesNotMatch(advisers, /Official selected title/);
});
