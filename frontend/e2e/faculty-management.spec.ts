/** Synthetic FACULTY-11 contract QA only; requires scripts/faculty-11-fixture-server.mjs. */
import { test, expect, type Page } from "@playwright/test";
import { encode } from "@auth/core/jwt";

test.skip(
  process.env.E2E_FACULTY_FIXTURE !== "1",
  "Run only against the isolated Faculty fixture server.",
);
const route = "/admin/users/panelists";
const origin = "http://localhost:4311";
const temporaryPassword = "Synthetic-One-Time-Credential-Only";
function faculty(id = "internal", external = false) {
  return {
    id,
    userId: `user-${id}`,
    highestEducationalAttainment: "Doctorate",
    officeAffiliation: "Graduate School",
    specialization: "Research",
    isActive: true,
    isExternal: external,
    isAvailableAsAdviser: !external,
    capabilityKeys: external ? [] : ["essay.evaluate"],
    createdAt: "2026-11-09T00:00:00Z",
    user: {
      id: `user-${id}`,
      role: "FACULTY",
      firstName: external ? "Eden" : "Alex",
      lastName: "Faculty",
      title: null,
      suffix: null,
      email: `${id}@example.test`,
      isActive: true,
      createdAt: "2026-11-09T00:00:00Z",
      updatedAt: "2026-11-09T00:00:00Z",
      createdBy: null,
      updatedBy: null,
    },
  };
}
async function setup(page: Page) {
  const token = await encode({
    secret: "faculty-11-synthetic-browser-fixture-only",
    salt: "authjs.session-token",
    token: {
      id: "synthetic-admin",
      role: "admin",
      email: "admin@example.test",
      accessToken: "faculty-11-synthetic",
      mustChangePassword: false,
    },
  });
  await page
    .context()
    .addCookies([
      {
        name: "authjs.session-token",
        value: token,
        url: origin,
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);
  const state = {
    rows: [faculty(), faculty("external", true)],
    canManage: true,
    failure: 0,
    writeFailure: 0,
    writes: [] as { method: string; body: Record<string, unknown> }[],
    reads: 0,
    delay: null as Promise<void> | null,
  };
  await page.route("http://127.0.0.1:4312/api/**", async (request) => {
    const url = new URL(request.request().url());
    const method = request.request().method();
    const headers = {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
      "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
    };
    const respond = (body: unknown, status = 200) =>
      request.fulfill({
        status,
        headers,
        contentType: "application/json",
        body: JSON.stringify(body),
      });
    if (method === "OPTIONS") return request.fulfill({ status: 204, headers });
    if (url.pathname === "/api/auth/me") return request.continue();
    if (!url.pathname.startsWith("/api/admin/panelists")) return respond([]);
    if (state.delay) await state.delay;
    if (state.failure)
      return respond({ error: "Controlled fixture rejection" }, state.failure);
    if (url.pathname.endsWith("/management-context"))
      return respond({ canManage: state.canManage });
    if (method === "POST" || method === "PUT") {
      const body = request.request().postDataJSON();
      state.writes.push({ method, body });
      if (state.writeFailure)
        return respond(
          {
            error:
              state.writeFailure === 409
                ? "This Adviser classification requires institutional review."
                : "Invalid Faculty configuration fields.",
          },
          state.writeFailure,
        );
      const id = method === "POST" ? "created" : url.pathname.split("/").pop()!;
      const existing = state.rows.find((row) => row.id === id) ?? faculty(id);
      const updated = {
        ...existing,
        isActive: body.isActive,
        isExternal: body.isExternal,
        isAvailableAsAdviser: body.isAvailableAsAdviser,
        highestEducationalAttainment: body.highestEducationalAttainment,
        officeAffiliation: body.officeAffiliation,
        specialization: body.specialization,
        capabilityKeys: body.capabilityKeys,
        user: {
          ...existing.user,
          firstName: body.firstName.trim(),
          lastName: body.lastName.trim(),
          email: body.email,
          title: body.title,
          suffix: body.suffix,
          isActive: body.isActive,
        },
      };
      state.rows = state.rows.filter((row) => row.id !== id).concat(updated);
      return respond(
        method === "POST" ? { account: updated, temporaryPassword } : updated,
        method === "POST" ? 201 : 200,
      );
    }
    if (url.pathname === "/api/admin/panelists") {
      state.reads++;
      return respond(state.rows);
    }
    return respond(
      state.rows.find((row) => row.id === url.pathname.split("/").pop()),
      200,
    );
  });
  return state;
}

test("desktop list/detail/edit/status/conflict, authoritative refresh and view-only", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const state = await setup(page);
  await page.goto(origin + route);
  await expect(
    page.getByRole("heading", { name: "Faculty Management" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Faculty", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("table")).toContainText("Alex Faculty");
  await page
    .getByLabel("Classification", { exact: true })
    .selectOption("external");
  await expect(page.getByRole("table")).not.toContainText("Alex Faculty");
  await expect(page.getByRole("table")).toContainText("Not applicable");
  await page.getByRole("button", { name: "Clear filters" }).click();
  await page.getByRole("button", { name: "View Alex Faculty" }).click();
  await expect(
    page.getByRole("heading", { name: "Faculty Profile" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Edit Faculty", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("switch", { name: "Available as Adviser", exact: true }),
  ).toBeChecked();
  await dialog
    .getByLabel("Classification", { exact: true })
    .selectOption("external");
  await expect(
    dialog.getByRole("switch", { name: "Available as Adviser", exact: true }),
  ).toBeDisabled();
  await expect(
    dialog.getByRole("switch", { name: "Available as Adviser", exact: true }),
  ).not.toBeChecked();
  state.writeFailure = 409;
  await dialog.getByRole("button", { name: "Save Changes" }).click();
  await expect(dialog.getByRole("alert")).toContainText("institutional review");
  await expect(
    dialog.getByLabel("Classification", { exact: true }),
  ).toHaveValue("external");
  state.writeFailure = 400;
  await dialog.getByRole("button", { name: "Save Changes" }).click();
  await expect(dialog.getByRole("alert")).toContainText(
    "Check the profile fields",
  );
  state.writeFailure = 0;
  await dialog
    .getByLabel("Classification", { exact: true })
    .selectOption("internal");
  await dialog.getByLabel("First name", { exact: true }).fill("Updated");
  await dialog
    .getByRole("switch", { name: "Essay Evaluation", exact: true })
    .uncheck();
  await dialog.getByRole("switch", { name: "Active", exact: true }).uncheck();
  await dialog.getByRole("button", { name: "Save Changes" }).click();
  await expect(dialog.getByText("Deactivate this account?")).toBeVisible();
  await dialog.getByRole("button", { name: "Confirm and Save" }).click();
  await expect(dialog).toBeHidden();
  const row = page.getByRole("row").filter({ hasText: "Updated Faculty" });
  await expect(row).toContainText("Inactive");
  await expect(row).toContainText("Not enabled");
  expect(state.reads).toBeGreaterThan(1);
  expect(state.writes.at(-1)?.body).toMatchObject({
    capabilityKeys: [],
    isActive: false,
    isExternal: false,
    isAvailableAsAdviser: false,
  });
  expect(state.writes.every((write) => !("password" in write.body))).toBe(true);
  await page.screenshot({
    path: "test-results/faculty-11-desktop.png",
    fullPage: true,
  });
  state.canManage = false;
  await page.reload();
  await expect(page.getByRole("table")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Create Faculty" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "View Updated Faculty" }).click();
  await expect(
    page.getByRole("heading", { name: "Faculty Profile" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit Faculty" })).toHaveCount(
    0,
  );
  expect(errors).toEqual([]);
});

test("narrow layout, keyboard, create defaults and one-time credential handoff", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const state = await setup(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(origin + route);
  await expect(page.getByRole("table")).toBeVisible();
  await page.getByLabel("Search Faculty").focus();
  await page.keyboard.press("Tab");
  await expect(
    page.getByLabel("Classification", { exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    page.getByLabel("Account status", { exact: true }),
  ).toBeFocused();
  await page
    .getByRole("button", { name: "Create Faculty", exact: true })
    .click();
  let dialog = page.getByRole("dialog");
  await expect(
    dialog.getByLabel("Classification", { exact: true }),
  ).toHaveValue("internal");
  await expect(
    dialog.getByRole("switch", { name: "Available as Adviser", exact: true }),
  ).not.toBeChecked();
  await expect(
    dialog.getByRole("switch", { name: "Essay Evaluation", exact: true }),
  ).not.toBeChecked();
  // Escape restores the invoking action; keyboard can reopen the same modal.
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Create Faculty", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("First name", { exact: true }).fill("New");
  await dialog.getByLabel("Last name", { exact: true }).fill("Faculty");
  await dialog.getByLabel("Email", { exact: true }).fill("new@example.test");
  await dialog
    .getByRole("switch", { name: "Essay Evaluation", exact: true })
    .focus();
  await page.keyboard.press("Space");
  await expect(
    dialog.getByRole("switch", { name: "Essay Evaluation", exact: true }),
  ).toBeChecked();
  await dialog
    .getByRole("switch", { name: "Available as Adviser", exact: true })
    .check();
  await page.screenshot({
    path: "test-results/faculty-11-mobile-form.png",
    fullPage: true,
  });
  await dialog
    .getByRole("button", { name: "Create Faculty", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", { name: "Faculty Created" }),
  ).toBeVisible();
  await expect(dialog.getByLabel("Temporary password")).toHaveValue(
    temporaryPassword,
  );
  await dialog.getByRole("button", { name: "Copy", exact: true }).click();
  await expect(dialog.getByRole("status")).toHaveText("Copied.");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    temporaryPassword,
  );
  expect(
    await page.evaluate(() =>
      JSON.stringify({
        local: { ...localStorage },
        session: { ...sessionStorage },
      }),
    ),
  ).not.toContain(temporaryPassword);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(
    page.getByRole("button", { name: "Create Faculty", exact: true }),
  ).toBeFocused();
  await expect(page.getByLabel("Temporary password")).toHaveCount(0);
  await expect(page.getByRole("table")).toContainText("New Faculty");
  await page.getByRole("button", { name: "View New Faculty" }).click();
  await expect(
    page.getByRole("heading", { name: "Faculty Profile" }),
  ).toBeVisible();
  await expect(page.getByLabel("Temporary password")).toHaveCount(0);
  await page.keyboard.press("Escape");
  expect(state.writes[0].body).toMatchObject({
    capabilityKeys: ["essay.evaluate"],
    isAvailableAsAdviser: true,
    isExternal: false,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/faculty-11-mobile-list.png",
    fullPage: true,
  });
});

test("loading, genuine empty, filtered empty, dormant 503 and denied 403 with Retry", async ({
  page,
}) => {
  const state = await setup(page);
  let release!: () => void;
  state.delay = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.goto(origin + route);
  await expect(
    page.getByLabel("Loading Faculty", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("No Faculty accounts yet.")).toHaveCount(0);
  state.delay = null;
  release();
  await expect(page.getByRole("table")).toBeVisible();
  await page.getByLabel("Search Faculty").fill("missing");
  await expect(
    page.getByRole("heading", { name: "No matching Faculty." }),
  ).toBeVisible();
  state.rows = [];
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "No Faculty accounts yet." }),
  ).toBeVisible();
  state.failure = 503;
  await page.reload();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "currently unavailable",
  );
  await expect(
    page.getByRole("heading", { name: "No Faculty accounts yet." }),
  ).toHaveCount(0);
  state.failure = 403;
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "do not have access",
  );
  state.failure = 0;
  state.rows = [faculty()];
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(page.getByRole("table")).toContainText("Alex Faculty");
  await expect(page.locator("[data-nextjs-dialog]")).toHaveCount(0);
});
