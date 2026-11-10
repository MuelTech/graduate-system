/** Synthetic-only browser verification; production activation stays false. */
import {
  test,
  expect,
  type Page,
  type APIRequestContext,
} from "@playwright/test";
import { encode } from "@auth/core/jwt";

test.skip(
  process.env.E2E_FACULTY_14_FIXTURE !== "1",
  "Requires the isolated FACULTY-14 fixture server.",
);
const origin = "http://localhost:4313";
const fixture = "http://127.0.0.1:4314/__fixture";
const emptyWork = {
  essayEvaluations: { relevant: false },
  myAdvisees: {
    relevant: false,
    activeAdviseeCount: 0,
    addressedRequestCount: 0,
    issuedCertificationCount: 0,
  },
  myDefenses: { relevant: false, assignmentCount: 0 },
};
async function configure(
  request: APIRequestContext,
  value: Record<string, unknown>,
) {
  await request.post(fixture, { data: value });
}
async function snapshot(request: APIRequestContext) {
  return (await request.get(fixture)).json();
}
async function session(page: Page, identity = "future") {
  const token = await encode({
    secret: "faculty-14-synthetic-browser-fixture-only",
    salt: "authjs.session-token",
    token: {
      id: identity,
      role: identity === "legacy" ? "panelist" : "faculty",
      email: `${identity}@example.test`,
      accessToken: `faculty14-${identity}`,
      mustChangePassword: false,
    },
  });
  await page.context().addCookies([
    {
      name: "authjs.session-token",
      value: token,
      url: origin,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}
async function login(page: Page, identity = "future") {
  await page.goto("/login");
  await expect(page.locator("select option")).toHaveText([
    "Applicant",
    "Student",
    "Faculty",
    "Administrator",
  ]);
  await page.locator("select").selectOption("faculty");
  await page.locator('input[type="email"]').fill(`${identity}@example.test`);
  await page.locator('input[type="password"]').fill("fixture-password");
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL(/\/panelist\/dashboard$/);
  await expect(
    page.getByRole("heading", { name: "Faculty Dashboard", exact: true }),
  ).toBeVisible();
}
const focus = (page: Page) =>
  page.evaluate(() => window.dispatchEvent(new Event("focus")));
const nav = (page: Page) =>
  page.getByRole("navigation", { name: "Faculty navigation" });
test.beforeEach(async ({ request }) => {
  await configure(request, { reset: true });
});

for (const identity of ["future", "legacy"])
  test(`real NextAuth login with synthetic ${identity} identity reaches retained portal`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await login(page, identity);
    await expect(
      nav(page).getByRole("link", { name: "Essay Evaluations", exact: true }),
    ).toBeVisible();
    expect(errors).toEqual([]);
  });

for (let mask = 0; mask < 8; mask++)
  test(`Faculty responsibility combination ${mask} controls only its matching work`, async ({
    page,
    request,
  }) => {
    const work = structuredClone(emptyWork);
    work.essayEvaluations.relevant = Boolean(mask & 1);
    work.myAdvisees.relevant = Boolean(mask & 2);
    work.myAdvisees.activeAdviseeCount = mask & 2 ? 1 : 0;
    work.myDefenses.relevant = Boolean(mask & 4);
    work.myDefenses.assignmentCount = mask & 4 ? 1 : 0;
    await configure(request, { work });
    await session(page);
    await page.goto("/panelist/dashboard");
    await expect(
      page.getByRole("heading", { name: "Faculty Dashboard", exact: true }),
    ).toBeVisible();
    for (const [label, relevant] of [
      ["Essay Evaluations", work.essayEvaluations.relevant],
      ["My Advisees", work.myAdvisees.relevant],
      ["My Defenses", work.myDefenses.relevant],
    ] as const) {
      await expect(
        nav(page).getByRole("link", { name: label, exact: true }),
      ).toHaveCount(relevant ? 1 : 0);
    }
    await expect(
      nav(page).getByRole("link", { name: "Dashboard", exact: true }),
    ).toBeVisible();
    await expect(nav(page).getByRole("link", { name: /Admin/ })).toHaveCount(0);
    if (!mask)
      await expect(
        page.getByText("No current academic work.", { exact: true }),
      ).toBeVisible();
    if (!(mask & 6))
      expect(
        (await snapshot(request)).calls.filter((call: { path: string }) =>
          call.path.endsWith("panelist/dashboard"),
        ),
      ).toHaveLength(0);
    if (mask === 7)
      await page.screenshot({
        path: "test-results/faculty-14-dashboard-desktop.png",
        fullPage: true,
      });
  });

for (const field of [
  "addressedRequestCount",
  "issuedCertificationCount",
] as const)
  test(`${field}-only Adviser context remains reachable`, async ({
    page,
    request,
  }) => {
    const work = structuredClone(emptyWork);
    work.myAdvisees.relevant = true;
    work.myAdvisees[field] = 1;
    await configure(request, { work });
    await session(page);
    await page.goto("/panelist/dashboard");
    await nav(page)
      .getByRole("link", { name: "My Advisees", exact: true })
      .click();
    await expect(page).toHaveURL(/\/panelist\/advisees$/);
    await expect(
      page.getByRole("heading", { name: "My Advisees", exact: true }),
    ).toBeVisible();
    await page.goto("/panelist/advisees?tab=requests");
    await expect(
      page.getByRole("tab", { name: /Adviser Requests/ }),
    ).toHaveAttribute("aria-selected", "true");
    await page.goto("/panelist/advisees?tab=reviews");
    await expect(
      page.getByRole("tab", { name: /Manuscript Reviews/ }),
    ).toHaveAttribute("aria-selected", "true");
  });

test("External evaluator/Defense Faculty has read-only Profile and no Adviser navigation", async ({
  page,
  request,
}) => {
  const work = structuredClone(emptyWork);
  work.essayEvaluations.relevant = true;
  work.myDefenses = { relevant: true, assignmentCount: 1 };
  await configure(request, { work, external: true });
  await session(page);
  await page.goto("/panelist/profile");
  await expect(
    page.getByRole("heading", { name: "Faculty Profile" }),
  ).toBeVisible();
  await expect(page.getByText("External", { exact: true })).toBeVisible();
  await expect(page.getByRole("switch")).toHaveCount(0);
  await expect(
    nav(page).getByRole("link", { name: "My Advisees", exact: true }),
  ).toHaveCount(0);
  expect(
    (await snapshot(request)).calls.some(
      (call: { method: string; path: string }) =>
        call.method === "PATCH" || call.path.includes("availability"),
    ),
  ).toBe(false);
});

test("focus refresh removes revoked work and access failure never leaves stale navigation", async ({
  page,
  request,
}) => {
  await session(page);
  await page.goto("/panelist/dashboard");
  await expect(
    nav(page).getByRole("link", { name: "Essay Evaluations", exact: true }),
  ).toBeVisible();
  await configure(request, { work: emptyWork });
  await focus(page);
  await expect(
    nav(page).getByRole("link", { name: "Essay Evaluations", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText("No current academic work.", { exact: true }),
  ).toBeVisible();
  await configure(request, { accessFailure: 503 });
  await focus(page);
  await expect(
    page.getByText("Account access is temporarily unavailable.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "My Defenses", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Retry account access" })).toBeVisible();
  await configure(request, { accessFailure: 0 });
  await focus(page);
  await expect(
    page.getByRole("heading", { name: "Faculty Dashboard", exact: true }),
  ).toBeVisible();
});

test("direct unavailable Essay route refreshes access and presents a safe Dashboard return", async ({
  page,
  request,
}) => {
  await configure(request, { work: emptyWork });
  await session(page);
  await page.goto("/panelist/essay-evaluations/future-application");
  await expect(
    page.getByText("Your access has changed.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Return to Dashboard" }),
  ).toHaveAttribute("href", "/panelist/dashboard");
  expect(
    (await snapshot(request)).calls.filter((call: { path: string }) =>
      call.path.startsWith("/api/exam/essay-evaluations"),
    ),
  ).toHaveLength(0);
});

test("queue traverses empty scans, renders narrow context and loads exact detail/image", async ({
  page,
  request,
}) => {
  await session(page);
  await page.goto("/panelist/essay-evaluations");
  await expect(
    page.getByRole("link", { name: /^Review Essay for/ }),
  ).toBeVisible();
  await expect(
    page.getByText("No pending essay evaluations.", { exact: true }),
  ).toHaveCount(0);
  const scans = (await snapshot(request)).calls.filter(
    (call: { path: string }) => call.path === "/api/exam/essay-evaluations",
  );
  expect(scans.map((call: { search: string }) => call.search)).toEqual([
    "",
    "?cursor=scan-a",
    "?cursor=scan-b",
  ]);
  await page.getByRole("link", { name: /^Review Essay for/ }).click();
  await expect(
    page.getByRole("heading", { name: "Essay Question", exact: true }),
  ).toBeVisible();
  await expect(
    page.locator("strong", { hasText: "research method" }),
  ).toBeVisible();
  await expect(page.getByAltText("Essay question stimulus")).toBeVisible();
  expect(
    await page
      .getByAltText("Essay question stimulus")
      .evaluate((image) => (image as HTMLImageElement).naturalWidth),
  ).toBeGreaterThan(0);
  expect(
    (await snapshot(request)).calls.some(
      (call: { path: string }) =>
        call.path ===
        "/api/exam/essay-evaluations/future-application/media/synthetic-image/content",
    ),
  ).toBe(true);
  await expect(
    page.getByText("Maximum score:", { exact: false }),
  ).toContainText("10");
  expect(
    await page.getByText(/Exact response whitespace/).textContent(),
  ).toMatch(/^  Exact response whitespace\.\n\n/);
  await expect(page.locator("main")).not.toContainText(
    /MCQ|PASS\/FAIL|Passing Threshold|Result computed|Reconsider/,
  );
  await page.screenshot({
    path: "test-results/faculty-14-detail-desktop.png",
    fullPage: true,
  });
});

for (const responseState of ["MISSING", "BLANK"])
  test(`detail preserves ${responseState} response state`, async ({
    page,
    request,
  }) => {
    await configure(request, { responseState, stimulusType: "STRUCTURED" });
    await session(page);
    await page.goto("/panelist/essay-evaluations/future-application");
    await expect(
      page.getByText(
        responseState === "MISSING"
          ? "No response was recorded."
          : "The response was left blank.",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(page.getByRole("table", { name: "Matrix" })).toBeVisible();
  });

for (const mode of ["empty", "repeat"])
  test(`queue ${mode} is distinguished from dormant/unavailable`, async ({
    page,
    request,
  }) => {
    await configure(request, { queueMode: mode });
    await session(page);
    await page.goto("/panelist/essay-evaluations");
    if (mode === "empty")
      await expect(
        page.getByText("No pending essay evaluations.", { exact: true }),
      ).toBeVisible();
    else {
      await expect(
        page.getByText(
          "Essay Evaluations is temporarily unavailable. Try again.",
          { exact: true },
        ),
      ).toBeVisible();
      await expect(
        page.getByText("No pending essay evaluations.", { exact: true }),
      ).toHaveCount(0);
    }
  });
test("dormant 503 has Retry and does not fabricate an empty queue", async ({
  page,
  request,
}) => {
  await configure(request, { queueFailure: 503 });
  await session(page);
  await page.goto("/panelist/essay-evaluations");
  await expect(
    page.getByText("Essay Evaluations is temporarily unavailable. Try again.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText("No pending essay evaluations.", { exact: true }),
  ).toHaveCount(0);
  await configure(request, { queueFailure: 0 });
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(
    page.getByRole("link", { name: /^Review Essay for/ }),
  ).toBeVisible();
});

for (const score of ["0", "0.5"])
  test(`immutable score ${score}: confirmation, one write, narrow success and queue refresh`, async ({
    page,
    request,
  }) => {
    await configure(request, { gradeDelay: 250 });
    await session(page);
    await page.goto("/panelist/essay-evaluations/future-application");
    await page.getByLabel("Essay Score", { exact: true }).fill("11");
    await page
      .getByRole("button", { name: "Save Evaluation", exact: true })
      .click();
    await expect(
      page.getByText("Enter a score from 0 to 10.", { exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.getByLabel("Essay Score", { exact: true }).fill(score);
    await page
      .getByRole("button", { name: "Save Evaluation", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toContainText(
      `Essay Score: ${score} / 10`,
    );
    await expect(page.getByRole("dialog")).toContainText("cannot be regraded");
    await page.screenshot({
      path: `test-results/faculty-14-confirm-${score}.png`,
    });
    await page
      .getByRole("button", { name: "Confirm Evaluation", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Saving…", exact: true }),
    ).toBeDisabled();
    await expect(page).toHaveURL(/\/panelist\/essay-evaluations$/);
    await expect(
      page.getByText("Essay evaluation saved.", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("No pending essay evaluations.", { exact: true }),
    ).toBeVisible();
    expect((await snapshot(request)).grades).toEqual([
      { essayScore: Number(score) },
    ]);
  });

for (const status of [400, 404, 409, 503])
  test(`grade ${status} preserves truthful recovery without regrade`, async ({
    page,
    request,
  }) => {
    await configure(request, { gradeFailure: status });
    await session(page);
    await page.goto("/panelist/essay-evaluations/future-application");
    await page.getByLabel("Essay Score", { exact: true }).fill("3.5");
    await page
      .getByRole("button", { name: "Save Evaluation", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Confirm Evaluation", exact: true })
      .click();
    if ([404, 409].includes(status)) {
      await expect(
        page.getByText("This essay is no longer available for evaluation.", {
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Save Evaluation", exact: true }),
      ).toHaveCount(0);
      await expect(
        page.getByRole("link", {
          name: "Return to Essay Evaluations",
          exact: true,
        }),
      ).toBeVisible();
    } else {
      await expect(page.getByLabel("Essay Score", { exact: true })).toHaveValue(
        "3.5",
      );
      await expect(page.getByRole("main").getByRole("alert")).toContainText(
        status === 400 ? "Check the essay score" : "temporarily unavailable",
      );
    }
  });
test("grade 403 refreshes current work and removes a revoked Essay destination without signing out", async ({
  page,
  request,
}) => {
  await session(page);
  await page.goto("/panelist/essay-evaluations/future-application");
  await page.getByLabel("Essay Score", { exact: true }).fill("2");
  await page
    .getByRole("button", { name: "Save Evaluation", exact: true })
    .click();
  await configure(request, { gradeFailure: 403, work: emptyWork });
  await page
    .getByRole("button", { name: "Confirm Evaluation", exact: true })
    .click();
  await expect(
    page.getByText("Your access has changed.", { exact: true }),
  ).toBeVisible();
  await expect(
    nav(page).getByRole("link", { name: "Essay Evaluations", exact: true }),
  ).toHaveCount(0);
  await expect(page).not.toHaveURL(/\/login/);
});

test("mobile/collapsed sidebar, keyboard confirmation and long content remain usable", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await session(page);
  await page.goto("/panelist/dashboard");
  await page
    .getByRole("button", { name: "Collapse navigation", exact: true })
    .click();
  await expect(
    nav(page).getByRole("link", { name: "Essay Evaluations", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/faculty-14-sidebar-collapsed.png",
  });
  await page
    .getByRole("button", { name: "Expand navigation", exact: true })
    .click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("button", { name: "Open navigation", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "EARIST Faculty Portal", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Open navigation", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await nav(page)
    .getByRole("link", { name: "Essay Evaluations", exact: true })
    .click();
  await page.getByRole("link", { name: /^Review Essay for/ }).click();
  const input = page.getByLabel("Essay Score", { exact: true });
  await input.fill("5");
  await input.press("Tab");
  await expect(
    page.getByRole("button", { name: "Save Evaluation", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Save Evaluation", exact: true }),
  ).toBeFocused();
  await page.screenshot({
    path: "test-results/faculty-14-detail-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});

test("logout/account switch discards private Faculty profile state", async ({
  page,
}) => {
  await session(page);
  await page.goto("/panelist/profile");
  await expect(
    page.getByText("Research — future", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sign Out", exact: true }).click();
  await expect(page).toHaveURL(/\/login/);
  await login(page, "legacy");
  await nav(page).getByRole("link", { name: "Profile", exact: true }).click();
  await expect(
    page.getByText("Research — legacy", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Research — future", { exact: true }),
  ).toHaveCount(0);
});

test("sign-in waits for initial session bootstrap", async ({ page }) => {
  let release = () => {};
  const ready = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/auth/session", async (route) => {
    await ready;
    await route.continue();
  });
  await page.goto("/login");
  await expect(
    page.getByRole("button", { name: "Sign In", exact: true }),
  ).toBeDisabled();
  release();
  await expect(
    page.getByRole("button", { name: "Sign In", exact: true }),
  ).toBeEnabled();
});

test("additional visible pages traverse empty scans before appending", async ({
  page,
  request,
}) => {
  await configure(request, { queueMode: "continuation" });
  await session(page);
  await page.goto("/panelist/essay-evaluations");
  await expect(
    page.getByRole("link", { name: /^Review Essay for/ }),
  ).toHaveCount(1);
  await page.getByRole("button", { name: "Load More", exact: true }).click();
  await expect(
    page.getByRole("link", { name: /^Review Essay for/ }),
  ).toHaveCount(2);
  await expect(
    page.getByRole("button", { name: "Load More", exact: true }),
  ).toHaveCount(0);
});

test("queue 403 refreshes revoked work and queue 401 expires the session", async ({
  page,
  request,
}) => {
  await configure(request, { queueFailure: 403, revokeOnQueue: true });
  await session(page);
  await page.goto("/panelist/essay-evaluations");
  await expect(
    page.getByText("Your access has changed.", { exact: true }),
  ).toBeVisible();
  await expect(
    nav(page).getByRole("link", { name: "Essay Evaluations", exact: true }),
  ).toHaveCount(0);
  await expect(page).not.toHaveURL(/\/login/);
  await configure(request, { reset: true, queueFailure: 401 });
  await page.goto("/panelist/essay-evaluations");
  await expect(page).toHaveURL(/\/login/);
});

test("exact image failure has Retry and successfully replaces its object URL", async ({
  page,
  request,
}) => {
  await configure(request, { mediaFailure: 503 });
  await session(page);
  await page.goto("/panelist/essay-evaluations/future-application");
  await expect(
    page.getByText("Essay image is unavailable.", { exact: true }),
  ).toBeVisible();
  await configure(request, { mediaFailure: 0 });
  await page.getByRole("button", { name: "Retry image", exact: true }).click();
  await expect(page.getByAltText("Essay question stimulus")).toBeVisible();
  expect(
    await page
      .getByAltText("Essay question stimulus")
      .evaluate((image) => (image as HTMLImageElement).naturalWidth),
  ).toBeGreaterThan(0);
});

test("an account switch while open remounts the private query scope", async ({
  page,
}) => {
  await session(page);
  await page.goto("/panelist/profile");
  await expect(
    page.getByText("Research — future", { exact: true }),
  ).toBeVisible();
  await session(page, "legacy");
  await page.evaluate(() =>
    document.dispatchEvent(new Event("visibilitychange")),
  );
  await expect(
    page.getByText("Research — legacy", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Research — future", { exact: true }),
  ).toHaveCount(0);
});

test("immersive Defense route retains the exact schedule and omits Faculty portal chrome", async ({
  page,
}) => {
  await session(page);
  await page.route(
    "**/api/thesis/defense/synthetic-schedule/workspace",
    (route) =>
      route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ error: "Synthetic unavailable defense" }),
      }),
  );
  await page.goto("/panelist/defense-workspace/synthetic-schedule");
  await expect(
    page.getByText("Synthetic unavailable defense", { exact: true }),
  ).toBeVisible();
  await expect(nav(page)).toHaveCount(0);
  await expect(page.getByText("Faculty Portal", { exact: true })).toHaveCount(
    0,
  );
  await expect(page).toHaveURL(
    /\/panelist\/defense-workspace\/synthetic-schedule$/,
  );
});

const richDashboardData = {
  kpis: { upcomingDefenses: 2, pendingTasks: 6 },
  needsAttention: [
    {
      id: "eval:sched-active",
      category: "EVALUATION",
      title: "Submit evaluation — Maria Clara Dela Cruz",
      studentName: "Maria Clara Dela Cruz",
      scheduleId: "sched-active",
      stage: "Proposal Defense",
      responsibility: "Panel Member",
      statusText: "Awaiting your score",
      date: "2026-11-10",
      actionLabel: "Open Defense Workspace",
      href: "/panelist/defense-workspace/sched-active",
      priority: 1,
    },
    {
      id: "chair:sched-2",
      category: "CHAIRMAN_CONCLUSION",
      title: "Record committee decision — Juan Luna",
      studentName: "Juan Luna",
      scheduleId: "sched-2",
      stage: "Final Defense",
      responsibility: "Chairman",
      statusText: "All scores submitted",
      date: "2026-11-10",
      actionLabel: "Open Defense Workspace",
      href: "/panelist/defense-workspace/sched-2",
      priority: 1,
    },
    {
      id: "rap:sched-3",
      category: "RAPPORTEUR_FINALIZE",
      title: "Finalize committee report — Jose Rizal",
      studentName: "Jose Rizal",
      scheduleId: "sched-3",
      stage: "Title Defense",
      responsibility: "Rapporteur",
      statusText: "Draft in progress",
      date: "2026-11-11",
      actionLabel: "Open Defense Workspace",
      href: "/panelist/defense-workspace/sched-3",
      priority: 1,
    },
    {
      id: "sig:sched-4",
      category: "RAP_SIGNATURE",
      title: "Sign committee report — Gabriela Silang",
      studentName: "Gabriela Silang",
      scheduleId: "sched-4",
      stage: "Proposal Defense",
      responsibility: "Panel Member",
      statusText: "Frozen for signature",
      date: "2026-11-11",
      actionLabel: "Open Defense Workspace",
      href: "/panelist/defense-workspace/sched-4",
      priority: 1,
    },
    {
      id: "adv-req:req-101",
      category: "ADVISER_REQUEST",
      title: "Respond to adviser request — Melchora Aquino",
      studentName: "Melchora Aquino",
      scheduleId: null,
      stage: null,
      responsibility: "Requested Adviser",
      statusText: "Awaiting your response",
      date: "2026-11-12",
      actionLabel: "Review Request",
      href: "/panelist/advisees?tab=requests&requestId=req-101",
      priority: 2,
    },
    {
      id: "adv-rev:sub-202",
      category: "ADVISER_MANUSCRIPT_REVIEW",
      title: "Review manuscript — Andres Bonifacio",
      studentName: "Andres Bonifacio",
      scheduleId: null,
      stage: "Proposal Defense",
      responsibility: "Thesis Adviser",
      statusText: "Submitted for review",
      date: "2026-11-12",
      actionLabel: "Open Review",
      href: "/panelist/advisees?tab=reviews&submissionId=sub-202",
      priority: 2,
    },
  ],
  activeDefenses: [
    {
      scheduleId: "sched-active",
      studentName: "Maria Clara Dela Cruz",
      studentNumber: "2026-1001",
      programName: "Master in Information Technology",
      defenseType: "PROPOSAL",
      stageLabel: "Proposal Defense",
      sessionStatusLabel: "In Progress",
      roleLabel: "Panel Member",
      href: "/panelist/defense-workspace/sched-active",
    },
  ],
  upcomingDefenses: [
    {
      scheduleId: "sched-up-1",
      studentName: "Apolinario Mabini",
      studentNumber: "2026-1002",
      programName: "Doctor in Public Administration",
      defenseType: "FINAL",
      stageLabel: "Final Defense",
      defenseDate: "2026-11-15",
      defenseTime: "09:00:00",
      venueOrLink: "Graduate School Conference Room 204",
      roleLabel: "Chairman",
      sessionStatusLabel: "Scheduled",
      href: "/panelist/defense-workspace/sched-up-1",
    },
    {
      scheduleId: "sched-up-2",
      studentName: "Emilio Jacinto",
      studentNumber: "2026-1003",
      programName: "Master of Arts in Education",
      defenseType: "PROPOSAL",
      stageLabel: "Proposal Defense",
      defenseDate: "2026-11-18",
      defenseTime: "14:30:00",
      venueOrLink: "https://meet.example.test/defense-jacinto",
      roleLabel: "Rapporteur",
      sessionStatusLabel: "Scheduled",
      href: "/panelist/defense-workspace/sched-up-2",
    },
  ],
  waitingOnOthers: [
    {
      id: "wait:eval:sched-2",
      studentName: "Juan Luna",
      studentNumber: "2026-1004",
      recordLabel: "Final Defense",
      requirement: "1 panelist evaluation remaining",
      responsibleRole: "Other Panelists",
      statusText: "Waiting on committee",
      date: "2026-11-10",
      href: "/panelist/defense-workspace/sched-2",
    },
    {
      id: "wait:adviser-revision:sub-303",
      studentName: "Gregoria De Jesus",
      studentNumber: "2026-1005",
      recordLabel: "Manuscript Revision",
      requirement: "Student revision after adviser feedback",
      responsibleRole: "Student",
      statusText: "Awaiting revised manuscript",
      date: "2026-11-09",
      href: "/panelist/advisees/stu-303",
    },
  ],
};

const sampleNotifications = [
  {
    id: "notif-1",
    title: "Defense Schedule Confirmed",
    message: "Final Defense for Apolinario Mabini is scheduled on Nov 15, 2026.",
    isRead: false,
    createdAt: "2026-11-10T08:00:00.000Z",
  },
  {
    id: "notif-2",
    title: "New Adviser Request",
    message: "Melchora Aquino submitted an formal adviser request.",
    isRead: true,
    createdAt: "2026-11-09T10:30:00.000Z",
  },
];

test("UIUX-3E Part A: sidebar stays stable without vertical shift during route navigation and pending /auth/me revalidation while destination route stays gated", async ({
  page,
  request,
}) => {
  let releaseInitial = () => {};
  const initialGate = new Promise<void>((resolve) => {
    releaseInitial = resolve;
  });
  let holdInitial = true;
  let releaseRouteRefresh = () => {};
  let routeRefreshGate: Promise<void> | null = null;

  await page.route("**/api/auth/me", async (route) => {
    if (holdInitial) {
      holdInitial = false;
      await initialGate;
    } else if (routeRefreshGate) {
      await routeRefreshGate;
    }
    await route.continue();
  });

  await session(page);
  await page.goto("/panelist/dashboard");

  // Initial load before /auth/me resolves withholds conditional items
  await expect(
    nav(page).getByRole("link", { name: "Dashboard", exact: true }),
  ).toBeVisible();
  await expect(
    nav(page).getByRole("link", { name: "Essay Evaluations", exact: true }),
  ).toHaveCount(0);
  releaseInitial();

  // Wait for initial resolution
  await expect(
    page.getByRole("heading", { name: "Faculty Dashboard", exact: true }),
  ).toBeVisible();
  await expect(
    nav(page).getByRole("link", { name: "Essay Evaluations", exact: true }),
  ).toBeVisible();
  await expect(
    nav(page).getByRole("link", { name: "My Defenses", exact: true }),
  ).toBeVisible();
  await expect(
    nav(page).getByRole("link", { name: "My Advisees", exact: true }),
  ).toBeVisible();

  const sigBefore = await nav(page)
    .getByRole("link", { name: "E-Signatures", exact: true })
    .boundingBox();
  expect(sigBefore).not.toBeNull();

  // Hold the route-change /auth/me refresh deterministically
  routeRefreshGate = new Promise<void>((resolve) => {
    releaseRouteRefresh = resolve;
  });
  await nav(page)
    .getByRole("link", { name: "Essay Evaluations", exact: true })
    .click();

  // Protected destination content is gated by FacultyRouteGate during revalidation
  await expect(
    page.getByRole("status", { name: "Loading account access" }),
  ).toBeVisible();

  // While /auth/me refresh is in flight, conditional links remain visible and E-Signatures does not shift
  await expect(
    nav(page).getByRole("link", { name: "Essay Evaluations", exact: true }),
  ).toBeVisible();
  await expect(
    nav(page).getByRole("link", { name: "My Defenses", exact: true }),
  ).toBeVisible();
  await expect(
    nav(page).getByRole("link", { name: "My Advisees", exact: true }),
  ).toBeVisible();
  const sigDuring = await nav(page)
    .getByRole("link", { name: "E-Signatures", exact: true })
    .boundingBox();
  expect(sigDuring?.y).toBe(sigBefore?.y);

  // Confirm no protected Essay queue API call fired while /auth/me refresh is pending
  expect(
    (await snapshot(request)).calls.filter((call: { path: string }) =>
      call.path.startsWith("/api/exam/essay-evaluations"),
    ),
  ).toHaveLength(0);

  await page.screenshot({
    path: "test-results/uiux-3e-pending-access-refresh.png",
  });

  // Release /auth/me and confirm protected route content renders with zero sidebar vertical shift
  routeRefreshGate = null;
  releaseRouteRefresh();
  await expect(
    page.getByRole("link", { name: /^Review Essay for/ }),
  ).toBeVisible();
  const sigAfter = await nav(page)
    .getByRole("link", { name: "E-Signatures", exact: true })
    .boundingBox();
  expect(sigAfter?.y).toBe(sigBefore?.y);
  await page.screenshot({
    path: "test-results/uiux-3e-sidebar-expanded-stable.png",
  });
});

test("UIUX-3E Part B: Richer Faculty Dashboard renders mixed responsibilities, active/upcoming defenses, task expansion, collapsible waiting section, and notifications", async ({
  page,
  request,
}) => {
  await configure(request, {
    dashboardData: richDashboardData,
    notificationsData: sampleNotifications,
  });
  await session(page);
  await page.goto("/panelist/dashboard");

  await expect(
    page.getByRole("heading", { name: "Faculty Dashboard", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Refresh", exact: true }),
  ).toBeVisible();

  // KPIs: Upcoming Defenses = 2, Pending Tasks = 6 (never includes the 2 waiting items)
  await expect(page.getByTestId("kpi-upcoming-defenses")).toContainText("2");
  await expect(page.getByTestId("kpi-pending-tasks")).toContainText("6");

  // Active Defense banner is shown
  const activeCard = page.getByTestId("active-defense-card");
  await expect(activeCard).toBeVisible();
  await expect(activeCard).toContainText("Maria Clara Dela Cruz");
  await expect(activeCard).toContainText("In progress");

  // Needs Your Attention initially shows 5 tasks with "Show 1 more task"
  const attentionCard = page.getByTestId("needs-attention-card");
  await expect(attentionCard).toContainText("6 tasks");
  await expect(
    attentionCard.getByText("Submit evaluation — Maria Clara Dela Cruz"),
  ).toBeVisible();
  await expect(
    attentionCard.getByText("Review manuscript — Andres Bonifacio"),
  ).toHaveCount(0);
  await attentionCard
    .getByRole("button", { name: "Show 1 more task", exact: true })
    .click();
  await expect(
    attentionCard.getByText("Review manuscript — Andres Bonifacio"),
  ).toBeVisible();

  // Waiting on Others is collapsed by default, retains its independent count (2 waiting), and expands on click
  const waitingSection = page.getByTestId("waiting-on-others-section");
  await expect(waitingSection).toBeVisible();
  await expect(page.getByTestId("waiting-on-others-count")).toHaveText(
    "2 waiting",
  );
  const waitingToggle = waitingSection.getByRole("button", {
    name: /Waiting on Others/,
  });
  await expect(waitingToggle).toHaveAttribute("aria-expanded", "false");
  await expect(
    waitingSection.getByText("Gregoria De Jesus"),
  ).toHaveCount(0);
  await waitingToggle.click();
  await expect(waitingToggle).toHaveAttribute("aria-expanded", "true");
  await expect(
    waitingSection.getByText(/Gregoria De Jesus/),
  ).toBeVisible();

  // Upcoming Defense Sessions highlights nearest session and lists subsequent session
  const upcomingSection = page.getByTestId("upcoming-defenses-section");
  await expect(upcomingSection).toBeVisible();
  await expect(page.getByTestId("next-defense-highlight")).toContainText(
    "Apolinario Mabini",
  );
  await expect(page.getByTestId("next-defense-highlight")).toContainText(
    "November 15, 2026 · 9:00 AM",
  );
  await expect(page.getByTestId("next-defense-highlight")).toContainText(
    "Graduate School Conference Room 204",
  );
  await expect(upcomingSection).toContainText("Emilio Jacinto");

  // Recent Notifications renders actual account notifications
  const notifSection = page.getByTestId("recent-notifications-section");
  await expect(notifSection).toContainText("Defense Schedule Confirmed");
  await expect(notifSection).toContainText("New Adviser Request");

  await page.screenshot({
    path: "test-results/uiux-3e-dashboard-mixed.png",
    fullPage: true,
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "test-results/uiux-3e-dashboard-mixed-mobile.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Open navigation", exact: true })
    .click();
  await page.screenshot({
    path: "test-results/uiux-3e-sidebar-mobile.png",
  });
  await page.keyboard.press("Escape");
});

test("UIUX-3E Part B: dynamic dashboard variants for Essay-only, Adviser-only, Defense-only, External Faculty, and no-work accounts", async ({
  page,
  request,
}) => {
  await session(page);

  // 1. Essay Evaluator only: Your Work + Recent Notifications only; no KPIs or Defense/Attention sections
  const essayOnly = structuredClone(emptyWork);
  essayOnly.essayEvaluations.relevant = true;
  await configure(request, {
    work: essayOnly,
    dashboardData: richDashboardData,
    notificationsData: sampleNotifications,
  });
  await page.goto("/panelist/dashboard");
  await expect(
    page.getByRole("heading", { name: "Essay Evaluations", exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("kpi-upcoming-defenses")).toHaveCount(0);
  await expect(page.getByTestId("kpi-pending-tasks")).toHaveCount(0);
  await expect(page.getByTestId("needs-attention-card")).toHaveCount(0);
  await expect(page.getByTestId("upcoming-defenses-section")).toHaveCount(0);
  await expect(page.getByTestId("recent-notifications-section")).toBeVisible();

  // 2. Internal Adviser only: Pending Tasks KPI (2 adviser tasks), Needs Your Attention (adviser tasks + 1 adviser waiting item), no Upcoming Defenses KPI/section
  const adviserOnly = structuredClone(emptyWork);
  adviserOnly.myAdvisees = {
    relevant: true,
    activeAdviseeCount: 2,
    addressedRequestCount: 1,
    issuedCertificationCount: 0,
  };
  await configure(request, {
    work: adviserOnly,
    dashboardData: richDashboardData,
  });
  await focus(page);
  await expect(page.getByTestId("kpi-upcoming-defenses")).toHaveCount(0);
  await expect(page.getByTestId("kpi-pending-tasks")).toContainText("2");
  await expect(page.getByTestId("upcoming-defenses-section")).toHaveCount(0);
  await expect(page.getByTestId("active-defense-card")).toHaveCount(0);
  await expect(page.getByTestId("waiting-on-others-count")).toHaveText(
    "1 waiting",
  );

  // 3. External Faculty (Essay + Defense, no Adviser): shows Upcoming Defenses, Pending Tasks (4 defense tasks), Active Defense, Upcoming Defense Sessions, and hides Waiting on Others when empty
  const externalWork = structuredClone(emptyWork);
  externalWork.essayEvaluations.relevant = true;
  externalWork.myDefenses = { relevant: true, assignmentCount: 2 };
  await configure(request, {
    work: externalWork,
    external: true,
    dashboardData: {
      ...richDashboardData,
      activeDefenses: [],
      waitingOnOthers: [],
    },
    notificationsData: sampleNotifications,
  });
  await focus(page);
  await expect(page.getByTestId("kpi-upcoming-defenses")).toContainText("2");
  await expect(page.getByTestId("kpi-pending-tasks")).toContainText("4");
  await expect(page.getByTestId("active-defense-card")).toHaveCount(0);
  await expect(page.getByTestId("waiting-on-others-section")).toHaveCount(0);
  await expect(page.getByTestId("upcoming-defenses-section")).toBeVisible();
  await page.screenshot({
    path: "test-results/uiux-3e-dashboard-external.png",
    fullPage: true,
  });

  // 4. No-work Faculty account
  await configure(request, {
    work: emptyWork,
    notificationsData: [],
  });
  await focus(page);
  await expect(
    page.getByText("No current academic work.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("No notifications to show.", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/uiux-3e-dashboard-no-work.png",
    fullPage: true,
  });

  // 5. Access failure / revocation state screenshot
  await configure(request, { accessFailure: 503 });
  await focus(page);
  await expect(
    page.getByText("Account access is temporarily unavailable.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/uiux-3e-access-failure.png",
    fullPage: true,
  });
});

test("UIUX-3E Part B: dashboard tasks and notifications error/retry and account-scoped cache isolation", async ({
  page,
  request,
}) => {
  await configure(request, {
    dashboardFailure: 503,
    notificationsFailure: 503,
  });
  await session(page, "future");
  await page.goto("/panelist/dashboard");

  await expect(
    page.getByText("Unable to load your tasks.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Unable to load notifications.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("kpi-upcoming-defenses")).toContainText("—");
  await expect(page.getByTestId("kpi-pending-tasks")).toContainText("—");

  await configure(request, {
    dashboardFailure: 0,
    notificationsFailure: 0,
    dashboardData: {
      future: richDashboardData,
      legacy: {
        kpis: { upcomingDefenses: 0, pendingTasks: 0 },
        needsAttention: [],
        activeDefenses: [],
        upcomingDefenses: [],
        waitingOnOthers: [],
      },
    },
    notificationsData: {
      future: sampleNotifications,
      legacy: [
        {
          id: "legacy-notif",
          title: "Legacy Account Notification",
          message: "Only visible to legacy identity.",
          isRead: false,
          createdAt: "2026-11-10T09:00:00.000Z",
        },
      ],
    },
  });

  await page.getByRole("button", { name: "Retry tasks", exact: true }).click();
  await page
    .getByRole("button", { name: "Retry notifications", exact: true })
    .click();

  await expect(page.getByTestId("kpi-upcoming-defenses")).toContainText("2");
  await expect(
    page.getByTestId("recent-notifications-section"),
  ).toContainText("Defense Schedule Confirmed");

  // Switch account to legacy and verify private dashboard & notification caches do not leak
  await session(page, "legacy");
  await page.evaluate(() =>
    document.dispatchEvent(new Event("visibilitychange")),
  );
  await expect(page.getByTestId("kpi-upcoming-defenses")).toContainText("0");
  await expect(
    page.getByText("No tasks need your attention.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByTestId("recent-notifications-section"),
  ).toContainText("Legacy Account Notification");
  await expect(
    page.getByTestId("recent-notifications-section"),
  ).not.toContainText("Defense Schedule Confirmed");
});
