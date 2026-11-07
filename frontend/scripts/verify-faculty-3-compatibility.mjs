// Runtime checks of the real compatibility readers/middleware. No live account/data mutation.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function load(path, dependencies = {}, globals = {}) {
  const source = ts.transpileModule(readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(source, { exports, require(name) {
    if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`);
    return dependencies[name];
  }, AbortSignal, URL, console: { log() {} }, ...globals });
  return exports;
}
const roles = load("lib/account-role.ts");
class NextResponse {
  constructor(body, options) { this.body = body; this.status = options.status; }
  static redirect(url) { return { redirect: url.pathname }; }
  static next() { return { allowed: true }; }
}
const gate = load("middleware.ts", {
  "@/auth": { auth: handler => handler }, "next/server": { NextResponse }, "@/lib/account-role": roles,
}).default;
const token = { id: "academic-1", role: "admin", accessToken: "synthetic", mustChangePassword: false };

for (const storedRole of ["PANELIST", "FACULTY"]) {
  test(`${storedRole} synchronizes current identity, removes stale Admin routing, retains /panelist deep links`, async () => {
    const { synchronizeCurrentSession } = load("lib/current-session.ts", {}, { fetch: async () => new Response(JSON.stringify({
      user: { id: "academic-1", email: "synthetic@example.test", role: storedRole, mustChangePassword: false },
    }), { status: 200 }) });
    const current = await synchronizeCurrentSession(token, "http://backend");
    assert.equal(current.role, storedRole.toLowerCase()); assert.equal(current.accessToken, token.accessToken);
    for (const path of ["/panelist/dashboard", "/panelist/adviser-workspace", "/panelist/defense-workspace/schedule-1", "/panelist/announcements"]) {
      assert.equal(gate({ auth: { user: current }, nextUrl: { pathname: path }, url: "http://frontend" }), undefined);
    }
    for (const path of ["/admin/dashboard", "/student/dashboard", "/applicant/dashboard"]) {
      assert.equal(gate({ auth: { user: current }, nextUrl: { pathname: path }, url: "http://frontend" }).redirect, "/panelist/dashboard");
    }
    current.mustChangePassword = true;
    assert.equal(gate({ auth: { user: current }, nextUrl: { pathname: "/panelist/dashboard" }, url: "http://frontend" }).redirect, "/change-password");
    assert.equal(gate({ auth: { user: current }, nextUrl: { pathname: "/change-password" }, url: "http://frontend" }).allowed, true);
    assert.equal(roles.isAcademicAccountRole(storedRole), true);
  });
}
for (const role of ["admin", "custom", "applicant", "student"]) {
  test(`${role} cannot enter the academic portal`, () => {
    assert.equal(roles.isAcademicAccountRole(role.toUpperCase()), false);
    const result = gate({ auth: { user: { ...token, role } }, nextUrl: { pathname: "/panelist/dashboard" }, url: "http://frontend" });
    assert.equal(result.redirect, `/${role}/dashboard`);
  });
}
test("notification links use the academic helper and retained technical paths", () => {
  const bell = readFileSync(new URL("../src/components/layout/notification-bell.tsx", import.meta.url), "utf8");
  assert.equal((bell.match(/isAcademicAccountRole\(role\)/g) ?? []).length, 2);
  assert.match(bell, /"FACULTY"/); assert.match(bell, /\/panelist\/notifications/); assert.match(bell, /\/panelist\/announcements/);
});
test("defense assignment type remains separate from account identity", () => {
  const source = readFileSync(new URL("../src/types/index.ts", import.meta.url), "utf8");
  const union = source.match(/export type DefensePanelRole =([^;]+);/)[1];
  assert.match(union, /"PANELIST"/); assert.doesNotMatch(union, /FACULTY/);
});
