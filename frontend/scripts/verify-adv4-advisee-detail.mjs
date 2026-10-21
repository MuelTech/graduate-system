// ADV-4 — Advisee detail + research overview.
//
// Run: node --test scripts/verify-adv4-advisee-detail.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  adviserAdviseeDetailQueryKey,
  adviserReviewStatusLabel,
  nextAdviserResponsibility,
  workspaceStageLabel,
} from "../src/lib/adviser-workspace.ts";

const root = process.cwd();
const read = (relative) => readFileSync(resolve(root, relative), "utf8");

const DETAIL = "src/app/(portal)/panelist/advisees/[studentId]/page.tsx";
const WORKSPACE = "src/components/panelist/my-advisees-workspace.tsx";
const LAYOUT = "src/app/(portal)/panelist/layout.tsx";
const TYPES = "src/types/adviser-workspace.ts";

function task(overrides = {}) {
  return {
    stage: "PROPOSAL",
    thesisId: "thesis-1",
    student: { id: "student-1", name: "Ana Cruz", studentNumber: "2026-001" },
    officialTitle: "Historical title",
    reviewStatus: "AWAITING_REVIEW",
    reviewRemarks: null,
    manuscriptDocumentId: "doc-1",
    manuscriptUploadedAt: "2026-10-02T00:00:00.000Z",
    ...overrides,
  };
}

test("the advisee detail route exists", () => {
  assert.equal(existsSync(resolve(root, DETAIL)), true);
});

test("the detail page consumes only the accepted exact-advisee API", () => {
  const page = read(DETAIL);

  assert.match(
    page,
    /apiClientRequest\(\s*`\/thesis\/adviser\/advisees\/\$\{studentId\}`/,
  );
  assert.match(page, /adviserAdviseeDetailQueryKey\(studentId\)/);
  assert.match(page, /enabled: Boolean\(studentId\)/);
  assert.doesNotMatch(page, /\/admin\/students|\/student\/journey/);
});

test("the Active Advisee card links to the detail route", () => {
  const page = read(WORKSPACE);
  const activeBlock = page.slice(
    page.indexOf("function ActiveAdviseeCard"),
    page.indexOf("function IncomingRequestCard"),
  );

  assert.match(
    activeBlock,
    /href=\{`\/panelist\/advisees\/\$\{advisee\.student\.id\}`\}/,
  );
  assert.match(activeBlock, /Open Advisee/);
});

test("Incoming Requests do not receive an advisee-detail link", () => {
  const page = read(WORKSPACE);
  const requestBlock = page.slice(
    page.indexOf("function IncomingRequestCard"),
    page.indexOf("function ReviewTaskCard"),
  );

  assert.doesNotMatch(requestBlock, /\/panelist\/advisees\//);
});

test("the detail page renders authoritative identity from the detail DTO", () => {
  const page = read(DETAIL);

  assert.match(page, /title=\{data\.student\.name\}/);
  assert.match(page, /data\.student\.studentNumber/);
  assert.match(page, /data\.student\.program/);
});

test("research stage uses human-facing labels", () => {
  const page = read(DETAIL);

  assert.match(page, /workspaceStageLabel\(data\.research\.currentStage\)/);
  assert.equal(workspaceStageLabel("TITLE"), "Title");
  assert.equal(workspaceStageLabel("PROPOSAL"), "Proposal");
  assert.equal(workspaceStageLabel("FINAL"), "Final");
  assert.equal(workspaceStageLabel("UNKNOWN"), "Not set");
});

test("the Adviser relationship date is rendered without internal identifiers", () => {
  const page = read(DETAIL);

  assert.match(page, /formatWorkspaceDate\(data\.assignment\.assignedDate\)/);
  assert.match(page, /Active adviser/);
  assert.doesNotMatch(page, /data\.assignment\.assignmentId/);
  assert.doesNotMatch(page, /adviserId|isActive/);
});

test("the current title uses only workingTitle, never historical title fields", () => {
  const page = read(DETAIL);

  assert.match(page, /data\.research\.workingTitle/);
  assert.match(page, /label="Current title"/);
  assert.doesNotMatch(page, /officialTitle/);
  assert.doesNotMatch(page, /selectedTitle|isSelected/);
});

test("review context and next responsibility come from authoritative tasks", () => {
  const page = read(DETAIL);

  assert.match(page, /data\.reviewContext\.tasks/);
  assert.match(
    page,
    /nextAdviserResponsibility\(\s*data\.reviewContext\.tasks,?\s*\)/,
  );
  assert.match(page, /data\.reviewContext\.tasks\.map/);
  assert.match(page, /adviserReviewStatusLabel\(task\.reviewStatus\)/);

  assert.equal(nextAdviserResponsibility([]), "No manuscript review pending");
  assert.equal(
    nextAdviserResponsibility([task({ stage: "PROPOSAL" })]),
    "Proposal manuscript review pending",
  );
  assert.equal(
    nextAdviserResponsibility([task({ stage: "FINAL" })]),
    "Final manuscript review pending",
  );
  assert.equal(
    nextAdviserResponsibility([task({ reviewStatus: "CHANGES_REQUESTED" })]),
    "Changes requested; awaiting student revision",
  );
  assert.equal(
    nextAdviserResponsibility([task({ reviewStatus: "ISSUED" })]),
    "No manuscript review pending",
  );
  assert.equal(
    nextAdviserResponsibility([
      task({ stage: "PROPOSAL" }),
      task({ stage: "FINAL", reviewStatus: "NONE" }),
    ]),
    "Proposal and Final manuscript reviews pending",
  );
  assert.equal(adviserReviewStatusLabel("ISSUED"), "Certification issued");
});

test("the detail query key is stable and user-scoped by student", () => {
  assert.deepEqual(
    [...adviserAdviseeDetailQueryKey("student-1")],
    ["panelist", "adviser-workspace", "advisee", "student-1"],
  );
});

test("ADV-4 review context remains distinct from ADV-5 document/history work", () => {
  const page = read(DETAIL);

  assert.match(page, /Current Review Context/);
  assert.match(page, /nextAdviserResponsibility/);
  // Direct research-document/history integration is owned by ADV-5 and is
  // asserted by verify-adv5-adviser-documents-history.mjs.
});

test("no request or review mutation is introduced", () => {
  const page = read(DETAIL);

  assert.doesNotMatch(
    page,
    /useMutation|adviser-response|request-changes|certify/,
  );
  assert.match(page, /\/panelist\/adviser-reviews/);
});

test("404, 409, generic error, and loading states are distinct", () => {
  const page = read(DETAIL);

  assert.match(page, /statusCode === 404/);
  assert.match(page, /Advisee not available/);
  assert.match(page, /no longer available in your active supervision\s+list/);
  assert.match(page, /statusCode === 409/);
  assert.match(page, /Unable to load this advisee\./);
  assert.match(page, /Please try again\./);
  assert.match(page, /Try again/);
  assert.match(page, /isLoading/);
  assert.match(page, /DetailSkeleton/);
  assert.match(page, /BackToMyAdvisees/);
});

test("the detail page exposes no persistence terminology", () => {
  const page = read(DETAIL);

  assert.doesNotMatch(
    page,
    /AdviserAssignment|assignmentId|Prisma|ThesisRecord/,
  );
});

test("My Advisees sidebar behavior remains intact", () => {
  const layout = read(LAYOUT);

  assert.match(layout, /href: "\/panelist\/advisees", label: "My Advisees"/);
  assert.match(layout, /pathname\.startsWith\(`\$\{href\}\/`\)/);
  assert.match(layout, /MY_DEFENSES_CONTEXT_ROUTES/);
  assert.doesNotMatch(layout, /href: "\/panelist\/adviser-requests"/);
  assert.doesNotMatch(layout, /href: "\/panelist\/adviser-reviews"/);
});

test("frontend detail types match the accepted DTO and contain no raw relations", () => {
  const types = read(TYPES);

  assert.match(types, /interface AdviserAdviseeDetailDto/);
  assert.match(types, /assignment: \{/);
  assert.match(types, /assignedDate: string/);
  assert.match(types, /reviewContext: \{/);
  assert.match(types, /tasks: AdviserWorkspaceReviewTaskDto\[\]/);
  assert.doesNotMatch(types, /adviserAssignments|ThesisRecord|Prisma/);
});
