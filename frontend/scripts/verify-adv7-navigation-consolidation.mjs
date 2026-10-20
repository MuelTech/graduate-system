// ADV-7 — Panelist Adviser navigation and compatibility redirects.
// Run from frontend: node scripts/verify-adv7-navigation-consolidation.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), "utf8");
const layout = read("src/app/(portal)/panelist/layout.tsx");
const requestsPath = "src/app/(portal)/panelist/adviser-requests/page.tsx";
const reviewsPath = "src/app/(portal)/panelist/adviser-reviews/page.tsx";
const dashboard = read("../backend/src/services/panelist-dashboard.rules.ts");

test("My Advisees is the sole Adviser sidebar entry without reordering other items", () => {
  const labels = [...layout.matchAll(/\{ href: "\/panelist\/[^"]+", label: "([^"]+)"/g)]
    .map((match) => match[1]);
  assert.deepEqual(labels, [
    "Dashboard", "Profile", "My Defenses", "My Advisees",
    "E-Signatures", "Repository", "Announcements", "Notifications",
  ]);
  assert.doesNotMatch(layout, /href: "\/panelist\/adviser-(?:requests|reviews)"/);
});

test("legacy Adviser Requests index is a server-only redirect", () => {
  assert.ok(existsSync(resolve(root, requestsPath)));
  assert.match(
    read(requestsPath),
    /^import \{ redirect \} from "next\/navigation";\s+export default function \w+\(\) \{\s+redirect\("\/panelist\/advisees\?tab=requests"\);\s+\}\s*$/,
  );
});

test("legacy Adviser Reviews index is a server-only redirect", () => {
  assert.ok(existsSync(resolve(root, reviewsPath)));
  assert.match(
    read(reviewsPath),
    /^import \{ redirect \} from "next\/navigation";\s+export default function \w+\(\) \{\s+redirect\("\/panelist\/advisees\?tab=reviews"\);\s+\}\s*$/,
  );
});

test("legacy routes do not fetch, mutate, render, or inspect exact task IDs", () => {
  for (const path of [requestsPath, reviewsPath]) {
    assert.doesNotMatch(
      read(path),
      /use client|useQuery|useMutation|apiClientRequest|fetch\(|requestId|thesisId|AdviserReviewActionPanel|AdviserRequestActionDialog|return\s*\(|<[\w]/,
    );
  }
});

test("My Advisees base and nested routes keep generic active matching", () => {
  assert.match(layout, /return pathname === href \|\| pathname\.startsWith\(\x60\$\{href\}\/\x60\);/);
  assert.match(layout, /href: "\/panelist\/advisees", label: "My Advisees"/);
});

test("My Defenses special active-route family remains intact", () => {
  for (const path of [
    "/panelist/defenses", "/panelist/defense-workspace",
    "/panelist/scoring", "/panelist/defense-lobby", "/panelist/materials",
  ]) {
    assert.ok(layout.includes('"' + path + '"'));
  }
  assert.match(layout, /if \(href === "\/panelist\/defenses"\)/);
  assert.match(layout, /pathname === base \|\| pathname\.startsWith\(\x60\$\{base\}\/\x60\)/);
});

test("Dashboard Adviser deep links retain exact request and review context", () => {
  assert.match(dashboard, /return \x60\/panelist\/advisees\?tab=requests&requestId=\$\{encodeURIComponent\(requestId\)\}\x60/);
  assert.match(dashboard, /return \x60\/panelist\/advisees\?tab=reviews&stage=\$\{encodeURIComponent\(stage\)\}&thesisId=\$\{encodeURIComponent\(thesisId\)\}\x60/);
  assert.match(dashboard, /href: adviserRequestHref\(r\.id\)/);
  assert.match(dashboard, /href: adviserReviewHref\(t\.stage, t\.thesisId\)/);
});

test("unrelated Dashboard links and ADV-8 boundary remain unchanged", () => {
  assert.match(dashboard, /return \x60\/panelist\/defense-workspace\/\$\{scheduleId\}\x60/);
  assert.match(dashboard, /href: "\/panelist\/signatures"/);
  for (const source of [layout, read(requestsPath), read(reviewsPath)]) {
    assert.doesNotMatch(source, /ADV-8|adv8/i);
  }
});