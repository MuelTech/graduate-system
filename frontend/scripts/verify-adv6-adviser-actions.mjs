// ADV-6 — Adviser request/review action integration and URL context.
//
// Run: node --test scripts/verify-adv6-adviser-actions.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const read = (relative) => readFileSync(resolve(root, relative), "utf8");

const WORKSPACE = "src/components/panelist/my-advisees-workspace.tsx";
const DETAIL =
  "src/app/(portal)/panelist/advisees/[studentId]/page.tsx";
const REQUEST_DIALOG =
  "src/components/panelist/adviser-request-action-dialog.tsx";
const REVIEW_PANEL =
  "src/components/panelist/adviser-review-action-panel.tsx";
const REVIEW_LIB = "src/lib/adviser-reviews.ts";
const LEGACY_REQUESTS =
  "src/app/(portal)/panelist/adviser-requests/page.tsx";
const LEGACY_REVIEWS =
  "src/app/(portal)/panelist/adviser-reviews/page.tsx";
const LAYOUT = "src/app/(portal)/panelist/layout.tsx";
const DASHBOARD_RULES =
  "../backend/src/services/panelist-dashboard.rules.ts";

test("Incoming Requests exposes CONFORME / Decline only for ACTIONABLE requests", () => {
  const page = read(WORKSPACE);

  assert.match(page, /const actionable = state === "ACTIONABLE"/);
  assert.match(page, /CONFORME \/ Accept/);
  assert.match(page, /Decline/);
  assert.match(page, /\{actionable \? \(/);
  assert.match(page, /onAction\(request, "CONFORMED"\)/);
  assert.match(page, /onAction\(request, "DECLINED"\)/);
});

test("request mutation reuses the existing adviser-response endpoint", () => {
  const dialog = read(REQUEST_DIALOG);

  assert.match(
    dialog,
    /`\/thesis\/adviser\/requests\/\$\{request\.id\}\/adviser-response`/,
  );
  assert.match(dialog, /decision/);
  assert.match(dialog, /remarks/);
  assert.doesNotMatch(dialog, /activeAdvisees|setQueryData/);
});

test("successful request response invalidates workspace, request inbox, and dashboard", () => {
  const dialog = read(REQUEST_DIALOG);

  assert.match(dialog, /adviserWorkspaceQueryKey/);
  assert.match(dialog, /panelistAdviserRequestsQueryKey/);
  assert.match(dialog, /panelistDashboardQueryKey/);
  assert.match(dialog, /invalidateQueries/);
});

test("review action panel reuses exact stage-specific task and mutation paths", () => {
  const panel = read(REVIEW_PANEL);
  const lib = read(REVIEW_LIB);

  assert.match(panel, /adviserReviewTaskPath\(stage, thesisId\)/);
  assert.match(panel, /adviserReviewBasePath\(stage\)/);
  assert.match(panel, /\/request-changes/);
  assert.match(panel, /\/certify/);

  assert.match(
    lib,
    /stage === "FINAL"[\s\S]{0,120}\/thesis\/final-adviser-review\/tasks[\s\S]{0,120}\/thesis\/proposal-adviser-review\/tasks/,
  );
});

test("Request Changes and Certify use the exact task manuscript concurrency token", () => {
  const panel = read(REVIEW_PANEL);

  assert.match(panel, /const documentId = task\?\.manuscript\?\.documentId/);
  assert.match(
    panel,
    /expectedReviewedDocumentId: documentId/,
  );
  // Both mutations use the same exact-task token; no workspace summary id.
  const occurrences = panel.match(/expectedReviewedDocumentId: documentId/g) ?? [];
  assert.equal(occurrences.length, 2);
  assert.doesNotMatch(panel, /manuscriptDocumentId/);
});

test("Certify requires a signature and a clear confirmation step", () => {
  const panel = read(REVIEW_PANEL);

  assert.match(panel, /!signature\.trim\(\)/);
  assert.match(panel, /Certify this manuscript\?/);
  assert.match(panel, /Certification applies to the exact manuscript/);
  assert.match(panel, /Confirm Certification/);
  assert.match(panel, /cannot be undone/);
});

test("Final STRIKE blocking remains driven by the exact Final task", () => {
  const panel = read(REVIEW_PANEL);
  const lib = read(REVIEW_LIB);

  assert.match(lib, /stage === "FINAL"/);
  assert.match(lib, /task\?\.strikeRequired === true/);
  assert.match(lib, /task\?\.strikeEligible !== true/);
  assert.match(panel, /isFinalStrikeBlocked\(stage, task\)/);
  assert.match(panel, /STRIKE pending/);
  assert.match(panel, /Review actions are disabled/);
});

test("stale review 409 refreshes exactly and never retries automatically", () => {
  const panel = read(REVIEW_PANEL);

  assert.match(panel, /statusCode === 409/);
  assert.match(
    panel,
    /The manuscript or review state changed\. Review the latest version before continuing\./,
  );
  assert.match(panel, /void invalidate\(\)/);
  assert.match(panel, /retry: false/);
});

test("review mutations invalidate exact task, workspace, advisee detail, legacy queue, and dashboard", () => {
  const panel = read(REVIEW_PANEL);

  assert.match(panel, /adviserReviewTaskQueryKey\(stage, thesisId\)/);
  assert.match(panel, /adviserWorkspaceQueryKey/);
  assert.match(panel, /adviserAdviseeDetailQueryKey\(taskStudentId\)/);
  assert.match(panel, /adviserReviewsQueueQueryKey/);
  assert.match(panel, /panelistDashboardQueryKey/);
});

test("advisee detail reuses the shared review action surface", () => {
  const page = read(DETAIL);

  assert.match(page, /AdviserReviewActionPanel/);
  assert.match(page, /onReview=\{\(selected\)/);
  assert.match(page, /setReviewTarget/);
  assert.match(page, /Review manuscript/);
  // No duplicate mutation implementation on the detail page.
  assert.doesNotMatch(page, /useMutation|request-changes|certify/);
});

test("My Advisees tabs are URL-controlled and keep the URL in sync", () => {
  const page = read(WORKSPACE);

  assert.match(page, /useSearchParams/);
  assert.match(page, /useRouter/);
  assert.match(page, /value=\{tab\}/);
  assert.match(page, /onValueChange=\{handleTabChange\}/);
  assert.match(page, /tabParam === "requests" \|\| tabParam === "reviews"/);
  assert.match(page, /params\.delete\("requestId"\)/);
  assert.match(page, /params\.delete\("stage"\)/);
  assert.match(page, /params\.delete\("thesisId"\)/);
  assert.match(page, /router\.replace/);
});

test("request deep links are matched only against the caller's own workspace requests", () => {
  const page = read(WORKSPACE);

  assert.match(
    page,
    /data\?\.incomingRequests\.find\(\(request\) => request\.id === requestIdParam\)/,
  );
  assert.match(page, /This task is no longer available\./);
  assert.doesNotMatch(page, /\/adviser\/requests\/dean-review|\/adviser\/requests`/);
});

test("review deep links are matched only against the caller's own workspace review tasks", () => {
  const page = read(WORKSPACE);

  assert.match(
    page,
    /data\?\.reviewTasks\.find\(/,
  );
  assert.match(page, /task\.stage === validStageParam && task\.thesisId === thesisIdParam/);
  assert.match(page, /This task is no longer available\./);
  assert.doesNotMatch(page, /\/admin\//);
});

test("Dashboard Adviser links now target My Advisees contexts", () => {
  const rules = read(DASHBOARD_RULES);

  assert.match(
    rules,
    /\/panelist\/advisees\?tab=requests&requestId=\$\{encodeURIComponent\(requestId\)\}/,
  );
  assert.match(
    rules,
    /\/panelist\/advisees\?tab=reviews&stage=\$\{encodeURIComponent\(stage\)\}&thesisId=\$\{encodeURIComponent\(thesisId\)\}/,
  );
  assert.match(rules, /adviserRequestHref\(r\.id\)/);
  assert.match(rules, /adviserReviewHref\(t\.stage, t\.thesisId\)/);
});

test("unrelated Dashboard links remain on their existing destinations", () => {
  const rules = read(DASHBOARD_RULES);

  assert.match(rules, /function workspaceHref\(scheduleId: string\): string \{/);
  assert.match(rules, /return `\/panelist\/defense-workspace\/\$\{scheduleId\}`/);
  assert.match(rules, /href: "\/panelist\/signatures"/);
});

test("compatibility pages, sidebar entries, and no ADV-7 redirect remain", () => {
  assert.equal(existsSync(resolve(root, LEGACY_REQUESTS)), true);
  assert.equal(existsSync(resolve(root, LEGACY_REVIEWS)), true);

  const requests = read(LEGACY_REQUESTS);
  const reviews = read(LEGACY_REVIEWS);
  assert.match(requests, /Adviser Requests/);
  assert.match(reviews, /Adviser Reviews/);
  assert.doesNotMatch(requests, /\bredirect\(/);
  assert.doesNotMatch(reviews, /\bredirect\(/);

  const layout = read(LAYOUT);
  assert.match(layout, /href: "\/panelist\/adviser-requests"/);
  assert.match(layout, /href: "\/panelist\/adviser-reviews"/);
  assert.match(layout, /href: "\/panelist\/advisees", label: "My Advisees"/);
});

test("shared action surfaces avoid raw internal terminology in visible copy", () => {
  const panel = read(REVIEW_PANEL);
  const dialog = read(REQUEST_DIALOG);

  for (const source of [panel, dialog]) {
    assert.doesNotMatch(
      source,
      /AdviserAssignment|reviewedDocumentId|assignmentId|adviserId|Prisma|ThesisRecord/,
    );
  }
});
