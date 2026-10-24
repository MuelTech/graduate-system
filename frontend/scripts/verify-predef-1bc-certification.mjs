import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isCertificationConfirmationReady } from "../src/lib/adviser-reviews.ts";
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const ready = { documentId: "doc-v1", manuscriptTitle: "Exact Title", originalFilename: "v1.pdf", confirmationDocumentId: "doc-v1", acknowledgedDocumentId: "doc-v1" };

test("confirmation requires explicit acknowledgement of the displayed exact document", () => {
  assert.equal(isCertificationConfirmationReady(ready), true);
  for (const field of Object.keys(ready)) assert.equal(isCertificationConfirmationReady({ ...ready, [field]: null }), false);
});
test("acknowledgement cannot carry across a replacement manuscript or refreshed task", () => {
  assert.equal(isCertificationConfirmationReady({ ...ready, documentId: "doc-v2" }), false);
  assert.equal(isCertificationConfirmationReady({ ...ready, acknowledgedDocumentId: "doc-v2" }), false);
  assert.equal(isCertificationConfirmationReady({ ...ready, confirmationDocumentId: "doc-v2" }), false);
});
test("blank title or filename never enables confirmation", () => {
  assert.equal(isCertificationConfirmationReady({ ...ready, manuscriptTitle: " \t " }), false);
  assert.equal(isCertificationConfirmationReady({ ...ready, originalFilename: " " }), false);
});
test("confirmation shows Student, stage, exact title/file, and opens the exact manuscript", () => {
  const panel = read("src/components/panelist/adviser-review-action-panel.tsx");
  for (const text of ["Student", "Stage", "Thesis/Dissertation Title", "Manuscript file", "View Manuscript", "I confirm that I reviewed this exact manuscript"]) assert.ok(panel.includes(text));
  assert.match(panel, /task\.manuscript\?\.manuscriptTitle/);
  assert.match(panel, /task\.manuscript\?\.originalFilename/);
  assert.match(panel, /type="checkbox"/);
  assert.match(panel, /!confirmationReady/);
  assert.match(panel, /confirmationDocumentId, acknowledgedDocumentId/);
  assert.match(panel, /expectedReviewedDocumentId: documentId/);
  assert.match(panel, /thesis-document\/\$\{manuscriptId\}\/file/);
});
test("new signing reuses shared PNG signature evidence without changing signature-pad behavior", () => {
  assert.match(read("src/components/panelist/adviser-review-action-panel.tsx"), /<ESignaturePad/);
  assert.match(read("src/components/defense-workspace/e-signature-pad.tsx"), /canvas\.toDataURL\("image\/png"\)/);
});
test("issued record mode offers View/Download with no extra submission or upload slot", () => {
  const record = read("src/components/shared/adviser-certification-records.tsx");
  for (const text of ["Issued Adviser Certifications", "View GS-017", "Download Copy", "No additional upload or submission is required.", "unavailableReason"]) assert.ok(record.includes(text));
  assert.match(record, /disabled=\{!record\.pdfAvailable\}/);
  assert.match(record, /downloadOfficialDefensePdf/);
  assert.doesNotMatch(record, /type="file"|signatureData|storageKey|checksum|filePath/);
});
test("owning Student Proposal and Final issued status embed the shared official record", () => {
  for (const stage of ["proposal", "final"]) {
    const source = read(`src/components/student/${stage}-adviser-review-panel.tsx`);
    assert.match(source, /status === "ISSUED" && data\?\.thesisId && <AdviserCertificationRecords/);
    assert.match(source, new RegExp(`stage="${stage.toUpperCase()}"`));
  }
});
test("issuer records remain discoverable outside the open review workload", () => {
  assert.match(read("src/components/panelist/my-advisees-workspace.tsx"), /<AdviserCertificationRecords \/>/);
  assert.match(read("src/app/(portal)/panelist/advisees/[studentId]/page.tsx"), /<AdviserCertificationRecords thesisId=\{data\.research\.thesisId\}/);
  assert.match(read("src/components/panelist/adviser-review-action-panel.tsx"), /invalidateQueries\(\{ queryKey: adviserCertificationRecordsQueryKey \}\)/);
});
test("Admin application review includes exact stage GS-017 without an upload slot", () => {
  const source = read("src/app/(portal)/admin/thesis/applications/[id]/page.tsx");
  assert.match(source, /stage === "PROPOSAL" \|\| stage === "FINAL"/);
  assert.match(source, /<AdviserCertificationRecords thesisId=\{thesisId\} stage=\{stage\}/);
});
test("inline preview authenticates server-side and does not cache PDF evidence", () => {
  const route = read("src/app/api/adviser-certifications/[certificationId]/pdf/route.ts");
  assert.match(route, /await auth\(\)/);
  assert.match(route, /encodeURIComponent\(certificationId\)/);
  assert.match(route, /Authorization: `Bearer \$\{token\}`/);
  assert.match(route, /"private, no-store"/);
  assert.match(route, /"Content-Disposition": "inline"/);
});

test("record query cache and preview state are isolated by authenticated user, role, and selected context", () => {
  const source = read("src/components/shared/adviser-certification-records.tsx");
  assert.match(source, /session\.user\.id.*session\.user\.role/);
  assert.match(source, /queryKey: \[\.\.\.adviserCertificationRecordsQueryKey, viewerScope/);
  assert.match(source, /<CertificationRecordList key=\{/);
  assert.match(source, /if \(!session\?\.user\?\.id\) return null/);
});
