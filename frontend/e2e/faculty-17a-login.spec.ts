/** Implementation-agent synthetic browser evidence, never owner QA or a real DB. */
import { test, expect, type Page } from "@playwright/test";
test.skip(process.env.E2E_FACULTY_17A_FIXTURE !== "1", "Requires scripts/faculty-17a-fixture-server.mjs");
const passwords = { faculty: "Faculty-17A-Own-Password", admin: "Admin-17A-Different-Password" };
async function login(page: Page, role: "faculty" | "admin", password = passwords[role]) {
  await page.goto("/login");
  await page.locator("select").selectOption(role);
  await page.locator('input[type="email"]').fill("person@gmail.com");
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
}
async function identity(page: Page) { return (await (await page.request.get("/api/auth/session")).json())?.user; }
for (const role of ["faculty", "admin"] as const) {
  test(`same Gmail authenticates the separate ${role} identity`, async ({ page }) => {
    await login(page, role);
    await expect(page).toHaveURL(role === "faculty" ? /\/panelist\/dashboard$/ : /\/admin\/dashboard$/);
    await expect(page.getByRole("heading", { name: role === "faculty" ? "Faculty Dashboard" : "Dashboard", exact: true })).toBeVisible();
    const user = await identity(page);
    expect(user).toMatchObject({ id: `shared-${role}`, email: "person@gmail.com", role });
    expect(user.accessToken).toBe(`faculty17a-shared-${role}`);
    if (role === "faculty") await expect(page.getByRole("link", { name: "Administrators", exact: true })).toHaveCount(0);
    else {
      await expect(page.getByRole("link", { name: "Administrators", exact: true })).toHaveCount(0);
      await page.getByRole("button", { name: "User Management", exact: true }).click();
      await expect(page.getByRole("link", { name: "Students", exact: true })).toBeVisible();
    }
    await page.screenshot({ path: `test-results/faculty17a-${role}.png`, fullPage: true });
  });
  test(`the ${role} selector rejects the other account's password without disclosing it`, async ({ page }) => {
    await login(page, role, passwords[role === "faculty" ? "admin" : "faculty"]);
    await expect(page.getByText("Invalid credentials. Please check your details and try again.", { exact: true })).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.locator("body")).not.toContainText(/Account does not match|another account|different role/i);
    expect(await identity(page)).toBeUndefined();
  });
}
test("changing accounts requires sign-out and corresponding credentials, with no stale Admin identity", async ({ page }) => {
  await login(page, "admin"); await expect(page).toHaveURL(/\/admin\/dashboard$/);
  const admin = await identity(page);
  await page.getByRole("button", { name: "Sign Out", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await login(page, "faculty"); await expect(page).toHaveURL(/\/panelist\/dashboard$/);
  const faculty = await identity(page);
  expect(faculty.id).not.toBe(admin.id); expect(faculty.accessToken).not.toBe(admin.accessToken); expect(faculty.email).toBe(admin.email);
  await page.goto("/admin/users/administrators");
  await expect(page).toHaveURL(/\/panelist\/dashboard$/);
  await expect(page.getByRole("button", { name: "Create Administrator", exact: true })).toHaveCount(0);
});
test("four-role login selection and layout remain unchanged", async ({ page }) => {
  await page.goto("/login");
  await expect(page.locator("select option")).toHaveText(["Applicant", "Student", "Faculty", "Administrator"]);
  await expect(page.getByRole("heading", { name: "Sign In to Your Portal" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign In", exact: true })).toBeVisible();
});
