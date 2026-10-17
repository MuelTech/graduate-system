// CDW-4 — immersive Defense Workspace + evaluator UX (source contracts + rules).
//
// Run: node --experimental-strip-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/verify-cdw4-workspace.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const read = (relative) => readFileSync(resolve(root, relative), "utf8");

const LAYOUT = "src/app/(portal)/panelist/layout.tsx";
const SHELL = "src/components/defense-workspace/workspace-shell.tsx";
const HEADER = "src/components/defense-workspace/compact-workspace-header.tsx";
const ROLE_RAIL = "src/components/defense-workspace/role-rail.tsx";
const REPORT = "src/components/defense-workspace/committee-report-panel.tsx";
const PROVIDER = "src/components/defense-workspace/student-document-collaboration.tsx";
const PAGE = "src/app/(portal)/panelist/defense-workspace/[scheduleId]/page.tsx";

test("the immersive shell components exist", () => {
  for (const file of [SHELL, HEADER, ROLE_RAIL, REPORT, PROVIDER]) {
    assert.equal(existsSync(resolve(root, file)), true, `${file} should exist`);
  }
});

test("the Defense Workspace route is sidebar-free focus mode; other routes keep the portal", () => {
  const layout = read(LAYOUT);
  assert.match(layout, /pathname\.startsWith\("\/panelist\/defense-workspace"\)/);
  // The portal nav still exists for the non-immersive branch.
  assert.match(layout, /Panelist Portal/);
  assert.match(layout, /navItems/);
});

test("center exposes Committee Report + Student Document; Final adds Proposal Context", () => {
  const shell = read(SHELL);
  assert.match(shell, /Committee Report/);
  assert.match(shell, /Student Document/);
  assert.match(shell, /Proposal Context/);
  // Reuses the accepted collaboration panes (no duplicated annotation querying).
  assert.match(shell, /CollaborationViewerPane/);
  assert.match(shell, /CollaborationRailPane/);
});

test("left + right rails are independently collapsible and have responsive drawers", () => {
  const shell = read(SHELL);
  assert.match(shell, /leftCollapsed/);
  assert.match(shell, /rightCollapsed/);
  assert.match(shell, /lg:hidden/); // mobile drawer triggers
  assert.match(shell, /lg:block/); // desktop columns
  assert.match(shell, /leftDrawer/);
  assert.match(shell, /rightDrawer/);
  // Collapse is presentation-only: no evaluation/collaboration mutation controls here.
  assert.doesNotMatch(shell, /useMutation|startDefense|createAnnotation/);
});

test("compact header carries the required context", () => {
  const header = read(HEADER);
  for (const token of ["My Defenses", "studentNumber", "program", "defenseDate", "defenseTime", "venueOrLink", "sessionStatus", "myAssignment"]) {
    assert.match(header, new RegExp(token));
  }
});

test("role rail is role-aware: evaluation only for evaluators; Start Defense only for Chairman", () => {
  const rail = read(ROLE_RAIL);
  assert.match(rail, /OralEvaluationForm/);
  assert.match(rail, /canStartDefense/);
  assert.match(rail, /evaluationOpen/);
  // Rapporteur report status; Adviser/Facilitator info only.
  assert.match(rail, /RAPPORTEUR/);
  assert.match(rail, /Freeze for Signatures/);
});

test("Committee Report tab gates authoring on canEditBody (CDW-5 authoring surface)", () => {
  const report = read(REPORT);
  assert.match(report, /canEditBody/);
  assert.match(report, /read-only|ReadOnly/);
  assert.match(report, /ReportDocumentView/);
});

test("page composes the shell and provides the exact attempt document to collaboration", () => {
  const page = read(PAGE);
  assert.match(page, /WorkspaceShell/);
  assert.match(page, /StudentDocumentCollaboration/);
  assert.match(page, /documentId=\{primaryDoc\.id\}/);
  assert.doesNotMatch(page, /documents\/latest|latestDocument/i);
});

test("the workspace adds RAP-C1 freeze/signing without any realtime layer", () => {
  const combined = read(SHELL) + read(ROLE_RAIL) + read(REPORT);
  assert.doesNotMatch(combined, /socket\.io|Socket\.IO/i);
  // RAP-C1: the Committee Report freeze + required-signature lifecycle now lives
  // in the workspace files (previously deferred from CDW-5).
  assert.match(combined, /FOR_SIGNATURE/);
});
