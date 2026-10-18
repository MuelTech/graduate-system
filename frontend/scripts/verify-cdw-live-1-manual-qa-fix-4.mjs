// CDW-LIVE-1 MANUAL-QA FIX-4 — institutional Oral Examination Summary presentation.
//
// Run: node --experimental-strip-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/verify-cdw-live-1-manual-qa-fix-4.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { DEFENSE_REALTIME_EVENT_NAMES } from "../src/lib/realtime/defense-realtime-events.ts";

const root = process.cwd();
const read = (relative) => readFileSync(resolve(root, relative), "utf8");

const ADMIN =
  "src/app/(portal)/admin/thesis/defense-records/[scheduleId]/page.tsx";
const BACKEND_SUMMARY = "../backend/src/services/official-defense-record.service.ts";
const BACKEND_ROUNDING = "../backend/src/services/academic-number.rules.ts";
const BACKEND_INSTITUTIONAL =
  "../backend/src/services/oral-evaluation.institutional.rules.ts";

test("institutional Summary rows render Group A, Group B, and Average", () => {
  const admin = read(ADMIN);

  assert.match(admin, /isInstitutionalSummary \? "Group A" : "Group I"/);
  assert.match(admin, /isInstitutionalSummary \? "Group B" : "Group II"/);
  assert.match(admin, /isInstitutionalSummary \? "Average" : "Overall"/);
  assert.match(admin, /r\.averageValue/);
});

test("institutional Summary values render at exactly two decimals", () => {
  const admin = read(ADMIN);

  assert.match(admin, /function formatInstitutionalValue/);
  assert.match(admin, /value\.toFixed\(2\)/);
  assert.match(admin, /formatInstitutionalValue\(r\.groupIValue\)/);
  assert.match(admin, /formatInstitutionalValue\(r\.groupIIValue\)/);
  assert.match(admin, /formatInstitutionalValue\(r\.averageValue\)/);
});

test("internal overall average is distinguished from a formal Rating", () => {
  const admin = read(ADMIN);

  assert.match(admin, /"Internal Average"/);
  assert.match(admin, /data\.oralExamSummary\.finalRating \?\? "Not assigned"/);
  assert.doesNotMatch(admin, /finalRating\s*\?\?\s*"(Excellent|Satisfactory|Fail)"/);
});

test("legacy Group I / Group II / Overall presentation remains available", () => {
  const admin = read(ADMIN);

  assert.match(admin, /"Group I"/);
  assert.match(admin, /"Group II"/);
  assert.match(admin, /"Overall"/);
  assert.match(admin, /r\.overallValue/);
});

test("Download / Print remains disabled and has no fake print or PDF path", () => {
  const admin = read(ADMIN);

  assert.match(admin, /function DownloadPrintButton/);
  assert.match(admin, /disabled/);
  assert.doesNotMatch(admin, /window\.print\(\);/);
  assert.doesNotMatch(admin, /import .*jspdf|import .*pdf-lib/i);
  assert.doesNotMatch(admin, /onClick=.*print/i);
});

test("backend uses the shared decimal-safe rounding helpers", () => {
  const summary = read(BACKEND_SUMMARY);
  const rounding = read(BACKEND_ROUNDING);

  assert.match(summary, /meanAcademicValues/);
  assert.match(summary, /roundAcademicValue/);
  assert.match(rounding, /Prisma\.Decimal\.ROUND_HALF_UP/);
  assert.match(rounding, /toDecimalPlaces/);
  assert.doesNotMatch(rounding, /Number\([^)]*\)\.toFixed\(2\)/);
});

test("stale institutional Overall/Rating blocker is removed", () => {
  const summary = read(BACKEND_SUMMARY);

  assert.doesNotMatch(summary, /institutional Overall\/Rating formula is not confirmed/i);
  assert.match(summary, /summaryScoringVersion === INSTITUTIONAL_MATRIX_V2/);
  assert.match(summary, /averageValue/);
});

test("institutional Summary fails closed on missing row values and mixed versions", () => {
  const summary = read(BACKEND_SUMMARY);

  assert.match(summary, /missing a Group I or Group II average/);
  assert.match(summary, /mixed scoring versions/);
  assert.match(summary, /missing an overall average/);
});

test("group averages are normalized to two decimals by the institutional rules", () => {
  const rules = read(BACKEND_INSTITUTIONAL);

  assert.match(rules, /meanAcademicValues\(values\)/);
  assert.match(rules, /exactly two decimal places/i);
});

test("FIX-4 adds no persisted realtime event", () => {
  assert.equal(DEFENSE_REALTIME_EVENT_NAMES.length, 9);
  assert.ok(
    !DEFENSE_REALTIME_EVENT_NAMES.some((name) => /summary/i.test(name)),
  );
});
