// ADV-3 — My Advisees workspace.
//
// Run: node --test scripts/verify-adv3-my-advisees.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  adviserReviewStatusLabel,
  adviserWorkspaceQueryKey,
  openReviewLabel,
  workspaceStageLabel,
} from "../src/lib/adviser-workspace.ts";

const root = process.cwd();
const read = (relative) => readFileSync(resolve(root, relative), "utf8");

const ROUTE = "src/app/(portal)/panelist/advisees/page.tsx";
const PAGE = "src/components/panelist/my-advisees-workspace.tsx";
const LAYOUT = "src/app/(portal)/panelist/layout.tsx";
const LIB = "src/lib/adviser-workspace.ts";
const TYPES = "src/types/adviser-workspace.ts";

test("the My Advisees workspace route exists", () => {
  assert.equal(existsSync(resolve(root, ROUTE)), true);
});

test("the page uses one accepted workspace query", () => {
  const page = read(PAGE);
  const lib = read(LIB);

  assert.match(page, /apiClientRequest\(\s*"\/thesis\/adviser\/workspace"/);
  assert.match(page, /adviserWorkspaceQueryKey/);
  assert.match(lib, /"panelist",\s*"adviser-workspace"/);
  assert.equal(adviserWorkspaceQueryKey.join("/"), "panelist/adviser-workspace");

  // No duplicate per-section reads or mutation endpoints.
  assert.doesNotMatch(page, /\/thesis\/adviser\/requests\/mine/);
  assert.doesNotMatch(page, /\/adviser-response|\/request-changes|\/certify/);
  assert.doesNotMatch(page, /useMutation/);
});

test("the three workspace modes consume the accepted DTO", () => {
  const page = read(PAGE);

  assert.match(page, /value=\{tab\}/);
  assert.match(page, /<TabsTrigger value="active"/);
  assert.match(page, /<TabsTrigger value="requests"/);
  assert.match(page, /<TabsTrigger value="reviews"/);
  assert.match(page, /Active Advisees/);
  assert.match(page, /Incoming Requests/);
  assert.match(page, /Review Tasks/);

  assert.match(page, /data\.activeAdvisees/);
  assert.match(page, /data\.incomingRequests/);
  assert.match(page, /data\.reviewTasks/);
});

test("tabs expose actual returned counts", () => {
  const page = read(PAGE);

  assert.match(page, /data\.activeAdvisees\.length/);
  assert.match(page, /data\.incomingRequests\.length/);
  assert.match(page, /data\.reviewTasks\.length/);
});

test("Active Advisees uses human-facing stage and review wording", () => {
  const page = read(PAGE);

  assert.match(page, /workspaceStageLabel\(advisee\.research\.currentStage\)/);
  assert.match(page, /openReviewLabel\(advisee\.review\.stages\)/);
  assert.match(page, /Adviser since/);
  assert.match(page, /Review pending/);

  assert.equal(workspaceStageLabel("TITLE"), "Title");
  assert.equal(workspaceStageLabel("PROPOSAL"), "Proposal");
  assert.equal(workspaceStageLabel("FINAL"), "Final");
  assert.equal(workspaceStageLabel(null), "Not set");
  assert.equal(workspaceStageLabel("UNKNOWN"), "Not set");

  assert.equal(openReviewLabel(["PROPOSAL"]), "Proposal review pending");
  assert.equal(openReviewLabel(["FINAL"]), "Final review pending");
  assert.equal(openReviewLabel([]), null);
});

test("historical Title Defense wording is not promoted to a current title", () => {
  const page = read(PAGE);

  // Active Advisee title comes only from research.workingTitle, which ADV-2
  // deliberately leaves null until a separate source exists.
  assert.match(page, /advisee\.research\.workingTitle/);
  assert.match(page, /label="Current title"/);
  assert.doesNotMatch(page, /workingTitle[^\n]*officialTitle/);
  assert.doesNotMatch(page, /request\.officialTitle[^\n]*Current title/);

  // Request historical wording is explicitly labelled as Title Defense context.
  assert.match(page, /label="Title Defense title"/);
  assert.match(page, /request\.officialTitle/);
});

test("review tasks use readable status labels, not raw enums", () => {
  const page = read(PAGE);

  assert.match(page, /adviserReviewStatusLabel\(task\.reviewStatus\)/);
  assert.equal(adviserReviewStatusLabel("AWAITING_REVIEW"), "Awaiting review");
  assert.equal(adviserReviewStatusLabel("CHANGES_REQUESTED"), "Changes requested");
  assert.equal(adviserReviewStatusLabel("ISSUED"), "Certification issued");

  assert.doesNotMatch(page, /task\.reviewStatus\}\s*<\/Badge>/);
});

test("the page exposes no raw internals or ambiguous detail affordances", () => {
  const page = read(PAGE);

  assert.doesNotMatch(page, /AdviserAssignment|ThesisRecord|Prisma|read model/i);
  assert.doesNotMatch(page, /View details/);
});

test("sidebar keeps My Advisees as the Adviser entry point", () => {
  const layout = read(LAYOUT);

  assert.match(layout, /href: "\/panelist\/advisees", label: "My Advisees"/);
  assert.match(layout, /href: "\/panelist\/defenses", label: "My Defenses"/);
  assert.doesNotMatch(layout, /href: "\/panelist\/adviser-requests"/);
  assert.doesNotMatch(layout, /href: "\/panelist\/adviser-reviews"/);

  // My Defenses active-route behavior remains untouched.
  assert.match(layout, /MY_DEFENSES_CONTEXT_ROUTES/);
  assert.match(layout, /href === "\/panelist\/defenses"/);
});

test("loading, error, and empty states are distinct", () => {
  const page = read(PAGE);

  assert.match(page, /isLoading \? <WorkspaceSkeleton/);
  assert.match(page, /Unable to load your advisees/);
  assert.match(page, /Try again/);
  assert.match(page, /No active advisees yet\./);
  assert.match(page, /No incoming adviser requests\./);
  assert.match(page, /No manuscript reviews need your attention\./);
});

test("deliberate workspace types replace raw persistence models", () => {
  const types = read(TYPES);

  assert.match(types, /interface AdviserWorkspaceDto/);
  assert.match(types, /activeAdvisees/);
  assert.match(types, /incomingRequests/);
  assert.match(types, /reviewTasks/);
  assert.match(types, /workingTitle: string \| null/);
  assert.doesNotMatch(types, /adviserAssignments|Prisma|ThesisRecord/);
});
