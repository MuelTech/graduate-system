/** Implementation-agent synthetic QA. Never run against a live backend/database. */
import { test, expect, type Page } from "@playwright/test";
import { encode } from "@auth/core/jwt";
test.skip(
  process.env.E2E_ADMIN_FIXTURE !== "1",
  "Requires scripts/faculty-15-fixture-server.mjs.",
);
const origin = "http://localhost:4315",
  api = "http://127.0.0.1:4316/__fixture",
  management = "/admin/users/administrators";
const password = "Synthetic-Administrator-15-One-Time-Only";
async function state(page: Page, change?: Record<string, unknown>) {
  const response = change
    ? await page.request.post(api, { data: change })
    : await page.request.get(api);
  return response.json();
}
async function identity(page: Page, id = "actor") {
  const token = await encode({
    secret: "faculty-15-synthetic-browser-fixture-only",
    salt: "authjs.session-token",
    token: {
      id,
      role: "admin",
      email: `${id}@example.test`,
      accessToken: `admin15-${id}`,
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
async function setup(page: Page, change: Record<string, unknown> = {}) {
  await state(page, { reset: true, ...change });
  await identity(page);
}
async function go(page: Page, path = management) {
  await page.goto(path);
  await expect(
    page.locator('nav[aria-label="Admin navigation"]'),
  ).toBeAttached();
}
async function foreground(page: Page) {
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
}
async function edit(page: Page, email: string) {
  const row = page.getByRole("row").filter({ hasText: email });
  await row.getByRole("button", { name: "View", exact: true }).click();
  await page.getByRole("button", { name: "Edit Access" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(1);
}
async function newAccount(page: Page) {
  await page
    .getByRole("button", { name: "Create Administrator", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("First name").fill("Jamie");
  await dialog.getByLabel("Last name").fill("Synthetic");
  await dialog.getByLabel("Email", { exact: true }).fill("jamie@example.test");
  return dialog;
}
function forbiddenCalls(calls: { path: string }[], paths: string[]) {
  expect(
    calls.filter((call) => paths.some((path) => call.path === `/api${path}`)),
  ).toEqual([]);
}

test("Full list/detail and separate Administrators navigation", async ({
  page,
}) => {
  await setup(page);
  await go(page);
  await expect(
    page.getByRole("heading", {
      name: "Administrators Management",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Administrators", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Faculty", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("table")).toContainText("Full Administrator");
  await edit(page, "target@example.test");
  await expect(page.getByLabel("Access level")).toHaveValue("RESTRICTED");
  await expect(page.getByRole("checkbox", { name: /Essay/ })).toHaveCount(0);
});
test("create Restricted sends direct catalog actions and one-time credential clears", async ({
  page,
}) => {
  await setup(page);
  await go(page);
  const dialog = await newAccount(page);
  await dialog
    .getByRole("checkbox", { name: /Record Comprehensive Examination/ })
    .check();
  await dialog
    .getByRole("button", { name: "Create Administrator", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Administrator Created", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Temporary password")).toHaveValue(password);
  const value = await state(page);
  expect(value.writes).toHaveLength(1);
  expect(value.writes[0].body).toEqual({
    firstName: "Jamie",
    lastName: "Synthetic",
    email: "jamie@example.test",
    level: "RESTRICTED",
    capabilityKeys: ["students.comprehensive_exam.manage"],
  });
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.getByLabel("Temporary password")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Create Administrator", exact: true }),
  ).toBeFocused();
  await expect(page.locator("body")).not.toContainText(password);
});
test("create Full uses level enumeration without direct wildcard or Faculty grant", async ({
  page,
}) => {
  await setup(page);
  await go(page);
  const dialog = await newAccount(page);
  await dialog.getByLabel("Access level").selectOption("FULL");
  await expect(dialog.getByRole("checkbox")).toHaveCount(0);
  await dialog
    .getByRole("button", { name: "Create Administrator", exact: true })
    .click();
  await expect(page.getByLabel("Temporary password")).toHaveValue(password);
  expect((await state(page)).writes[0].body).toMatchObject({
    level: "FULL",
    capabilityKeys: [],
  });
});
test("create failure retains form and never supplies credentials", async ({
  page,
}) => {
  await setup(page, { createFailure: 400 });
  await go(page);
  const dialog = await newAccount(page);
  await dialog
    .getByRole("button", { name: "Create Administrator", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toHaveText(
    "Check the account details and selected access.",
  );
  await expect(dialog.getByLabel("Email", { exact: true })).toHaveValue(
    "jamie@example.test",
  );
  await expect(page.getByLabel("Temporary password")).toHaveCount(0);
});
test("last Full demotion conflict returns to retained editor", async ({
  page,
}) => {
  await setup(page);
  await go(page);
  await edit(page, "actor@example.test");
  await page.getByLabel("Access level").selectOption("RESTRICTED");
  await page.getByRole("button", { name: "Save Access", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Confirm Administrator Change" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Confirm Change", exact: true })
    .click();
  await expect(page.getByRole("dialog").getByRole("alert")).toHaveText(
    "At least one active Full Administrator must remain.",
  );
  await expect(page.getByLabel("Access level")).toHaveValue("RESTRICTED");
  expect((await state(page)).writes).toHaveLength(1);
});
test("Restricted status/grant patch confirms deactivation and preserves strict body", async ({
  page,
}) => {
  await setup(page);
  await go(page);
  await edit(page, "target@example.test");
  await page
    .getByRole("checkbox", { name: "View Students", exact: true })
    .check();
  await page.getByLabel("Account status").selectOption("inactive");
  await page.getByRole("button", { name: "Save Access", exact: true }).click();
  await expect(
    page.getByText("Deactivating this account blocks sign-in."),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Confirm Change", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect((await state(page)).writes[0].body).toEqual({
    level: "RESTRICTED",
    capabilityKeys: ["students.view"],
    isActive: false,
  });
  await expect(
    page.getByRole("row").filter({ hasText: "target@example.test" }),
  ).toContainText("Inactive");
});
test("unmapped target is visible for review without a bootstrap editor", async ({
  page,
}) => {
  await setup(page);
  await go(page);
  await page
    .getByRole("row")
    .filter({ hasText: "unmapped@example.test" })
    .getByRole("button", { name: "View", exact: true })
    .click();
  await expect(
    page.getByText(
      "This account requires access review before it can be changed.",
    ),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit Access" })).toHaveCount(
    0,
  );
});
test("dormant management 503 is an error with retry, not an empty list", async ({
  page,
}) => {
  await setup(page, { listFailure: 503 });
  await go(page);
  await expect(
    page.getByText(
      "Administrators Management is temporarily unavailable. Try again.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByText("No Administrator accounts on this page."),
  ).toHaveCount(0);
  await state(page, { listFailure: 0 });
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(page.getByRole("table")).toBeVisible();
});
test("list uses page/pageSize without an invented total", async ({ page }) => {
  await setup(page, { listMode: "pages" });
  await go(page);
  await expect(
    page.getByRole("button", { name: "Next", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText("Page 2", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Next", exact: true }),
  ).toBeDisabled();
  await expect(page.getByRole("table")).toContainText("page-2-0@example.test");
  expect(
    (await state(page)).calls.some(
      (c: { search: string }) => c.search === "?page=2&pageSize=25",
    ),
  ).toBe(true);
});
test("zero-grant Restricted has safe landing and guessed management never fetches", async ({
  page,
}) => {
  await setup(page, { level: "RESTRICTED" });
  await go(page, "/admin/dashboard");
  await expect(
    page.getByText(/No administrative modules are assigned/),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Administrators", exact: true }),
  ).toHaveCount(0);
  await go(page);
  await expect(
    page.getByText("Your access has changed.", { exact: true }),
  ).toBeVisible();
  forbiddenCalls((await state(page)).calls, [
    "/admin/dashboard",
    "/admin/administrators",
  ]);
});
test("Restricted Student-only navigation and Dashboard request minimum", async ({
  page,
}) => {
  await setup(page, { level: "RESTRICTED", keys: ["students.view"] });
  await go(page, "/admin/dashboard");
  await page
    .getByRole("button", { name: "User Management", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "Students", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Faculty", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Students", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Students", exact: true }),
  ).toBeVisible();
  forbiddenCalls((await state(page)).calls, [
    "/admin/dashboard",
    "/admin/administrators",
    "/admin/panelists",
  ]);
});
test("question read access withholds writes, configuration and question-set editor", async ({
  page,
}) => {
  await setup(page, { level: "RESTRICTED", keys: ["exam.questions.view"] });
  await go(page, "/admin/exam/questions");
  await expect(
    page.getByRole("heading", { name: /Exam Question/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: /Add Question|Create Question|Question Set|Configuration/,
    }),
  ).toHaveCount(0);
  forbiddenCalls((await state(page)).calls, [
    "/exam-engine/admin/configuration",
    "/exam-engine/admin/question-set",
  ]);
});
for (const [key, expected, forbidden] of [
  [
    "audit.view",
    "/settings/audit-logs",
    ["/settings", "/settings/email-templates", "/admin/email-logs/logs"],
  ],
  [
    "email.configuration.manage",
    "/settings/email-templates",
    ["/settings", "/settings/audit-logs", "/admin/email-logs/logs"],
  ],
  [
    "email.logs.view",
    "/admin/email-logs/logs",
    ["/settings", "/settings/audit-logs", "/settings/email-templates"],
  ],
] as const)
  test(`${key} Settings reads only its own source`, async ({ page }) => {
    await setup(page, { level: "RESTRICTED", keys: [key] });
    await go(page, "/admin/settings");
    await expect
      .poll(async () =>
        (await state(page)).calls.some(
          (call: { path: string }) => call.path === `/api${expected}`,
        ),
      )
      .toBe(true);
    forbiddenCalls((await state(page)).calls, [...forbidden]);
    await expect(page.getByRole("button", { name: /Delete/ })).toHaveCount(0);
  });
test("configuration-only Settings exposes existing editor without Settings read", async ({
  page,
}) => {
  await setup(page, {
    level: "RESTRICTED",
    keys: ["exam.configuration.manage"],
  });
  await go(page, "/admin/settings");
  await expect(
    page.getByRole("button", { name: "Open Exam Configuration" }),
  ).toBeVisible();
  forbiddenCalls((await state(page)).calls, [
    "/settings",
    "/exam-engine/admin/configuration",
  ]);
});
test("Settings view access cannot change fields or save", async ({ page }) => {
  await setup(page, { level: "RESTRICTED", keys: ["settings.view"] });
  await go(page, "/admin/settings");
  await expect(page.getByRole("combobox").first()).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Save Academic Year Settings" }),
  ).toHaveCount(0);
});
test("revocation during an open editor clears cached rows and closes controls", async ({
  page,
}) => {
  await setup(page);
  await go(page);
  await edit(page, "target@example.test");
  await state(page, { level: "RESTRICTED", keys: [] });
  await foreground(page);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByText("Your access has changed.", { exact: true }),
  ).toBeVisible();
  await expect(page.locator("body")).not.toContainText("target@example.test");
  expect((await state(page)).writes).toHaveLength(0);
});
test("access outage removes private content and foreground recovery reloads", async ({
  page,
}) => {
  await setup(page);
  await go(page);
  await expect(page.getByRole("table")).toBeVisible();
  await state(page, { accessFailure: 503 });
  await foreground(page);
  await expect(
    page.getByText("Administrator access is temporarily unavailable.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator("body")).not.toContainText("target@example.test");
  await state(page, { accessFailure: 0 });
  await foreground(page);
  await expect(page.getByRole("table")).toBeVisible();
});
test("same-browser account switch never reuses private management data", async ({
  page,
}) => {
  await setup(page);
  await go(page);
  await expect(page.getByRole("table")).toBeVisible();
  await state(page, { level: "RESTRICTED", keys: [] });
  await identity(page, "other");
  await foreground(page);
  await expect(
    page.getByText("Your access has changed.", { exact: true }),
  ).toBeVisible();
  await expect(page.locator("body")).not.toContainText("target@example.test");
});
test("successful self-demotion refreshes current access and removes management", async ({
  page,
}) => {
  await setup(page, { lastFullConflict: false });
  await go(page);
  await edit(page, "actor@example.test");
  await page.getByLabel("Access level").selectOption("RESTRICTED");
  await page.getByRole("button", { name: "Save Access", exact: true }).click();
  await page
    .getByRole("button", { name: "Confirm Change", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByText("Your access has changed.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Administrators", exact: true }),
  ).toHaveCount(0);
});
test("refresh pending hides private work until access resolves", async ({
  page,
}) => {
  await setup(page);
  await go(page);
  await expect(page.getByRole("table")).toBeVisible();
  await state(page, { accessDelay: 1200 });
  await foreground(page);
  await expect(page.getByRole("table")).not.toBeVisible();
  await expect(page.getByRole("table")).toBeVisible();
});
test("mobile navigation focus, Escape return and no horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page);
  await go(page);
  await expect(page.getByRole("table")).toBeVisible();
  const opener = page.getByRole("button", { name: "Open navigation" });
  await opener.click();
  await expect(page.getByRole("link", { name: /EARIST/ })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(
    page.getByRole("button", { name: "Sign Out", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: /EARIST/ })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(opener).toBeFocused();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("table")).toBeVisible();
  await page.screenshot({
    path: "test-results/faculty-15-mobile.png",
    animations: "disabled",
    fullPage: true,
  });
});
test("desktop collapsed navigation retains labels and bounded long identities", async ({
  page,
}) => {
  await setup(page);
  await go(page);
  await expect(page.getByRole("table")).toBeVisible();
  await page.getByRole("button", { name: /Collapse/ }).click();
  await expect(
    page.getByRole("button", { name: "User Management", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "User Management", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "Administrators", exact: true }),
  ).toBeVisible();
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("table")).toBeVisible();
  await page.screenshot({
    path: "test-results/faculty-15-desktop.png",
    animations: "disabled",
    fullPage: true,
  });
});

test("open portal editor hides during refresh and retains draft after unchanged access", async ({
  page,
}) => {
  await setup(page);
  await go(page);
  await edit(page, "target@example.test");
  await page
    .getByRole("checkbox", { name: "View Students", exact: true })
    .check();
  await state(page, { accessDelay: 900 });
  await foreground(page);
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("checkbox", { name: "View Students", exact: true }),
  ).toBeChecked();
});
test("resource 403 refreshes access without an automatic request loop or logout", async ({
  page,
}) => {
  await setup(page, { listFailure: 403 });
  await go(page);
  await expect(
    page.getByText("Your access has changed. Return to the Dashboard.", {
      exact: true,
    }),
  ).toBeVisible();
  const calls = (await state(page)).calls.filter(
    (call: { path: string }) => call.path === "/api/admin/administrators",
  );
  expect(calls.length).toBeLessThanOrEqual(2);
  await expect(
    page.getByRole("button", { name: "Sign Out", exact: true }),
  ).toBeVisible();
});
test("Full Dashboard can request the existing authorized aggregate", async ({
  page,
}) => {
  await setup(page);
  await go(page, "/admin/dashboard");
  await expect(
    page.getByText("Enrolled Graduate Students", { exact: true }),
  ).toBeVisible();
  expect(
    (await state(page)).calls.some(
      (call: { path: string }) => call.path === "/api/admin/dashboard",
    ),
  ).toBe(true);
});
test("unmapped current account has no privileged fallback while gates are dormant", async ({
  page,
}) => {
  await setup(page, { status: "MISSING_ADMIN_LEVEL" });
  await go(page);
  await expect(
    page.getByText("Administrator access is unavailable.", { exact: true }),
  ).toBeVisible();
  forbiddenCalls((await state(page)).calls, [
    "/admin/dashboard",
    "/admin/administrators",
  ]);
});
test("Schedules-only work withholds the Applications aggregate and directory assignment", async ({
  page,
}) => {
  await setup(page, { level: "RESTRICTED", keys: ["defense.schedules.view"] });
  await go(page, "/admin/thesis/scheduling");
  await expect(
    page.getByRole("button", { name: /^Scheduled/, exact: false }),
  ).toBeDisabled();
  forbiddenCalls((await state(page)).calls, [
    "/thesis/defense/applications/summary",
    "/thesis/defense/applications",
  ]);
  await state(page, { keys: ["exam.schedules.manage"] });
  await go(page, "/admin/exam/slots");
  await expect(
    page.getByRole("button", { name: "Create Schedule", exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Assign Applicant", exact: true }),
  ).toHaveCount(0);
  forbiddenCalls((await state(page)).calls, ["/admin/applicants"]);
});
