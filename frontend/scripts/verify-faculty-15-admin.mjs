import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
const source = (path) =>
  readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");
function load(code, dependencies = {}) {
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(code, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    {
      exports,
      Set,
      Error,
      require: (name) => {
        if (name in dependencies) return dependencies[name];
        throw Error(`Unexpected dependency ${name}`);
      },
    },
  );
  return exports;
}
const catalog = load(
  readFileSync(
    new URL("../../backend/src/access/capability-catalog.ts", import.meta.url),
    "utf8",
  ),
);
const { ApiError } = load(source("lib/api-error.ts"));
const a = load(source("lib/admin-access.ts"), {
  "../../../backend/src/access/capability-catalog": catalog,
  "./api-error": { ApiError },
});
const dto = (keys = [], level = "RESTRICTED") => ({
  user: {
    id: "self",
    email: "self@example.test",
    role: "ADMIN",
    mustChangePassword: false,
  },
  configuredAccess: {
    status: "RESOLVED",
    administratorLevel: level,
    capabilities: keys,
  },
  directAccessEnforcementEnabled: false,
});
const parse = (keys = [], level) => a.readAdminAccess(dto(keys, level), "self");
const full = () => parse([...catalog.FULL_ADMINISTRATOR_CAPABILITIES], "FULL");
const plain = (value) => JSON.parse(JSON.stringify(value));
test("presentation labels cover exactly the one backend Admin catalog", () => {
  assert.deepEqual(
    Object.keys(a.ADMIN_CAPABILITY_LABELS).sort(),
    plain(catalog.FULL_ADMINISTRATOR_CAPABILITIES).sort(),
  );
  assert.equal(
    a.ADMIN_GRANTABLE_KEYS.includes("administrator_access.manage"),
    false,
  );
  assert.equal(a.ADMIN_GRANTABLE_KEYS.includes("essay.evaluate"), false);
});
test("Full requires the exact enumerated catalog; no level-only shortcut", () => {
  assert.equal(a.fullAdministrator(full()), true);
  for (const keys of [
    [],
    ["administrator_access.manage"],
    [...catalog.FULL_ADMINISTRATOR_CAPABILITIES, "*"],
    [...catalog.FULL_ADMINISTRATOR_CAPABILITIES, "essay.evaluate"],
  ])
    assert.throws(() => parse(keys, "FULL"));
});
test("zero-grant Restricted is a safe landing with no management or aggregates", () => {
  const access = parse();
  assert.equal(a.adminRouteAllowed(access, "/admin/dashboard"), true);
  for (const path of [
    "/admin/users/administrators",
    "/admin/users/administrators/guessed",
    "/admin/users/roles",
    "/admin/analytics",
    "/admin/settings",
    "/admin/unknown",
  ])
    assert.equal(a.adminRouteAllowed(access, path), false, path);
  assert.equal(a.canRequestDashboard(access), false);
});
for (const key of a.ADMIN_GRANTABLE_KEYS)
  test(`direct ${key} cannot confer Full or academic authority`, () => {
    const keys = catalog.expandCapabilityPrerequisites([key]);
    const access = parse(keys);
    assert.equal(a.fullAdministrator(access), false);
    assert.equal(a.adminAllows(access, "administrator_access.manage"), false);
    assert.deepEqual(plain(a.directAdminKeys([key])), [key]);
    for (const destination of a.ADMIN_DESTINATIONS.filter(
      (d) => d.capability === key && d.href !== "/admin/settings",
    ))
      assert.equal(a.adminRouteAllowed(access, destination.href), true);
  });
test("missing prerequisites, duplicate, unknown and Faculty grants fail closed", () => {
  for (const keys of [
    ["exam.results.finalize"],
    ["students.view", "students.view"],
    ["new.unknown"],
    ["essay.evaluate"],
    ["administrator_access.manage"],
    ["constructor"],
    [null],
  ])
    assert.throws(() => parse(keys));
});
test("unmapped/invalid accounts never fall back to Full even with legacy gates off", () => {
  for (const status of [
    "MISSING_ADMIN_LEVEL",
    "INVALID_CONFIGURATION",
    "UNAVAILABLE",
    "INACTIVE",
  ]) {
    const value = dto(catalog.FULL_ADMINISTRATOR_CAPABILITIES, "FULL");
    value.configuredAccess.status = status;
    const access = a.readAdminAccess(value, "self");
    assert.equal(a.fullAdministrator(access), false);
    assert.equal(access.capabilities.length, 0);
  }
});
test("identity/category/password/malformed access cannot reuse session claims", () => {
  for (const change of [
    (v) => (v.user.id = "other"),
    (v) => (v.user.role = "FACULTY"),
    (v) => (v.user.mustChangePassword = true),
    (v) => (v.configuredAccess = null),
    (v) => (v.configuredAccess.administratorLevel = "OTHER"),
    (v) => (v.configuredAccess.capabilities = null),
  ]) {
    const value = dto();
    change(value);
    assert.throws(() => a.readAdminAccess(value, "self"));
  }
});
test("partial Dashboard never requests the dormant broad aggregate", () => {
  for (const missing of a.DASHBOARD_READ_KEYS)
    assert.equal(
      a.canRequestDashboard(
        parse(a.DASHBOARD_READ_KEYS.filter((key) => key !== missing)),
      ),
      false,
    );
  assert.equal(a.canRequestDashboard(parse(a.DASHBOARD_READ_KEYS)), true);
  assert.equal(a.canRequestDashboard(full()), true);
  const code = source("app/(portal)/admin/dashboard/page.tsx");
  assert.match(
    code,
    /if \(canRequestDashboard\(access\)\) return <AuthorizedDashboard/,
  );
});
test("route boundaries and aliases cannot bypass exact grants", () => {
  const access = parse(["exam.records.view"]);
  assert.equal(
    a.adminRouteAllowed(access, "/admin/exam/applications/one"),
    true,
  );
  assert.equal(a.adminRouteAllowed(access, "/admin/exam/scores"), true);
  assert.equal(
    a.adminRouteAllowed(access, "/admin/exam/applications-override"),
    false,
  );
  for (const key of [
    "audit.view",
    "email.logs.view",
    "email.configuration.manage",
    "exam.configuration.manage",
  ])
    assert.equal(a.adminRouteAllowed(parse([key]), "/admin/settings"), true);
  assert.equal(
    a.adminRouteAllowed(
      parse(["storage.health.view"]),
      "/admin/settings/storage",
    ),
    true,
  );
  assert.equal(
    a.adminRouteAllowed(parse(["settings.view"]), "/admin/settings/storage"),
    false,
  );
});
test("unmapped/invalid Administrator records stay read-only; inactive mapped records remain editable", () => {
  const account = {
    id: "target",
    role: "ADMIN",
    email: "target@example.test",
    firstName: "Alex",
    lastName: "Example",
    isActive: true,
    mustChangePassword: false,
    level: null,
    capabilityKeys: [],
    configuredAccess: { status: "MISSING_ADMIN_LEVEL" },
  };
  assert.equal(a.readAdministrator(account).managed, false);
  assert.equal(
    a.readAdministrator({
      ...account,
      level: "FULL",
      configuredAccess: { status: "INVALID_CONFIGURATION" },
    }).managed,
    false,
  );
  assert.equal(
    a.readAdministrator({
      ...account,
      level: "RESTRICTED",
      isActive: false,
      configuredAccess: { status: "INACTIVE" },
    }).managed,
    true,
  );
});
test("last-Full conflicts retain exact safe feedback; internal errors are not displayed", () => {
  assert.equal(
    a.administratorError(
      new ApiError("At least one active Full Administrator must remain.", 409),
    ),
    "At least one active Full Administrator must remain.",
  );
  assert.equal(
    a.administratorError(new ApiError("sql-secret", 503)),
    "Administrators Management is temporarily unavailable. Try again.",
  );
  assert.equal(
    a.administratorError(new Error("sql-secret")).includes("sql-secret"),
    false,
  );
});
test("private operational clients clear on account/access change and unavailable reads", () => {
  const code = source("components/admin/access/admin-access-provider.tsx");
  assert.match(code, /key=\{session.user.id\}/);
  assert.match(code, /WorkspaceQueries key=\{fingerprint\}/);
  assert.match(code, /client.clear\(\)/);
  assert.match(code, /query.isError \? null/);
  assert.match(code, /hidden=\{loading\}/);
  assert.match(code, /visibilitychange/);
  assert.match(code, /FACULTY_ACCESS_CHANGED/);
  assert.notDeepEqual(
    a.adminKey("one", "records"),
    a.adminKey("two", "records"),
  );
});
test("temporary credentials bypass query/mutation caches and are cleared on close", () => {
  const form = source("components/admin/administrators/administrator-form.tsx");
  assert.doesNotMatch(form, /useMutation|useQuery|localStorage|sessionStorage/);
  assert.match(form, /method: account \? "PATCH" : "POST"/);
  assert.match(form, /directAdminKeys\(keys\)/);
  assert.match(form, /lock.current/);
  assert.match(form, /setConfirm\(true\)/);
  const page = source("app/(portal)/admin/users/administrators/page.tsx");
  assert.match(page, /setCredential\(null\)/);
  assert.doesNotMatch(page, /\.total\b/);
});
test("minimum reads and excluded Admin actions stay withheld", () => {
  const settings = source("app/(portal)/admin/settings/page.tsx");
  assert.doesNotMatch(
    settings,
    /deleteLogMutation|bulkDeleteMutation|\/audit-logs\/delete/,
  );
  assert.match(settings, /enabled: canRead\("settings.view"\)/);
  assert.match(settings, /activeTab === "audit" && canRead\("audit.view"\)/);
  const record = source("app/(portal)/admin/exam/applications/[id]/page.tsx");
  assert.doesNotMatch(record, /EssayEvaluationPanel|send-email/);
  assert.match(record, /capability="exam.results.finalize"/);
  assert.match(record, /capability="exam.starts.authorize"/);
  const assignment = source(
    "components/admin/exam/assign-applicant-dialog.tsx",
  );
  assert.match(
    assignment,
    /!allows\("exam.schedules.manage"\) \|\| !allows\("applicants.view"\)/,
  );
  const schedule = source("app/(portal)/admin/thesis/scheduling/page.tsx");
  assert.match(schedule, /enabled: allows\("defense.applications.view"\)/);
});
test("all activation gates remain code-owned false", () => {
  for (const [file, key] of [
    ["administrator-management", "ADMINISTRATOR_MANAGEMENT_ENABLED"],
    ["account-access", "DIRECT_ACCESS_ENFORCEMENT_ENABLED"],
    ["operational-authorization", "OPERATIONAL_ENFORCEMENT_ENABLED"],
  ])
    assert.match(
      readFileSync(
        new URL(`../../backend/src/access/${file}.ts`, import.meta.url),
        "utf8",
      ),
      new RegExp(`${key}: boolean = false`),
    );
});

test("FACULTY-17 removes the retired destination and legacy URLs cannot authorize management", () => {
  assert.equal(a.ADMIN_DESTINATIONS.some(item => item.href.startsWith("/admin/users/roles")), false);
  for (const access of [full(), parse(), parse(["faculty.view", "faculty.manage"])]) {
    assert.equal(a.adminRouteAllowed(access, "/admin/users/roles"), false);
    assert.equal(a.adminRouteAllowed(access, "/admin/users/roles/saved-bookmark"), false);
  }
  assert.equal(a.adminRouteAllowed(full(), "/admin/users/administrators"), true);
  assert.equal(a.adminRouteAllowed(parse(["faculty.view", "faculty.manage"]), "/admin/users/administrators"), false);
});
