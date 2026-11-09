// Executes real mapping and component event handlers with synthetic API/query seams.
// Browser rendering/focus is verified separately; this is not a browser substitute.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import * as jsx from "react/jsx-runtime";

const source = path => readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");
function load(path, deps = {}, globals = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(source(path), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText, { exports, require(name) {
    if (name === "react/jsx-runtime") return jsx;
    if (name in deps) return deps[name];
    if (name.startsWith("@/components/") || name === "lucide-react") return new Proxy({}, { get: (_, key) => String(key) });
    throw new Error(`Unexpected dependency: ${name}`);
  }, ...globals });
  return exports;
}
const { ApiError } = load("lib/api-error.ts");
const rules = load("lib/faculty-management.ts", { "./api-error": { ApiError } });
const plain = value => JSON.parse(JSON.stringify(value));
const dto = (extra = {}) => ({
  id: "profile", userId: "faculty", isExternal: false, isActive: true, isAvailableAsAdviser: true,
  highestEducationalAttainment: "Doctorate", officeAffiliation: "Graduate School", specialization: "Research",
  createdAt: "2026-11-09T00:00:00Z", capabilityKeys: ["essay.evaluate"],
  user: { id: "faculty", role: "FACULTY", firstName: "Alex", lastName: "Faculty", title: null, suffix: null,
    email: "faculty@example.test", isActive: true, createdAt: "2026-11-09T00:00:00Z", updatedAt: "2026-11-09T00:00:00Z",
    createdBy: { firstName: "Admin", lastName: "Creator" }, updatedBy: null }, ...extra,
});
function treeNodes(tree) {
  if (tree === null || tree === undefined || typeof tree === "boolean") return [];
  if (Array.isArray(tree)) return tree.flatMap(treeNodes);
  if (typeof tree !== "object") return [tree];
  return [tree, ...treeNodes(tree.props?.children), ...treeNodes(tree.props?.actions)];
}
const text = tree => treeNodes(tree).filter(item => typeof item === "string" || typeof item === "number").join(" ");
const find = (tree, predicate) => treeNodes(tree).find(node => typeof node === "object" && predicate(node));
const field = (tree, id) => find(tree, node => node.props.id === id);
const button = (tree, label) => find(tree, node => node.type === "Button" && text(node) === label);
function harness(path, exportName, props, dependencies = {}, globals = {}) {
  const state = []; let cursor = 0;
  const react = { useState(initial) {
    const index = cursor++;
    if (!(index in state)) state[index] = typeof initial === "function" ? initial() : initial;
    return [state[index], value => { state[index] = typeof value === "function" ? value(state[index]) : value; }];
  } };
  const component = load(path, { react, "@/lib/faculty-management": rules, ...dependencies }, globals)[exportName];
  return { render() { cursor = 0; return component(props); }, state };
}

test("FACULTY-10 DTO maps bounded identities, status, configured access and External availability", () => {
  const mapped = rules.mapFaculty(dto({ temporaryPassword: "must-not-copy" }));
  assert.equal(mapped.userId, "faculty"); assert.equal(mapped.essayEvaluation, true);
  assert.equal(mapped.createdBy, "Admin Creator"); assert.equal(mapped.title, "");
  assert.equal(rules.mapFaculty(dto({ isExternal: true })).isAvailableAsAdviser, false);
  assert.equal(rules.mapFaculty(dto({ isActive: false })).isActive, false);
  assert.equal(rules.mapFaculty(dto({ user: { ...dto().user, isActive: false } })).isActive, false);
  assert.equal(rules.mapFaculty(dto({ capabilityKeys: [] })).essayEvaluation, false);
  for (const hidden of ["temporaryPassword", "capabilityKeys", "role"]) assert.equal(hidden in mapped, false);
});
test("create/update use an exact allowlist and safe defaults, never credential or contextual-role fields", () => {
  const payload = rules.facultyPayload({ ...rules.emptyFacultyForm, firstName: " Alex ", password: "injected", role: "ADMIN" });
  assert.deepEqual(Object.keys(payload).sort(), ["email", "firstName", "lastName", "title", "suffix", "highestEducationalAttainment", "officeAffiliation", "specialization", "isActive", "isExternal", "isAvailableAsAdviser", "capabilityKeys"].sort());
  assert.equal(payload.firstName, "Alex"); assert.equal(payload.isAvailableAsAdviser, false);
  assert.equal(payload.isExternal, false); assert.deepEqual(plain(payload.capabilityKeys), []);
  assert.deepEqual(plain(rules.facultyPayload({ ...rules.emptyFacultyForm, essayEvaluation: true }).capabilityKeys), ["essay.evaluate"]);
  assert.equal(rules.facultyPayload({ ...rules.emptyFacultyForm, isExternal: true, isAvailableAsAdviser: true }).isAvailableAsAdviser, false);
});
test("classification/status/search filters preserve operational meaning", () => {
  const internal = rules.mapFaculty(dto());
  const external = rules.mapFaculty(dto({ id: "external", isExternal: true, isActive: false }));
  assert.equal(rules.filterFaculty([internal, external], "", "internal", "active").length, 1);
  assert.equal(rules.filterFaculty([internal, external], "", "external", "inactive")[0].id, "external");
  assert.equal(rules.filterFaculty([internal], "graduate", "all", "all").length, 1);
  assert.equal(rules.filterFaculty([internal], "missing", "all", "all").length, 0);
});
for (const status of [400, 401, 403, 409, 503, 500]) test(`safe distinct error presentation ${status}`, () => {
  const message = rules.facultyError(new ApiError("SQL Prisma private detail", status));
  assert.doesNotMatch(message, /SQL|Prisma|private detail/);
  assert.ok(message.length);
});
test("DR-7 controlled conflict is actionable without classification repair", () => {
  assert.match(rules.facultyError(new ApiError("This Adviser classification requires institutional review.", 409)), /institutional review.*current classification/);
});

const formPath = "components/admin/faculty/faculty-form.tsx";
test("Internal availability can be enabled; External clears and disables it", () => {
  const h = harness(formPath, "FacultyFormDialog", { canManage: true }, { "@/lib/api.client": {} });
  assert.equal(field(h.render(), "faculty-adviser").props.checked, false);
  field(h.render(), "faculty-adviser").props.onCheckedChange(true);
  assert.equal(field(h.render(), "faculty-adviser").props.checked, true);
  field(h.render(), "faculty-classification").props.onChange({ target: { value: "external" } });
  assert.equal(field(h.render(), "faculty-adviser").props.disabled, true);
  assert.equal(field(h.render(), "faculty-adviser").props.checked, false);
  field(h.render(), "faculty-classification").props.onChange({ target: { value: "internal" } });
  assert.equal(field(h.render(), "faculty-adviser").props.checked, false);
});
test("create hands off one-time response outside query cache, refreshes, and closes", async () => {
  const calls = []; const created = [];
  const h = harness(formPath, "FacultyFormDialog", {
    canManage: true, onCreated: value => created.push(value), onSaved: async () => calls.push("refresh"), onClose: () => calls.push("close"),
  }, { "@/lib/api.client": { apiClientRequest: async (url, options) => {
    calls.push([url, options.method, JSON.parse(options.body)]); return { account: dto(), temporaryPassword: "synthetic-once" };
  } } });
  await find(h.render(), n => n.type === "form").props.onSubmit({ preventDefault() {} });
  // submit initiates save without returning its promise; drain completion jobs.
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls[0][1], "POST"); assert.equal(calls[0][2].isAvailableAsAdviser, false);
  assert.equal(created[0].temporaryPassword, "synthetic-once");
  assert.deepEqual(calls.slice(1), ["refresh", "close"]);
});
test("edit sends no password, preserves draft on 409 and never refreshes a rejection", async () => {
  let requests = 0; let closed = false;
  const h = harness(formPath, "FacultyFormDialog", { faculty: rules.mapFaculty(dto()), canManage: true,
    onSaved: () => assert.fail("must not refresh"), onClose: () => { closed = true; },
  }, { "@/lib/api.client": { apiClientRequest: async (_url, options) => {
    requests++; assert.equal(options.method, "PUT"); assert.equal("password" in JSON.parse(options.body), false);
    throw new ApiError("This Adviser classification requires institutional review.", 409);
  } } });
  field(h.render(), "faculty-classification").props.onChange({ target: { value: "external" } });
  find(h.render(), n => n.type === "form").props.onSubmit({ preventDefault() {} });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(requests, 1); assert.equal(closed, false);
  assert.equal(field(h.render(), "faculty-classification").props.value, "external");
  assert.match(text(h.render()), /institutional review/);
});
test("view-only cannot submit and consequential account status changes require confirmation", async () => {
  const props = { faculty: rules.mapFaculty(dto()), canManage: false };
  const h = harness(formPath, "FacultyFormDialog", props, { "@/lib/api.client": { apiClientRequest: () => assert.fail("view-only write") } });
  assert.equal(button(h.render(), "Save Changes").props.disabled, true);
  assert.equal(field(h.render(), "faculty-essay").props.disabled, true);
  assert.equal(field(h.render(), "faculty-adviser").props.disabled, true);
  find(h.render(), n => n.type === "form").props.onSubmit({ preventDefault() {} });
  props.canManage = true;
  field(h.render(), "faculty-active").props.onCheckedChange(false);
  find(h.render(), n => n.type === "form").props.onSubmit({ preventDefault() {} });
  assert.match(text(h.render()), /Deactivate this account/);
  assert.equal(field(h.render(), "faculty-active").props.disabled, true);
  assert.ok(button(h.render(), "Confirm and Save"));
});

const pagePath = "app/(portal)/admin/users/panelists/page.tsx";
function pageHarness(query) {
  return harness(pagePath, "default", {}, {
    "@/components/admin/access/admin-access-provider": { useAdminAccess: () => ({ allows: () => true }) },
    "@/lib/api.client": {}, sonner: { toast: {} }, "next-auth/react": { useSession: () => ({ data: { user: { id: "synthetic-admin" } } }) },
    "@tanstack/react-query": { useQuery: () => query, useQueryClient: () => ({ invalidateQueries: async () => {} }) },
  });
}
test("loading, request failure, empty registry, filtered-empty are distinct", () => {
  assert.ok(find(pageHarness({ isPending: true }).render(), n => n.props["aria-label"] === "Loading Faculty"));
  const failed = text(pageHarness({ isError: true, error: new ApiError("dormant", 503) }).render());
  assert.match(failed, /currently unavailable/); assert.match(failed, /Retry/); assert.doesNotMatch(failed, /No Faculty accounts/);
  assert.match(text(pageHarness({ data: { rows: [], canManage: false } }).render()), /No Faculty accounts yet/);
  const h = pageHarness({ data: { rows: [rules.mapFaculty(dto())], canManage: false } });
  field(h.render(), "faculty-search").props.onChange({ target: { value: "absent" } });
  assert.match(text(h.render()), /No matching Faculty/);
});
test("server context plus current Admin capability control mutations; stale reads fail closed", () => {
  for (const query of [
    { data: { rows: [], canManage: false } }, { data: { rows: [], canManage: true }, isError: true },
    { data: { rows: [], canManage: true }, isFetching: true },
  ]) assert.equal(button(pageHarness(query).render(), "Create Faculty"), undefined);
  assert.ok(button(pageHarness({ data: { rows: [], canManage: true } }).render(), "Create Faculty"));
});
test("page reads bounded context and DTOs, rejects malformed success responses", async () => {
  let options; let malformed = false; const calls = [];
  harness(pagePath, "default", {}, {
    "@/components/admin/access/admin-access-provider": { useAdminAccess: () => ({ allows: () => true }) },
    "next-auth/react": { useSession: () => ({ data: { user: { id: "synthetic-admin" } } }) },
    sonner: { toast: {} },
    "@tanstack/react-query": { useQuery: value => { options = value; return { isPending: true }; }, useQueryClient: () => ({}) },
    "@/lib/api.client": { apiClientRequest: async (url, init) => {
      calls.push([url, init]);
      if (url.endsWith("management-context")) return malformed ? {} : { canManage: false };
      return [dto()];
    } },
  }).render();
  assert.equal(options.queryKey.includes("synthetic-admin"), true);
  assert.equal(options.staleTime, 0);
  assert.equal(options.refetchOnMount, "always");
  const result = await options.queryFn();
  assert.equal(result.canManage, false); assert.equal(result.rows[0].email, "faculty@example.test");
  assert.equal(calls[1][1].cache, "no-store");
  malformed = true; await assert.rejects(options.queryFn(), /Invalid Faculty response/);
});
test("Faculty navigation remains active for the technical route and slash-delimited descendants", () => {
  const fn = source("app/(portal)/admin/layout.tsx").match(/function isNavActive\([^)]*\): boolean \{[\s\S]*?\n\}/)[0];
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fn + "\nexports.isNavActive = isNavActive;", {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports });
  const path = "/admin/users/panelists";
  assert.equal(exports.isNavActive(path, path), true);
  assert.equal(exports.isNavActive(path + "/profile", path), true);
  assert.equal(exports.isNavActive(path + "-other", path), false);
});
test("temporary credential copy and every close callback clear the parent's local state", async () => {
  let copied; let closed = 0;
  const h = harness("components/admin/faculty/temporary-credential.tsx", "TemporaryCredentialDialog", {
    credential: { name: "Faculty", email: "faculty@example.test", temporaryPassword: "synthetic-once" }, onClose: () => closed++,
  }, {}, { navigator: { clipboard: { writeText: async value => { copied = value; } } } });
  await button(h.render(), "Copy").props.onClick(); await new Promise(resolve => setImmediate(resolve));
  assert.equal(copied, "synthetic-once"); assert.match(text(h.render()), /Copied/);
  find(h.render(), n => n.type === "Dialog").props.onOpenChange(false); button(h.render(), "Done").props.onClick();
  assert.equal(closed, 2);
  const page = source(pagePath);
  assert.match(page, /onClose=\{\(\) => setCredential\(null\)\}/);
});
test("terminology, technical route, navigation and credential boundaries remain explicit", () => {
  const page = source(pagePath), form = source(formPath);
  const detail = source("components/admin/faculty/faculty-detail.tsx");
  const credential = source("components/admin/faculty/temporary-credential.tsx");
  const ui = [page, form, detail, credential].join("\n");
  // FACULTY-15 adds an internal faculty.manage presentation check; no key is rendered.
  assert.doesNotMatch(ui, /Panelist Management|Add Panelist|Edit Panelist|Panelist Details|All Panelists|External Panelist|Loading panelists|No panelists|LAST NAME|New Password|essay\.evaluate|faculty\.view|localStorage|sessionStorage|console\./);
  assert.doesNotMatch(form, /useMutation\(|password:|Chairman|Rapporteur|Facilitator|Panelist access/);
  assert.match(source("app/(portal)/admin/layout.tsx"), /href: "\/admin\/users\/panelists", label: "Faculty"/);
  assert.equal(rules.FACULTY_API, "/admin/panelists");
  assert.match(page, /invalidateQueries\(\{ queryKey: FACULTY_QUERY_KEY \}\)/);
  assert.match(page, /rows: rows\.map/);
});
