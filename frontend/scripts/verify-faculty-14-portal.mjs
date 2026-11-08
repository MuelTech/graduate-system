import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source = (path) =>
  readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");
function load(path, dependencies = {}, globals = {}) {
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(source(path), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    {
      exports,
      require(name) {
        if (name in dependencies) return dependencies[name];
        throw new Error(`Unexpected dependency ${name}`);
      },
      Set,
      Number,
      AbortController,
      URL,
      ...globals,
    },
  );
  return exports;
}
const { ApiError } = load("lib/api-error.ts");
const roles = load("lib/account-role.ts");
const access = load("lib/faculty-access.ts", {
  "./account-role": roles,
  "./api-error": { ApiError },
});
const essays = load("lib/faculty-essays.ts", { "./api-error": { ApiError } });
const media = load("lib/faculty-essay-media.client.ts", {
  "./faculty-essays": essays,
});
const plain = (value) => JSON.parse(JSON.stringify(value));
const dto = (work = {}) => ({
  user: { id: "self", role: "FACULTY", mustChangePassword: false },
  configuredAccess: { status: "RESOLVED" },
  facultyWork: {
    essayEvaluations: { relevant: false },
    myAdvisees: {
      relevant: false,
      activeAdviseeCount: 0,
      addressedRequestCount: 0,
      issuedCertificationCount: 0,
    },
    myDefenses: { relevant: false, assignmentCount: 0 },
    ...work,
  },
});

for (const role of ["faculty", "panelist", "FACULTY", "PANELIST"])
  test(`${role} server identity maps to the retained academic portal`, () => {
    assert.equal(access.loginDestination({ role }), "/panelist/dashboard");
  });
test("selected role cannot supply a redirect; unavailable/unknown sessions are held", () => {
  assert.equal(access.loginDestination(undefined), null);
  assert.equal(access.loginDestination({ role: "custom" }), null);
  assert.equal(
    access.loginDestination({
      role: "faculty",
      currentAccountError: "ACCOUNT_UNAVAILABLE",
    }),
    null,
  );
  assert.equal(
    access.loginDestination({ role: "faculty", mustChangePassword: true }),
    "/change-password",
  );
  for (const role of ["applicant", "student", "admin"])
    assert.equal(access.loginDestination({ role }), `/${role}/dashboard`);
});
for (let mask = 0; mask < 8; mask++)
  test(`navigation responsibility combination ${mask} copies only server semantic flags`, () => {
    const value = dto();
    value.facultyWork.essayEvaluations.relevant = Boolean(mask & 1);
    value.facultyWork.myAdvisees.relevant = Boolean(mask & 2);
    value.facultyWork.myDefenses.relevant = Boolean(mask & 4);
    assert.deepEqual(
      plain(access.readFacultyWork(value, "self")),
      value.facultyWork,
    );
  });
test("addressed-only and issuer-only Adviser contexts remain relevant without assignments", () => {
  for (const key of ["addressedRequestCount", "issuedCertificationCount"]) {
    const value = dto();
    Object.assign(value.facultyWork.myAdvisees, { relevant: true, [key]: 1 });
    assert.equal(
      access.readFacultyWork(value, "self").myAdvisees.relevant,
      true,
    );
  }
});
test("own access parser rejects alternate identities, credential gate and malformed/unavailable projections", () => {
  const invalid = [
    null,
    {},
    { ...dto(), facultyWork: null },
    { ...dto(), configuredAccess: { status: "INVALID_CONFIGURATION" } },
    { ...dto(), user: { ...dto().user, id: "other" } },
    { ...dto(), user: { ...dto().user, role: "ADMIN" } },
    { ...dto(), user: { ...dto().user, mustChangePassword: true } },
    dto({ myDefenses: { relevant: "true", assignmentCount: 1 } }),
    dto({ myDefenses: { relevant: true, assignmentCount: -1 } }),
  ];
  for (const value of invalid)
    assert.throws(
      () => access.readFacultyWork(value, "self"),
      (error) => error.statusCode === 503,
    );
});
test("new query keys are account-scoped; parsing cannot leak raw access metadata", () => {
  assert.notDeepEqual(
    plain(access.facultyKey("a", "essays")),
    plain(access.facultyKey("b", "essays")),
  );
  const value = dto();
  value.facultyWork.signatureData = "secret";
  value.capabilities = ["private"];
  assert.doesNotMatch(
    JSON.stringify(access.readFacultyWork(value, "self")),
    /secret|capabilities|private/,
  );
});
test("route presentation preserves canonical and compatibility deep-link families without prefix collisions", () => {
  for (const route of [
    "defenses",
    "defense-workspace/schedule",
    "defense-lobby/schedule",
    "scoring/schedule",
    "materials",
  ])
    assert.equal(access.facultyAreaForPath(`/panelist/${route}`), "myDefenses");
  for (const route of [
    "advisees",
    "advisees/student",
    "adviser-requests",
    "adviser-reviews",
  ])
    assert.equal(access.facultyAreaForPath(`/panelist/${route}`), "myAdvisees");
  assert.equal(
    access.facultyAreaForPath("/panelist/essay-evaluations/app"),
    "essayEvaluations",
  );
  assert.equal(access.facultyAreaForPath("/panelist/defenses-elsewhere"), null);
});
test("empty candidate scan follows cursors until visible work; continuation remains bounded to that page", async () => {
  const seen = [];
  const value = await essays.visibleEssayPage(async (cursor) => {
    seen.push(cursor);
    return cursor === null
      ? { items: [], nextCursor: "a" }
      : cursor === "a"
        ? { items: [], nextCursor: "b" }
        : { items: [{ applicationId: "visible" }], nextCursor: "c" };
  }, null);
  assert.deepEqual(seen, [null, "a", "b"]);
  assert.equal(value.items.length, 1);
  assert.equal(value.nextCursor, "c");
});
test("true empty is returned only after the cursor chain ends", async () => {
  const calls = [];
  const result = await essays.visibleEssayPage(async (cursor) => {
    calls.push(cursor);
    return { items: [], nextCursor: cursor ? null : "next" };
  }, null);
  assert.deepEqual(calls, [null, "next"]);
  assert.equal(result.nextCursor, null);
});
test("repeated and backwards cursors fail rather than loop or fabricate empty work", async () => {
  for (const cursor of ["b", "a"])
    await assert.rejects(
      essays.visibleEssayPage(
        async () => ({ items: [], nextCursor: cursor }),
        "b",
      ),
      (error) => error.statusCode === 503,
    );
});
test("reader and dormant failures propagate rather than becoming exhausted queues", async () => {
  await assert.rejects(
    essays.visibleEssayPage(async () => {
      throw new ApiError("Dormant", 503);
    }, null),
    (error) => error.statusCode === 503,
  );
});
for (const [text, expected] of [
  ["0", 0],
  ["0.5", 0.5],
  ["10", 10],
  ["", null],
  [" ", null],
  ["NaN", null],
  ["Infinity", null],
  ["-1", null],
  ["10.1", null],
])
  test(`assistive score validation ${JSON.stringify(text)}`, () =>
    assert.equal(essays.scoreInput(text, 10), expected));
for (const status of [400, 401, 403, 404, 409, 503, 500])
  test(`bounded error presentation ${status}`, () => {
    assert.doesNotMatch(
      essays.essayError(new ApiError("SQL private path", status)),
      /SQL|private path/,
    );
  });
test("exact Faculty image endpoint, token, MIME and object-URL lifetime", async () => {
  const calls = [];
  const revoked = [];
  let loaded;
  let resolveLoaded;
  const ready = new Promise((resolve) => {
    resolveLoaded = resolve;
  });
  const cleanup = media.startFacultyEssayImageRequest({
    baseUrl: "http://fixture",
    applicationId: "app",
    mediaId: "image",
    token: "own-token",
    onLoad: (url) => {
      loaded = url;
      resolveLoaded();
    },
    onError: () => assert.fail("Unexpected image failure"),
    onUnauthorized() {},
    onForbidden() {},
    fetcher: async (url, options) => {
      calls.push({ url, options });
      return new Response(new Blob(["synthetic"], { type: "image/png" }), {
        headers: { "Content-Type": "image/png" },
      });
    },
    urls: {
      createObjectURL: () => "blob:own",
      revokeObjectURL: (url) => revoked.push(url),
    },
  });
  await ready;
  assert.equal(loaded, "blob:own");
  assert.equal(
    calls[0].url,
    "http://fixture/api/exam/essay-evaluations/app/media/image/content",
  );
  assert.equal(calls[0].options.headers.Authorization, "Bearer own-token");
  cleanup();
  cleanup();
  assert.deepEqual(revoked, ["blob:own"]);
  assert.equal(calls[0].options.signal.aborted, true);
});
for (const status of [401, 403, 503])
  test(`image failure ${status} separates session expiry from access refresh`, async () => {
    const events = [];
    const cleanup = media.startFacultyEssayImageRequest({
      baseUrl: "http://fixture",
      applicationId: "app",
      mediaId: "image",
      token: "own",
      fetcher: async () => new Response("", { status }),
      onLoad() {
        assert.fail("No image expected");
      },
      onError: () => events.push("error"),
      onUnauthorized: () => events.push("signout"),
      onForbidden: () => events.push("refresh"),
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    cleanup();
    assert.deepEqual(events, [
      ...(status === 401 ? ["signout"] : status === 403 ? ["refresh"] : []),
      "error",
    ]);
  });
test("visible login choices and Profile retirement stay bounded", () => {
  const login = source("app/(auth)/login/page.tsx");
  const choices = [
    ...login.matchAll(/value: "([a-z]+)", label: "([^"]+)"/g),
  ].map((match) => [match[1], match[2]]);
  assert.deepEqual(choices, [
    ["applicant", "Applicant"],
    ["student", "Student"],
    ["faculty", "Faculty"],
    ["admin", "Administrator"],
  ]);
  assert.doesNotMatch(login, /router\.push\(`\/\$\{role\}/);
  assert.doesNotMatch(
    source("app/(portal)/panelist/profile/page.tsx"),
    /availability|Switch|PATCH/,
  );
});
