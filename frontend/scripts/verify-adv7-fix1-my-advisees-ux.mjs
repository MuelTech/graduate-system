// ADV-7 FIX-1 — My Advisees current-workflow and navigation refinement.
// Run from frontend: node --test scripts/verify-adv7-fix1-my-advisees-ux.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  isActionableAdviserRequest,
  isCurrentAdviserRequest,
} from "../src/lib/panelist-adviser-requests.ts";

const read = (path) => readFileSync(resolve(process.cwd(), path), "utf8");
const page = read("src/components/panelist/my-advisees-workspace.tsx");
const tab = (value) =>
  page.match(
    new RegExp(`<TabsTrigger\\s+value="${value}"[\\s\\S]*?<\\/TabsTrigger>`),
  )?.[0];
const activeCard = page.slice(
  page.indexOf("function ActiveAdviseeCard"),
  page.indexOf("function IncomingRequestCard"),
);

const request = (status, adviserStatus, deanStatus) => ({
  status,
  adviserStatus,
  deanStatus,
});

test("current request projection keeps only awaiting Adviser and awaiting Dean", () => {
  const rows = [
    request("PENDING", "PENDING", "PENDING"),
    request("CONFORMED", "CONFORMED", "PENDING"),
    request("APPROVED", "CONFORMED", "APPROVED"),
    request("REJECTED", "CONFORMED", "REJECTED"),
    request("DECLINED", "DECLINED", "PENDING"),
    request("APPROVED", "PENDING", "PENDING"),
  ];
  assert.deepEqual(rows.filter(isCurrentAdviserRequest), rows.slice(0, 2));
  assert.deepEqual(rows.filter(isActionableAdviserRequest), rows.slice(0, 1));
  assert.equal(
    rows.filter(isCurrentAdviserRequest).filter(isActionableAdviserRequest)
      .length,
    1,
  );
  assert.match(
    page,
    /data\?\.incomingRequests\.filter\(isCurrentAdviserRequest\)/,
  );
  assert.match(page, /incomingRequests\.map\(\(request\) =>/);
  assert.match(page, /incomingRequests\.length === 0/);
});

test("Active Advisees has no counter and zero workload badges are hidden", () => {
  assert.ok(tab("active"));
  assert.doesNotMatch(tab("active"), /<Badge|\.length|WorkloadCount/);
  assert.match(tab("requests"), /requestWorkloadCount > 0 \?\s*\(\s*<Badge/);
  assert.match(tab("reviews"), /reviewWorkloadCount > 0 \?\s*\(\s*<Badge/);
  assert.doesNotMatch(page, /<Badge[^>]*>0<\/Badge>/);
});

test("badge counts follow current workflow, not tab visits or raw records", () => {
  assert.match(
    page,
    /incomingRequests\.filter\(\s*isActionableAdviserRequest,?\s*\)\.length/,
  );
  assert.match(page, /reviewStatus === "AWAITING_REVIEW"/);
  const tabChange = page.slice(
    page.indexOf("const handleTabChange"),
    page.indexOf("const openRequestAction"),
  );
  assert.match(tabChange, /setContext\(value\)/);
  assert.doesNotMatch(
    tabChange,
    /set.*Count|markAsRead|readAt|invalidateQueries/,
  );
});

test("tabs have a connected navigation rail and strong readable active states", () => {
  assert.match(page, /<TabsList\s+variant="line"[\s\S]*?border-b/);
  for (const value of ["active", "requests", "reviews"]) {
    const trigger = tab(value);
    assert.match(trigger, /text-\(--earist-secondary\)/);
    assert.match(trigger, /data-active:bg-\(--earist-primary\)\/10/);
    assert.match(trigger, /data-active:text-\(--earist-primary\)/);
    assert.match(trigger, /data-active:after:bg-\(--earist-primary\)/);
  }
  assert.match(page, /sm:grid-cols-3/);
});

test("Active Advisee has a prominent primary detail action", () => {
  assert.match(activeCard, /text-lg font-semibold/);
  assert.match(activeCard, /Research stage/);
  assert.match(activeCard, /Adviser since/);
  assert.match(
    activeCard,
    /min-h-11 w-full bg-\(--earist-primary\) px-5 font-semibold/,
  );
  assert.match(activeCard, /sm:flex-row/);
  assert.match(
    activeCard,
    /href=\{`\/panelist\/advisees\/\$\{advisee\.student\.id\}`\}/,
  );
  assert.match(activeCard, /Open Advisee/);
});

test("legacy routes, dashboard deep links, and My Defenses matching remain intact", () => {
  const legacyRequests = read(
    "src/app/(portal)/panelist/adviser-requests/page.tsx",
  );
  const legacyReviews = read(
    "src/app/(portal)/panelist/adviser-reviews/page.tsx",
  );
  const dashboard = read("../backend/src/services/panelist-dashboard.rules.ts");
  const layout = read("src/app/(portal)/panelist/layout.tsx");
  assert.match(
    legacyRequests,
    /redirect\("\/panelist\/advisees\?tab=requests"\)/,
  );
  assert.match(
    legacyReviews,
    /redirect\("\/panelist\/advisees\?tab=reviews"\)/,
  );
  assert.match(dashboard, /advisees\?tab=requests&requestId=/);
  assert.match(dashboard, /advisees\?tab=reviews&stage=.*thesisId=/);
  assert.match(layout, /if \(href === "\/panelist\/defenses"\)/);
});

test("workspace visible copy does not expose persistence terms", () => {
  assert.doesNotMatch(
    page,
    />\s*(?:AdviserAssignment|assignmentId|reviewedDocumentId|Prisma|ThesisRecord)\s*</,
  );
});
