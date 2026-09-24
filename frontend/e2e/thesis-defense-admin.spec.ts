/**
 * Admin Thesis/Dissertation UI integration (Playwright).
 * Scope: PENDING → APPROVED → READY → schedule → ACTIVE + History/docs.
 * Does NOT cover panelist scoring, formal conclusion UI, or RAP signing.
 */
import { test, expect, type Page, type Dialog } from "@playwright/test";

const ADMIN_EMAIL = "admin@earist.edu.ph";
const ADMIN_PASSWORD = "password123";
// Cards show studentNumber (fallback email). Search matches name/number/email.
const PROPOSAL_REVIEW = { name: "Pat Review", studentNumber: "2026-1011", email: "proposal-review-pending@earist.edu.ph" };
const PROPOSAL_READY = { name: "Pia Proposal", studentNumber: "2026-1005", email: "proposal-ready@earist.edu.ph" };
const FINAL_READY = { name: "Finn Final", studentNumber: "2026-1008", email: "final-ready@earist.edu.ph" };

const failedRequests: string[] = [];
const consoleErrors: string[] = [];

async function loginAsAdmin(page: Page) {
  await page.goto("/login");
  // Labels are not wired with htmlFor; use stable form controls.
  await page.locator("select").first().selectOption("admin");
  await page.locator('input[type="email"]').fill(ADMIN_EMAIL);
  await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Sign In" }).click();
  await page.waitForURL(/\/admin\/dashboard/, { timeout: 30_000 });
}

async function openDefenseApplications(page: Page) {
  await page.goto("/admin/thesis/applications");
  await expect(
    page.getByRole("heading", { name: "Defense Application Review" }),
  ).toBeVisible();
}

function trackNetwork(page: Page) {
  page.on("response", (res) => {
    const url = res.url();
    if (res.status() >= 400 && url.includes("/api/")) {
      failedRequests.push(`${res.status()} ${res.request().method()} ${url}`);
    }
  });
  page.on("pageerror", (err) => {
    consoleErrors.push(String(err));
  });
}

async function searchDefenseApplications(page: Page, query: string) {
  const search = page.getByLabel("Search defense applications");
  await search.fill(query);
  await page.waitForTimeout(600); // debounce
}

async function openTab(page: Page, tab: "Needs Review" | "Ready for Scheduling" | "Scheduled / Active" | "History") {
  await page.getByRole("button", { name: tab, exact: true }).click();
}

async function expectCardVisible(page: Page, text: string) {
  await expect(page.getByText(text).first()).toBeVisible({ timeout: 15_000 });
}

async function addCommitteeMember(
  page: Page,
  search: string,
  role: "CHAIRMAN" | "PANELIST" | "FACILITATOR" | "RAPPORTEUR",
) {
  await page.getByRole("button", { name: "Add Committee Member" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Search panelist").fill(search);
  await page.waitForTimeout(600);
  // Pick the first enabled panelist result inside the add-member dialog.
  const result = dialog
    .locator('button[aria-pressed]')
    .filter({ hasNotText: "Already assigned" })
    .first();
  await result.waitFor({ state: "visible", timeout: 15_000 });
  await result.click();
  await dialog.locator("#committee-role").selectOption(role);
  await dialog.getByRole("button", { name: "Add to Committee" }).click();
  await expect(page.getByRole("dialog")).toBeHidden({ timeout: 10_000 });
}

test.describe("Admin Thesis/Dissertation application workflow", () => {
  test.beforeEach(async ({ page }) => {
    trackNetwork(page);
    page.on("dialog", async (dialog: Dialog) => {
      // accept alerts from approve/schedule success messages
      if (dialog.type() === "alert") {
        await dialog.accept();
      } else {
        await dialog.dismiss();
      }
    });
    await loginAsAdmin(page);
  });

  test.afterEach(async () => {
    // keep arrays for the final test report via annotations
  });

  test("TEST 1: PENDING → APPROVED → READY → schedule → ACTIVE", async ({
    page,
  }) => {
    test.setTimeout(180_000);

    // A1: Needs Review shows dedicated fixture
    await openDefenseApplications(page);
    await searchDefenseApplications(page, PROPOSAL_REVIEW.studentNumber);
    await expectCardVisible(page, PROPOSAL_REVIEW.studentNumber);
    await expect(page.getByRole("button", { name: "Review Application" }).first()).toBeVisible();
    // Must not show Assign Panel & Schedule while PENDING
    await expect(
      page.getByRole("button", { name: "Assign Panel & Schedule" }),
    ).toHaveCount(0);

    // Network: bucket=NEEDS_REVIEW
    await expect
      .poll(async () => {
        return page
          .evaluate(() => performance.getEntriesByType("resource").map((r) => r.name).join("|"))
          .then((names) => names.includes("bucket=NEEDS_REVIEW"));
      })
      .toBe(true);

    // A2: Approve via real UI
    await page.getByRole("button", { name: "Review Application" }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("heading", { name: /Review Application/i }),
    ).toBeVisible();
    // Stage-scoped proposal docs in dialog
    await expect(dialog.getByText(/Proposal Chapters/)).toBeVisible();
    await dialog.getByRole("button", { name: "Approve Application" }).click();
    await expect(page.getByRole("dialog")).toBeHidden({ timeout: 15_000 });

    // Flow E: still current Proposal review — not classified as History
    await openTab(page, "Ready for Scheduling");
    await searchDefenseApplications(page, PROPOSAL_REVIEW.studentNumber);
    await expectCardVisible(page, PROPOSAL_REVIEW.studentNumber);
    await expect(page.getByRole("button", { name: "Assign Panel & Schedule" }).first()).toBeVisible();
    // No current-stage session panel on READY
    await expect(page.getByText("Defense Session")).toHaveCount(0);

    // Flow B: go to scheduling and select READY app
    await page.goto("/admin/thesis/scheduling");
    await expect(
      page.getByRole("heading", { name: /Panel Assignment/ }),
    ).toBeVisible();
    await page.getByLabel("Search approved applications").fill(PROPOSAL_REVIEW.studentNumber);
    await page.waitForTimeout(600);
    await page.getByText(PROPOSAL_REVIEW.studentNumber).first().click();
    await expect(page.getByText("2. Defense Committee")).toBeVisible();

    // B1: Master's Proposal session total 7: Chair + 4 Panelists + Fac + Rap
    await addCommitteeMember(page, "panelist1", "CHAIRMAN");
    await addCommitteeMember(page, "panelist2", "PANELIST");
    await addCommitteeMember(page, "panelist3", "PANELIST");
    await addCommitteeMember(page, "panelist4", "PANELIST");
    await addCommitteeMember(page, "panelist5", "PANELIST");
    await addCommitteeMember(page, "panelist6", "FACILITATOR");
    await addCommitteeMember(page, "panelist7", "RAPPORTEUR");

    // B2: schedule fields
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const y = nextWeek.getFullYear();
    const m = String(nextWeek.getMonth() + 1).padStart(2, "0");
    const d = String(nextWeek.getDate()).padStart(2, "0");
    await page.locator("#defense-date").fill(`${y}-${m}-${d}`);
    await page.locator("#defense-time").fill("10:00");
    await page
      .locator("#meeting-link")
      .fill("https://teams.microsoft.com/l/meetup-join/e2e-proposal");
    await page.getByRole("button", { name: "Schedule Defense & Notify" }).click();
    // success alert is auto-accepted in beforeEach dialog handler
    await expect(page.getByText("1. Approved Applications")).toBeVisible();

    // B3: Applications — gone from READY, visible in ACTIVE
    await openDefenseApplications(page);
    await openTab(page, "Ready for Scheduling");
    await searchDefenseApplications(page, PROPOSAL_REVIEW.studentNumber);
    await expect(
      page.getByRole("button", { name: "Assign Panel & Schedule" }),
    ).toHaveCount(0);

    await openTab(page, "Scheduled / Active");
    await searchDefenseApplications(page, PROPOSAL_REVIEW.studentNumber);
    await expectCardVisible(page, PROPOSAL_REVIEW.studentNumber);
    await expect(page.getByText("Defense Session").first()).toBeVisible();
    await expect(page.getByText("Committee").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "View Defense Details" }).first()).toBeVisible();
    // Assign button must not appear on ACTIVE
    await expect(
      page.getByRole("button", { name: "Assign Panel & Schedule" }),
    ).toHaveCount(0);

    // Details modal
    await page.getByRole("button", { name: "View Defense Details" }).first().click();
    const details = page.getByRole("dialog");
    await expect(details).toBeVisible();
    await expect(details.getByText("Assigned Committee")).toBeVisible();
    await expect(details.getByText("Defense Session").first()).toBeVisible();
    await details.getByRole("button", { name: "Close" }).first().click();
    await expect(page.getByRole("dialog")).toBeHidden();
  });

  test("TEST 2: History + stage-scoped documents (seeded)", async ({ page }) => {
    test.setTimeout(120_000);

    // Flow C: Proposal/Final docs stage-scoped on READY fixtures
    await openDefenseApplications(page);
    await openTab(page, "Ready for Scheduling");
    await searchDefenseApplications(page, PROPOSAL_READY.studentNumber);
    await page.getByRole("button", { name: "View Application" }).first().click();
    const pDialog = page.getByRole("dialog");
    await expect(pDialog).toBeVisible();
    await expect(pDialog.getByText(/Proposal Chapters/).first()).toBeVisible();
    await expect(pDialog.getByText(/Title Defense Proposal Package/)).toHaveCount(0);
    await pDialog.getByRole("button", { name: "Close" }).first().click();

    await searchDefenseApplications(page, FINAL_READY.studentNumber);
    await page.getByRole("button", { name: "View Application" }).first().click();
    const fDialog = page.getByRole("dialog");
    await expect(fDialog).toBeVisible();
    await expect(fDialog.getByText(/Final Manuscript/).first()).toBeVisible();
    await expect(fDialog.getByText(/Proposal Chapters/)).toHaveCount(0);
    await expect(fDialog.getByText(/Title Defense Proposal Package/)).toHaveCount(0);
    await fDialog.getByRole("button", { name: "Close" }).first().click();

    // Flow D: History rows from seeded conclusions
    await openTab(page, "History");
    await searchDefenseApplications(page, PROPOSAL_REVIEW.studentNumber);
    await expect(page.getByText(PROPOSAL_REVIEW.studentNumber).first()).toBeVisible();
    await expect(
      page.getByRole("button", { name: "View Defense Details" }).first(),
    ).toBeVisible();

    // No failed /api requests for this suite portion
    const relevantFailures = failedRequests.filter(
      (f) =>
        f.includes("/api/thesis/") ||
        f.includes("/api/auth/") ||
        f.includes("/api/programs"),
    );
    expect(relevantFailures, relevantFailures.join("\n")).toEqual([]);
  });
});
