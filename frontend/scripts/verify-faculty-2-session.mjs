// Focused runtime tests of the real TypeScript modules; network/auth dependencies are injected.
// Run: node --test scripts/verify-faculty-2-session.mjs
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
  vm.runInNewContext(source, {
    exports, require(name) {
      if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`);
      return dependencies[name];
    }, Headers, FormData, AbortSignal, Event, console, ...globals,
  }, { filename: path });
  return exports;
}
const identity = { id: "u1", role: "admin", accessToken: "signed-token", mustChangePassword: false };
const serverUser = { id: "u1", email: "own@example.com", role: "STUDENT", mustChangePassword: false };
const response = (status, body = {}) => new Response(JSON.stringify(body), { status });

test("FACULTY-17A same-email sessions stay bound to distinct User IDs and reject a foreign same-email response", async () => {
  const email = "person@gmail.com";
  for (const [id, role] of [["shared-admin", "ADMIN"], ["shared-faculty", "FACULTY"]]) {
    const token = { ...identity, id, email, role: role.toLowerCase(), accessToken: `token-${id}` };
    let current = { id, email, role, mustChangePassword: false };
    const { synchronizeCurrentSession } = load("lib/current-session.ts", {}, { fetch: async () => response(200, { user: current }) });
    const result = await synchronizeCurrentSession(token, "http://backend");
    assert.equal(result.id, id); assert.equal(result.accessToken, `token-${id}`); assert.equal(result.role, role.toLowerCase());
    current = { ...current, id: id === "shared-admin" ? "shared-faculty" : "shared-admin" };
    const denied = await synchronizeCurrentSession(token, "http://backend");
    assert.equal(denied.id, id); assert.equal(denied.role, ""); assert.equal(denied.currentAccountError, "ACCOUNT_UNAVAILABLE");
  }
});

test("session reload uses server identity and bypasses caches", async () => {
  let request;
  const { synchronizeCurrentSession } = load("lib/current-session.ts", {}, { fetch: async (...args) => {
    request = args; return response(200, { user: serverUser });
  } });
  const result = await synchronizeCurrentSession(identity, "http://backend");
  assert.equal(result.role, "student"); assert.equal(result.email, serverUser.email);
  assert.equal(request[0], "http://backend/api/auth/me");
  assert.equal(request[1].cache, "no-store");
  assert.equal(request[1].headers.Authorization, "Bearer signed-token");
});

test("session rechecks credential state in both directions", async () => {
  let mustChangePassword = true;
  const { synchronizeCurrentSession } = load("lib/current-session.ts", {}, { fetch: async () => response(200, { user: { ...serverUser, mustChangePassword } }) });
  const gated = await synchronizeCurrentSession(identity, "http://backend");
  assert.equal(gated.mustChangePassword, true);
  mustChangePassword = false;
  assert.equal((await synchronizeCurrentSession(gated, "http://backend")).mustChangePassword, false);
});

for (const status of [401, 403, 503]) test(`session handles ${status} without stale authority`, async () => {
  const { synchronizeCurrentSession } = load("lib/current-session.ts", {}, { fetch: async () => response(status) });
  const result = await synchronizeCurrentSession(identity, "http://backend");
  if (status === 401) assert.equal(result, null);
  else {
    assert.equal(result.role, ""); assert.equal(result.mustChangePassword, true);
    assert.equal(result.accessToken, identity.accessToken);
    assert.equal(result.currentAccountError, status === 403 ? "ACCOUNT_FORBIDDEN" : "ACCOUNT_UNAVAILABLE");
  }
});

for (const user of [{ ...serverUser, id: "other" }, { ...serverUser, role: "FORGED" }, { ...serverUser, role: "CUSTOM" }, { ...serverUser, mustChangePassword: undefined }, null]) {
  test(`session rejects malformed/foreign account ${JSON.stringify(user)}`, async () => {
    const { synchronizeCurrentSession } = load("lib/current-session.ts", {}, { fetch: async () => response(200, { user }) });
    const result = await synchronizeCurrentSession(identity, "http://backend");
    assert.equal(result.role, ""); assert.equal(result.currentAccountError, "ACCOUNT_UNAVAILABLE");
  });
}
test("session network failure fails closed and later recovers", async () => {
  let offline = true;
  const { synchronizeCurrentSession } = load("lib/current-session.ts", {}, { fetch: async () => {
    if (offline) throw new Error("offline");
    return response(200, { user: serverUser });
  } });
  const failed = await synchronizeCurrentSession(identity, "http://backend");
  assert.equal(failed.role, "");
  offline = false;
  const restored = await synchronizeCurrentSession(failed, "http://backend");
  assert.equal(restored.role, "student"); assert.equal(restored.currentAccountError, undefined);
});

function client(status, session = { user: identity }) {
  let signOuts = 0; let sessionReads = 0; let accessRefreshes = 0;
  const { ApiError } = load("lib/api-error.ts");
  const { apiClientRequest } = load("lib/api.client.ts", {
    "next-auth/react": { getSession: async () => { sessionReads++; return session; }, signOut: () => { signOuts++; } },
    "./backend-origin.client": { getClientBackendBaseUrl: () => "http://backend" },
    "./api-error": { ApiError },
  }, { window: { dispatchEvent(event) { if (event.type === "faculty-access-changed") accessRefreshes++; } }, fetch: async () => response(status, { error: "denied", missing: ["context"] }) });
  return { apiClientRequest, ApiError, signOuts: () => signOuts, sessionReads: () => sessionReads, accessRefreshes: () => accessRefreshes };
}
test("valid client 403 preserves login, status/body, and refreshes current session", async () => {
  const api = client(403);
  await assert.rejects(api.apiClientRequest("/admin/action"), error => error instanceof api.ApiError && error.statusCode === 403 && error.message === "denied");
  assert.equal(api.signOuts(), 0); assert.equal(api.sessionReads(), 2);
  assert.equal(api.accessRefreshes(), 1);
});
test("client 401 signs out and preserves status", async () => {
  const api = client(401);
  await assert.rejects(api.apiClientRequest("/admin/action"), error => error.statusCode === 401);
  assert.equal(api.signOuts(), 1);
});
test("unavailable or disabled current session does not reuse stale authority or sign out", async () => {
  for (const currentAccountError of ["ACCOUNT_FORBIDDEN", "ACCOUNT_UNAVAILABLE"]) {
    const api = client(200, { user: { ...identity, currentAccountError } });
    await assert.rejects(api.apiClientRequest("/admin/action"), error => error.statusCode === (currentAccountError === "ACCOUNT_FORBIDDEN" ? 403 : 503));
    assert.equal(api.signOuts(), 0);
  }
});
test("server 403 retains status without redirect; 401 redirects", async () => {
  let status = 403; let redirects = 0;
  const { ApiError } = load("lib/api-error.ts");
  const { apiServerRequest } = load("lib/api.server.ts", {
    "@/auth": { auth: async () => ({ user: identity }) },
    "next/navigation": { redirect: () => { redirects++; throw new Error("redirect"); } },
    "./backend-origin.server": { getServerBackendBaseUrl: () => "http://backend" },
    "./api-error": { ApiError },
  }, { fetch: async (_url, options) => { assert.equal(options.cache, "no-store"); return response(status, { error: "denied" }); } });
  await assert.rejects(apiServerRequest("/action"), error => error instanceof ApiError && error.statusCode === 403);
  assert.equal(redirects, 0);
  status = 401;
  await assert.rejects(apiServerRequest("/action"), /redirect/); assert.equal(redirects, 1);
});

test("NextAuth update ignores client role, token and credential claims", async () => {
  let config; let received;
  load("auth.ts", {
    "next-auth": { default: options => { config = options; return {}; }, CredentialsSignin: class extends Error {} },
    "next-auth/providers/credentials": { default: options => options },
    "@/lib/backend-origin.server": { getServerBackendBaseUrl: () => "http://backend" },
    "@/lib/current-session": { synchronizeCurrentSession: async token => { received = token; return { ...token, role: "student", mustChangePassword: true }; } },
  });
  const result = await config.callbacks.jwt({ token: identity, trigger: "update", session: { role: "admin", mustChangePassword: false, accessToken: "forged" } });
  assert.equal(received.accessToken, identity.accessToken); assert.equal(result.role, "student"); assert.equal(result.mustChangePassword, true);
});

function middleware() {
  class NextResponse {
    constructor(body, options) { this.body = body; this.status = options.status; }
    static redirect(url) { return { redirect: url.pathname }; }
    static next() { return { allowed: true }; }
  }
  return load("middleware.ts", {
    "@/auth": { auth: handler => handler }, "next/server": { NextResponse },
    "@/lib/account-role": load("lib/account-role.ts"),
  }, { URL, console: { log() {} } }).default;
}
test("frontend credential gate applies to all roles, and password page remains reachable", () => {
  const gate = middleware();
  for (const role of ["applicant", "student", "admin", "panelist", "faculty", "custom"]) {
    const auth = { user: { ...identity, role, mustChangePassword: true } };
    assert.equal(gate({ auth, nextUrl: { pathname: `/${role}/dashboard` }, url: "http://frontend" }).redirect, "/change-password");
    assert.equal(gate({ auth, nextUrl: { pathname: "/change-password" }, url: "http://frontend" }).allowed, true);
  }
});
test("frontend drops stale portal authority, fails closed during outage, and distinguishes no session", () => {
  const gate = middleware();
  const request = { nextUrl: { pathname: "/admin/dashboard" }, url: "http://frontend" };
  assert.equal(gate({ ...request, auth: { user: { ...identity, role: "student" } } }).redirect, "/student/dashboard");
  assert.equal(gate({ ...request, auth: { user: { ...identity, role: "", currentAccountError: "ACCOUNT_UNAVAILABLE" } } }).status, 503);
  assert.equal(gate({ ...request, auth: null }).redirect, "/login");
});
