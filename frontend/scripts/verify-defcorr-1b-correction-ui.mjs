// DEF-CORR-1 Checkpoint B — Admin Manage Schedule & Committee UI.
//
// Run: node --test scripts/verify-defcorr-1b-correction-ui.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const read = (relative) => readFileSync(resolve(root, relative), "utf8");

const DETAIL =
  "src/components/admin/defense-scheduling/scheduled-defense-detail.tsx";
const EDITOR =
  "src/components/admin/defense-scheduling/scheduled-defense-correction-editor.tsx";
const REVIEW =
  "src/components/admin/defense-scheduling/defense-review-summary.tsx";
const TYPES = "src/components/admin/defense-scheduling/types.ts";
const PAGE = "src/app/(portal)/admin/thesis/scheduling/page.tsx";

test("Manage Schedule & Committee is visible only for the SCHEDULED lifecycle", () => {
  const detail = read(DETAIL);
  const page = read(PAGE);
  assert.match(detail, /Manage Schedule &(?:amp;)? Committee/);
  assert.match(detail, /sessionStatus\.toUpperCase\(\) === "SCHEDULED"/);
  assert.match(detail, /setEditingScheduleId\(refreshed\.data\.scheduleId\)/);
  assert.match(detail, /setEditingScheduleId\(null\)/);
  assert.match(page, /key=\{selectedScheduleId\}/);
});

test("edit mode reuses the accepted schedule, committee, and review components", () => {
  const detail = read(DETAIL);
  const editor = read(EDITOR);
  assert.match(editor, /DefenseScheduleForm/);
  assert.match(editor, /DefenseCommitteeBuilder/);
  assert.match(editor, /DefenseReviewSummary/);
  assert.match(detail, /ScheduledDefenseCorrectionEditor/);
});

test("the editor uses the exact schedule-scoped correction endpoint and payload", () => {
  const editor = read(EDITOR);
  assert.match(editor, /\/thesis\/defense\/schedules\/\$\{encodeURIComponent\(scheduleId\)\}/);
  assert.match(editor, /method: "PATCH"/);
  assert.match(editor, /defenseDate: schedule\.defenseDate/);
  assert.match(editor, /defenseTime: schedule\.defenseTime/);
  assert.match(editor, /venueOrLink: schedule\.venueOrLink\.trim\(\)/);
  assert.match(editor, /assignments: committee\.map/);
});

test("the correction payload never includes an Adviser seat", () => {
  const editor = read(EDITOR);
  assert.doesNotMatch(editor, /\.\.\.adviser/);
  assert.doesNotMatch(editor, /role: "ADVISER"\s*\}\s*,?\s*\]/);
  assert.match(editor, /committee\.map\(\(member\) => \(\{/);
});

test("Proposal/Final Adviser is derived and displayed as Automatic; Title has no Adviser", () => {
  const editor = read(EDITOR);
  const builder = read(
    "src/components/admin/defense-scheduling/defense-committee-builder.tsx",
  );
  assert.match(editor, /detail\.defenseType !== "TITLE_DEFENSE"/);
  assert.match(editor, /role === "ADVISER"/);
  assert.match(editor, /isDerivedAdviser: true/);
  assert.match(editor, /showAdviser=\{showAdviser\}/);
  assert.match(builder, /Automatic/);
});

test("the editor preloads exact current schedule and active committee values", () => {
  const editor = read(EDITOR);
  assert.match(editor, /scheduleFormFromDetail\(detail\)/);
  assert.match(editor, /detail\.committee/);
  assert.match(editor, /role !== "ADVISER"/);
  assert.match(editor, /useState<ScheduleFormState>/);
});

test("Save requires a focused confirmation, real changes, and Cancel discards the draft", () => {
  const editor = read(EDITOR);
  assert.match(editor, /Save Changes/);
  assert.match(editor, /Dialog open=\{showConfirm\}/);
  assert.match(editor, /onCancel/);
  assert.match(editor, /const hasChanges =/);
  assert.match(editor, /const canSave = isValid && hasChanges/);
  assert.match(editor, /isValid=\{canSave\}/);
  assert.doesNotMatch(editor, /Reason|reason:/);
});

test("success refreshes the exact selected schedule and affected lists without navigation", () => {
  const editor = read(EDITOR);
  assert.match(editor, /queryKey: \["scheduledDefenseDetail", scheduleId\]/);
  assert.match(editor, /queryKey: \["scheduledDefenseApplications"\]/);
  assert.match(editor, /queryKey: \["schedulingWorkflowSummary"\]/);
  assert.match(editor, /onSaved/);
  assert.doesNotMatch(editor, /router\.(push|replace)/);
});

test("backend validation errors are surfaced and lifecycle conflicts refresh the detail", () => {
  const editor = read(EDITOR);
  const detail = read(DETAIL);
  assert.match(editor, /failure instanceof ApiError/);
  assert.match(editor, /statusCode === 409/);
  assert.match(editor, /onLifecycleConflict/);
  assert.match(editor, /role="alert"/);
  assert.match(detail, /detailQuery\.refetch\(\)/);
  assert.match(detail, /sessionStatus\.toUpperCase\(\) !== "SCHEDULED"/);
});

test("no audit timeline or notification refinement is included", () => {
  const editor = read(EDITOR);
  assert.doesNotMatch(editor, /AuditLog|auditLog|audit history/i);
  assert.doesNotMatch(editor, /EmailPreviewDialog|Preview Notification|sendTemplateEmail/);
});

test("shared schedule helpers keep initial scheduling and correction validation aligned", () => {
  const types = read(TYPES);
  const page = read(PAGE);
  const review = read(REVIEW);
  assert.match(types, /export function scheduleFormFromDetail/);
  assert.match(types, /export function validateScheduleForm/);
  assert.match(page, /validateScheduleForm\(schedule\)/);
  assert.match(review, /submitLabel/);
  assert.match(review, /onPreviewEmail\?/);
});
