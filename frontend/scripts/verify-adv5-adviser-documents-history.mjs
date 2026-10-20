// ADV-5 — Adviser academic documents + defense history.
//
// Run: node --test scripts/verify-adv5-adviser-documents-history.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  defenseVerdictLabel,
  researchDocumentKindLabel,
} from "../src/lib/adviser-workspace.ts";

const root = process.cwd();
const read = (relative) => readFileSync(resolve(root, relative), "utf8");

const DETAIL =
  "src/app/(portal)/panelist/advisees/[studentId]/page.tsx";
const TYPES = "src/types/adviser-workspace.ts";
const LIB = "src/lib/adviser-workspace.ts";

test("the detail page consumes the additive ADV-5 read model", () => {
  const page = read(DETAIL);

  assert.match(page, /data\.researchDocuments/);
  assert.match(page, /data\.defenseHistory/);
  assert.match(page, /Research Documents/);
  assert.match(page, /Defense History/);
});

test("research documents use the academic kinds and secure document route", () => {
  const page = read(DETAIL);

  assert.match(page, /researchDocumentKindLabel\(document\.kind\)/);
  assert.match(page, /document\.isCurrent \? "Current" : "Previous version"/);
  assert.match(
    page,
    /\/api\/documents\/thesis-document\/\$\{viewerDoc\.id\}\/file/,
  );
  assert.match(page, /<DocumentViewer/);

  // No public/storage URL is introduced.
  assert.doesNotMatch(page, /https?:\/\/.*\.(pdf|png|jpe?g)/i);
  assert.doesNotMatch(page, /filePath|storageKey|storageProvider|checksum/);
});

test("research document labels are human-facing", () => {
  assert.equal(
    researchDocumentKindLabel("TITLE_PROPOSAL_PACKAGE"),
    "Title Proposal Package",
  );
  assert.equal(
    researchDocumentKindLabel("PROPOSAL_MANUSCRIPT"),
    "Proposal Manuscript",
  );
  assert.equal(
    researchDocumentKindLabel("FINAL_MANUSCRIPT"),
    "Final Manuscript",
  );
});

test("defense history renders stage, date, and verdict", () => {
  const page = read(DETAIL);

  assert.match(page, /entry\.stage/);
  assert.match(page, /workspaceStageLabel\(entry\.stage\)/);
  assert.match(page, /formatWorkspaceDate\(entry\.defenseDate\)/);
  assert.match(page, /defenseVerdictLabel\(entry\.verdict\)/);

  assert.equal(defenseVerdictLabel("PASSED"), "Passed");
  assert.equal(
    defenseVerdictLabel("REDEFENSE_REQUIRED"),
    "Re-defense required",
  );
  assert.equal(defenseVerdictLabel("REVISION_REQUIRED"), "Revisions required");
  assert.equal(defenseVerdictLabel("FAILED"), "Failed");
});

test("finalized Committee Report is read-only and safely rendered", () => {
  const page = read(DETAIL);

  assert.match(page, /ReportDocumentView/);
  assert.match(page, /normalizeReportDocument/);
  assert.match(page, /committeeReport\?\.bodyDocument/);
  assert.match(page, /committeeReport\?\.text/);
  assert.match(page, /<pre/);
  assert.doesNotMatch(page, /dangerouslySetInnerHTML/);
  assert.doesNotMatch(page, /useMutation|request-changes|certify|adviser-response/);
});

test("no evaluator scores, criteria, or signature internals are rendered", () => {
  const page = read(DETAIL);

  assert.doesNotMatch(
    page,
    /oralExamScore|evaluatorScore|criteria|signatureData|signedContentHash|OralRating/i,
  );
});

test("the additive frontend types mirror the safe DTOs", () => {
  const types = read(TYPES);

  assert.match(types, /interface AdviserResearchDocumentDto/);
  assert.match(types, /interface AdviserDefenseHistoryEntryDto/);
  assert.match(types, /researchDocuments: AdviserResearchDocumentDto\[\]/);
  assert.match(types, /defenseHistory: AdviserDefenseHistoryEntryDto\[\]/);
  assert.match(types, /committeeReport: AdviserDefenseHistoryReportDto \| null/);
  assert.doesNotMatch(
    types,
    /filePath|storageKey|checksum|signatureData|signedContentHash|oralExamScore/,
  );
});

test("the helpers preserve the ADV-4 working-title boundary", () => {
  const lib = read(LIB);
  const page = read(DETAIL);

  assert.match(page, /advisee\.research\.workingTitle|data\.research\.workingTitle/);
  // Research documents/history do not define a current title.
  assert.doesNotMatch(page, /researchDocuments[^\n]*workingTitle/);
  assert.doesNotMatch(page, /defenseHistory[^\n]*workingTitle/);
  assert.match(lib, /researchDocumentKindLabel/);
});
