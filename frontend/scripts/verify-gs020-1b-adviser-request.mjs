import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { adviserRequestSigningReady, captureAdviserRequestReview, signedAdviserRequestSubmission } from "../src/lib/adviser-request-signing.ts";
import { resolveAdviserRequestUiState } from "../src/lib/adviser-request-ui-state.ts";

const read = file => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const student = read("src/app/(portal)/student/thesis/adviser-request/page.tsx");
const record = read("src/components/shared/adviser-request-records.tsx");
const review = () => ({ requestedAdviserId: "adviser-1", reason: "Exact reason.\nSecond paragraph.", reviewedContext: {
  studentId: "student-1", studentName: "Sam Student", studentNumber: "2026-001", programName: "MIT",
  requestedAdviserName: "Ana Adviser", sourceDefenseScheduleId: "title-session-1",
} });
const signature = "data:image/png;base64,AQID";

for (const [expected, step, adviserRequest, activeAdviser] of [
  ["LOCKED", "LOCKED", null, null],
  ["READY", "CURRENT", null, null],
  ["WAITING_ADVISER", "WAITING", { adviserStatus: "PENDING", deanStatus: "PENDING" }, null],
  ["WAITING_DEAN", "WAITING", { adviserStatus: "CONFORMED", deanStatus: "PENDING" }, null],
  ["DECLINED_RETRY", "CURRENT", { adviserStatus: "DECLINED", deanStatus: "PENDING" }, null],
  ["DEAN_REJECTED_RETRY", "CURRENT", { adviserStatus: "CONFORMED", deanStatus: "REJECTED" }, null],
  ["APPROVED_ACTIVE", "COMPLETED", { adviserStatus: "CONFORMED", deanStatus: "APPROVED" }, { userId: "adviser-1", name: "Ana Adviser" }],
]) {
  test(`Student Journey remains authoritative for ${expected}`, () => {
    assert.equal(resolveAdviserRequestUiState({ isLoading: false, isError: false, journey: {
      steps: [{ key: "ADVISER_REQUEST", state: step }], adviserRequest, activeAdviser,
    } }), expected);
  });
}

test("Review & Sign preserves exact request and identity even if the candidate query changes", () => {
  const current = review();
  const captured = captureAdviserRequestReview(current);
  current.requestedAdviserId = "changed";
  current.reason = "Changed reason";
  current.reviewedContext.studentName = "Changed profile";
  assert.equal(captured.requestedAdviserId, "adviser-1");
  assert.equal(captured.reason, "Exact reason.\nSecond paragraph.");
  assert.equal(captured.reviewedContext.studentName, "Sam Student");
});

test("unsigned, malformed, or incomplete review state cannot submit", () => {
  for (const value of ["", "typed name", "data:image/gif;base64,AQID"]) {
    assert.equal(adviserRequestSigningReady(review(), value), false);
    assert.throws(() => signedAdviserRequestSubmission(review(), value));
  }
  assert.equal(adviserRequestSigningReady(null, signature), false);
  assert.equal(adviserRequestSigningReady({ ...review(), requestedAdviserId: "" }, signature), false);
  for (const key of Object.keys(review().reviewedContext)) {
    assert.equal(adviserRequestSigningReady({ ...review(), reviewedContext: { ...review().reviewedContext, [key]: "" } }, signature), false);
  }
});

test("submission sends the reviewed values and explicit evidence, without a client signing timestamp", () => {
  const input = review();
  const payload = signedAdviserRequestSubmission(input, signature);
  assert.deepEqual(payload, { ...input, signatureData: signature });
  assert.equal("signedAt" in payload, false);
  input.reviewedContext.programName = "New program";
  assert.equal(payload.reviewedContext.programName, "MIT");
});

test("Student confirmation displays the exact identity, Adviser, and reason alongside the shared pad", () => {
  for (const name of ["studentName", "studentNumber", "programName", "requestedAdviserName"]) assert.ok(student.includes(`review.reviewedContext.${name}`));
  assert.match(student, /review\.reason/);
  assert.match(student, /confirmOpen && review && <ESignaturePad/);
  assert.match(student, /signedAdviserRequestSubmission\(review, signature\)/);
  assert.match(student, /!adviserRequestSigningReady\(review, signature\)/);
});

test("cancel, dismissal, failure, and successful submit discard transient signature and review", () => {
  assert.match(student, /const closeSigning = \(\) => \{[\s\S]*?setReview\(null\);[\s\S]*?setSignature\(""\);/);
  assert.match(student, /onOpenChange=\{open => \{ if \(!open\) closeSigning\(\); \}\}/);
  for (const callback of ["onSuccess", "onError"]) {
    const body = student.slice(student.indexOf(`${callback}:`));
    assert.match(body, /setReview\(null\)/);
    assert.match(body, /setSignature\(""\)/);
  }
  assert.match(student, /queryKey: studentThesisJourneyQueryKey/);
  assert.match(student, /queryKey: adviserRequestRecordsQueryKey/);
});

test("all roles use one shared finalized record surface outside actionable queues", () => {
  assert.match(student, /<AdviserRequestRecords audience="student"/);
  assert.match(read("src/components/panelist/my-advisees-workspace.tsx"), /<AdviserRequestRecords audience="adviser"/);
  assert.match(read("src/app/(portal)/admin/thesis/advisers/page.tsx"), /<AdviserRequestRecords audience="admin"/);
  assert.match(record, /\/thesis\/adviser\/requests\/records/);
});

test("approved Student and Adviser copy and View/Download wording match the approved package", () => {
  assert.ok(record.includes("This is the official record of your approved adviser request, including the Adviser’s confirmation and Graduate School approval."));
  assert.ok(record.includes("This is the official record of the student’s adviser request that you confirmed and that was approved by the Graduate School."));
  for (const label of ["View Adviser Request", "Download Adviser Request"]) assert.ok(record.includes(label));
  assert.match(record, /downloadOfficialDefensePdf/);
  assert.match(record, /DocumentViewer/);
});

test("records expose no standalone signature, form version, internal snapshot wording, or upload loop", () => {
  assert.doesNotMatch(record, /signatureData|base64|snapshot|GS-020|Rev\. 00|type="file"/);
  assert.doesNotMatch(student, /GS-020|Rev\. 00|type="file"/);
  assert.match(record, /disabled=\{!record\.pdfAvailable\}/);
});

test("record query and preview state are isolated by authenticated user and role", () => {
  assert.match(record, /session\.user\.id.*session\.user\.role/);
  assert.match(record, /key=\{viewerScope\}/);
  assert.match(record, /queryKey: \[\.\.\.adviserRequestRecordsQueryKey, viewerScope\]/);
  assert.match(student, /<AdviserRequestContent key=\{viewerScope\}/);
  assert.match(student, /queryKey: \[\.\.\.studentAdviserCandidatesQueryKey, viewerScope\]/);
  assert.match(student, /retry: false/);
});

test("PDF proxy authenticates server-side, encodes exact ID, and prevents caching", () => {
  const route = read("src/app/api/adviser-requests/[requestId]/pdf/route.ts");
  assert.match(route, /await auth\(\)/);
  assert.match(route, /if \(!token\)/);
  assert.match(route, /encodeURIComponent\(requestId\)/);
  assert.match(route, /Authorization: `Bearer \$\{token\}`/);
  assert.match(route, /cache: "no-store"/);
  assert.match(route, /"private, no-store"/);
  assert.match(route, /"Content-Disposition": "inline"/);
});

test("Adviser and Dean actions preserve existing authoritative mutations without a new Adviser signature pad", () => {
  const action = read("src/components/panelist/adviser-request-action-dialog.tsx");
  assert.match(action, /adviser-response/);
  assert.doesNotMatch(action, /ESignaturePad/);
  assert.match(read("src/app/(portal)/admin/thesis/advisers/page.tsx"), /dean-response/);
});
