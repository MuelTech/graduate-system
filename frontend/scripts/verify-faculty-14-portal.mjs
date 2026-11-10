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
const dashboard = load("lib/panelist-dashboard.ts", {
  "./faculty-access": access,
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

test("UIUX-3E Part A: sidebar navigation visibility uses last confirmed same-account snapshot and fails closed on revocation or error", () => {
  assert.equal(access.isFacultyNavAreaVisible(null, undefined), true);
  for (const area of ["essayEvaluations", "myAdvisees", "myDefenses"]) {
    assert.equal(access.isFacultyNavAreaVisible(null, area), false);
    assert.equal(access.isFacultyNavAreaVisible(undefined, area), false);
  }
  const confirmed = access.readFacultyWork(
    dto({
      essayEvaluations: { relevant: true },
      myAdvisees: {
        relevant: false,
        activeAdviseeCount: 0,
        addressedRequestCount: 0,
        issuedCertificationCount: 0,
      },
      myDefenses: { relevant: true, assignmentCount: 2 },
    }),
    "self",
  );
  assert.equal(access.isFacultyNavAreaVisible(confirmed, "essayEvaluations"), true);
  assert.equal(access.isFacultyNavAreaVisible(confirmed, "myAdvisees"), false);
  assert.equal(access.isFacultyNavAreaVisible(confirmed, "myDefenses"), true);

  const revoked = access.readFacultyWork(
    dto({
      essayEvaluations: { relevant: false },
      myDefenses: { relevant: false, assignmentCount: 0 },
    }),
    "self",
  );
  assert.equal(access.isFacultyNavAreaVisible(revoked, "essayEvaluations"), false);
  assert.equal(access.isFacultyNavAreaVisible(revoked, "myDefenses"), false);

  const layout = source("app/(portal)/panelist/layout.tsx");
  assert.match(layout, /isFacultyNavAreaVisible\(\s*access\.snapshot,/);
  assert.doesNotMatch(layout, /access\.work\?\.\[item\.area\]/);
});

test("UIUX-3E Part B: Faculty dashboard projection respects dynamic responsibility combinations and separates waiting items from Pending Tasks", () => {
  const sampleData = {
    kpis: { upcomingDefenses: 2, pendingTasks: 3 },
    needsAttention: [
      {
        id: "eval:sched-1",
        category: "EVALUATION",
        title: "Submit evaluation — Jane Student",
        studentName: "Jane Student",
        scheduleId: "sched-1",
        stage: "Proposal Defense",
        responsibility: "Panel Member",
        statusText: "Awaiting your score",
        date: "2026-11-12",
        actionLabel: "Open Defense Workspace",
        href: "/panelist/defense-workspace/sched-1",
        priority: 1,
      },
      {
        id: "adv-req:req-1",
        category: "ADVISER_REQUEST",
        title: "Respond to adviser request — Alex Student",
        studentName: "Alex Student",
        scheduleId: null,
        stage: null,
        responsibility: "Requested Adviser",
        statusText: "Awaiting your response",
        date: "2026-11-10",
        actionLabel: "Review Request",
        href: "/panelist/advisees?tab=requests&requestId=req-1",
        priority: 2,
      },
      {
        id: "adv-rev:sub-1",
        category: "ADVISER_MANUSCRIPT_REVIEW",
        title: "Review manuscript — Alex Student",
        studentName: "Alex Student",
        scheduleId: null,
        stage: "Proposal Defense",
        responsibility: "Thesis Adviser",
        statusText: "Submitted for review",
        date: "2026-11-11",
        actionLabel: "Open Review",
        href: "/panelist/advisees?tab=reviews&submissionId=sub-1",
        priority: 2,
      },
    ],
    activeDefenses: [
      {
        scheduleId: "sched-active",
        studentName: "Active Student",
        studentNumber: "2026-0001",
        programName: "MSCS",
        defenseType: "PROPOSAL",
        stageLabel: "Proposal Defense",
        sessionStatusLabel: "In Progress",
        roleLabel: "Chairman",
        href: "/panelist/defense-workspace/sched-active",
      },
    ],
    upcomingDefenses: [
      {
        scheduleId: "sched-up-1",
        studentName: "Future Student 1",
        studentNumber: "2026-0002",
        programName: "MSIT",
        defenseType: "FINAL",
        stageLabel: "Final Defense",
        defenseDate: "2026-11-15",
        defenseTime: "09:00:00",
        venueOrLink: "Room 301",
        roleLabel: "Panel Member",
        sessionStatusLabel: "Scheduled",
        href: "/panelist/defense-workspace/sched-up-1",
      },
      {
        scheduleId: "sched-up-2",
        studentName: "Future Student 2",
        studentNumber: "2026-0003",
        programName: "MSIT",
        defenseType: "PROPOSAL",
        stageLabel: "Proposal Defense",
        defenseDate: "2026-11-18",
        defenseTime: "14:30:00",
        venueOrLink: "https://meet.example.test/def-2",
        roleLabel: "Rapporteur",
        sessionStatusLabel: "Scheduled",
        href: "/panelist/defense-workspace/sched-up-2",
      },
    ],
    waitingOnOthers: [
      {
        id: "wait:eval:sched-1",
        studentName: "Jane Student",
        studentNumber: "2026-0004",
        recordLabel: "Proposal Defense",
        requirement: "2 panelist evaluations remaining",
        responsibleRole: "Other Panelists",
        statusText: "Waiting on committee",
        date: "2026-11-12",
        href: "/panelist/defense-workspace/sched-1",
      },
      {
        id: "wait:adviser-revision:sub-2",
        studentName: "Alex Student",
        studentNumber: "2026-0005",
        recordLabel: "Manuscript Revision",
        requirement: "Student revision after adviser feedback",
        responsibleRole: "Student",
        statusText: "Awaiting revised manuscript",
        date: "2026-11-09",
        href: "/panelist/advisees/stu-2",
      },
    ],
  };

  for (let mask = 0; mask < 8; mask++) {
    const work = access.readFacultyWork(
      dto({
        essayEvaluations: { relevant: Boolean(mask & 1) },
        myAdvisees: {
          relevant: Boolean(mask & 2),
          activeAdviseeCount: mask & 2 ? 1 : 0,
          addressedRequestCount: 0,
          issuedCertificationCount: 0,
        },
        myDefenses: {
          relevant: Boolean(mask & 4),
          assignmentCount: mask & 4 ? 2 : 0,
        },
      }),
      "self",
    );
    const projected = dashboard.projectFacultyDashboard(work, sampleData);
    const hasAdvisees = Boolean(mask & 2);
    const hasDefenses = Boolean(mask & 4);
    assert.equal(projected.hasDetailedWork, hasAdvisees || hasDefenses);
    assert.equal(projected.showUpcomingDefensesKpi, hasDefenses);
    assert.equal(projected.showUpcomingDefensesSection, hasDefenses);
    assert.equal(projected.showPendingTasksKpi, hasAdvisees || hasDefenses);
    assert.equal(projected.showNeedsAttention, hasAdvisees || hasDefenses);

    const expectedTaskCount =
      (hasAdvisees ? 2 : 0) + (hasDefenses ? 1 : 0);
    const expectedWaitingCount =
      (hasAdvisees ? 1 : 0) + (hasDefenses ? 1 : 0);
    assert.equal(projected.attention.length, expectedTaskCount);
    assert.equal(projected.waiting.length, expectedWaitingCount);
    assert.equal(
      projected.pendingTasksCount,
      hasAdvisees || hasDefenses ? expectedTaskCount : null,
    );
    assert.equal(
      projected.upcomingDefensesCount,
      hasDefenses ? 2 : null,
    );
    assert.equal(projected.activeDefenses.length, hasDefenses ? 1 : 0);
    assert.equal(projected.upcomingDefenses.length, hasDefenses ? 2 : 0);
  }
  assert.equal(dashboard.formatWallDate("2026-11-15"), "November 15, 2026");
  assert.equal(dashboard.formatWallTime("14:30:00"), "2:30 PM");
});
