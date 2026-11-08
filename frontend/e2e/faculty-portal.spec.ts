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
