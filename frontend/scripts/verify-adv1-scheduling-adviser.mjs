// ADV-1 — Admin Scheduling current active-Adviser authority.
//
// Run: node --test scripts/verify-adv1-scheduling-adviser.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const read = (relative) => readFileSync(resolve(root, relative), "utf8");

const SCHEDULING = "src/app/(portal)/admin/thesis/scheduling/page.tsx";
const APPLICATION_DETAIL =
  "src/app/(portal)/admin/thesis/applications/[id]/page.tsx";
const BUILDER =
  "src/components/admin/defense-scheduling/defense-committee-builder.tsx";
const TYPES = "src/types/index.ts";
const APPLICATION_REPO =
  "../backend/src/repositories/defense-applications.repository.ts";
const THESIS_REPO = "../backend/src/repositories/thesis.repository.ts";
const THESIS_SERVICE = "../backend/src/services/thesis.service.ts";
const ADVISER_RULES = "../backend/src/services/active-adviser.rules.ts";

test("Scheduling reads the explicit active-Adviser projection, not legacy assignment", () => {
  const scheduling = read(SCHEDULING);

  assert.match(scheduling, /selected\.activeAdviser/);
  assert.match(scheduling, /selected\.stage === "TITLE"/);
  assert.doesNotMatch(scheduling, /selected\.assignment\?\.adviser/);

  // The derived seat is still submitted with the manual roster.
  assert.match(
    scheduling,
    /\[\.\.\.manual, \{ userId: adviser\.userId, role: "ADVISER" as const \}\]/,
  );
});

test("Scheduling surfaces duplicate-active-Adviser data as a blocked state", () => {
  const scheduling = read(SCHEDULING);
  const builder = read(BUILDER);

  assert.match(
    scheduling,
    /adviserConflict=\{selected\.activeAdviserConflict === true\}/,
  );
  assert.match(builder, /adviserConflict\?: boolean/);
  assert.match(builder, /Multiple active advisers recorded/);
});

test("Adviser row remains locked, automatic, and uses concise faculty wording", () => {
  const builder = read(BUILDER);

  assert.match(builder, /role="Adviser"/);
  assert.match(builder, /secondary="Active thesis adviser"/);
  assert.match(builder, /Automatic/);
  assert.match(builder, /adviser \? "1 \/ 1" : "0 \/ 1"/);
  assert.match(builder, /Active thesis adviser not found/);
  // No Adviser picker/action is rendered for the derived seat.
  assert.doesNotMatch(
    builder,
    /role="Adviser"[\s\S]{0,500}onClick=\{\(\) => setActiveRole\("ADVISER"\)\}/,
  );
});

test("frontend DTO keeps legacy compatibility data but adds explicit active Adviser", () => {
  const types = read(TYPES);

  assert.match(types, /activeAdviser\?: \{/);
  assert.match(types, /assignmentId: string;/);
  assert.match(types, /userId: string;/);
  assert.match(types, /activeAdviserConflict\?: boolean;/);
  // Legacy field is preserved for other consumers in ADV-1.
  assert.match(
    types,
    /assignment\?: \{[\s\S]{0,200}adviser\?: \{ id: string; firstName: string; lastName: string \} \| null;/,
  );
});

test("Defense Application detail uses the same active-Adviser projection", () => {
  const detail = read(APPLICATION_DETAIL);

  assert.match(detail, /const adviser = app\.activeAdviser;/);
  assert.doesNotMatch(detail, /app\.assignment\?\.adviser/);
  assert.doesNotMatch(
    detail,
    /not automatically a defense\s+committee seat/i,
  );
});

test("backend read model resolves the Student's active AdviserAssignment", () => {
  const repo = read(APPLICATION_REPO);

  assert.match(repo, /adviserAssignments: \{[\s\S]{0,250}where: \{ isActive: true \}/);
  assert.match(repo, /projectActiveAdviser\(row\.student\)/);
  assert.match(repo, /activeAdviserConflict/);
  assert.match(repo, /assignment: row\.assignment/);
});

test("server-side scheduling re-resolves one active Adviser and ignores it for Title", () => {
  const service = read(THESIS_SERVICE);
  const repo = read(THESIS_REPO);
  const rules = read(ADVISER_RULES);

  assert.match(service, /defenseType !== 'TITLE_DEFENSE'/);
  assert.match(service, /getActiveAdviserAssignment\(snap\.studentId\)/);
  assert.match(service, /Proposal\/Final Defense cannot be scheduled without an active thesis adviser/);
  assert.match(
    service,
    /active Adviser as the required automatic Adviser\s+\/\/ committee participant/,
  );

  assert.match(repo, /adviserAssignment\.findMany/);
  assert.match(repo, /requireSingleActiveAdviser\(active\)/);

  assert.match(rules, /status: "CONFLICT"/);
  assert.match(rules, /new AppError\(MULTIPLE_ACTIVE_ADVISERS_MESSAGE, 409\)/);
  assert.doesNotMatch(rules, /orderBy|assignedDate|findFirst/);
});
