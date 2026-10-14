import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

/**
 * RAP-1 static contract guards for the retired Admin RAP Reports surface.
 * No frontend unit-test framework exists; this reads source text, matching the
 * established COR-7 / credential-notification frontend contract style.
 */
const FE = "../frontend/src";
const ADMIN_APP = `${FE}/app/(portal)/admin`;
const RAP_PAGE = `${ADMIN_APP}/thesis/rap-reports/page.tsx`;
const ADMIN_LAYOUT = `${ADMIN_APP}/layout.tsx`;
const DASHBOARD = `${ADMIN_APP}/dashboard/page.tsx`;
const PANELIST_SIGNATURES = `${FE}/app/(portal)/panelist/signatures/page.tsx`;
const ROUTES = "src/routes/thesis.routes.ts";

function read(path: string): string {
  return readFileSync(path, "utf8");
}

function walkFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkFiles(full));
    else out.push(full);
  }
  return out;
}

describe("RAP-1 admin RAP Reports retirement contracts", () => {
  it("old Admin RAP Reports route is a redirect-only server component", () => {
    const page = read(RAP_PAGE);
    expect(page).toContain('redirect("/admin/thesis/defense-records")');
    // No retired UI: no data fetching, no summary cards, no reminder control.
    expect(page).not.toContain("useQuery");
    expect(page).not.toContain("apiClientRequest");
    expect(page).not.toContain("use client");
    expect(page).not.toContain("Send Reminder");
    expect(page).not.toContain("defense/rap-reports");
  });

  it("Admin sidebar no longer exposes RAP Reports", () => {
    const layout = read(ADMIN_LAYOUT);
    expect(layout).not.toContain("/admin/thesis/rap-reports");
    expect(layout).not.toContain("RAP Reports");
  });

  it("no Admin surface fetches RAP report data, calls the reminder endpoint, or shows reminder controls", () => {
    for (const file of walkFiles(ADMIN_APP)) {
      const source = read(file);
      expect(source).not.toContain("/thesis/defense/rap-reports");
      expect(source).not.toContain("Send Reminder");
      expect(source).not.toContain("Resend Reminder");
      expect(source).not.toContain("/admin/thesis/rap-reports");
    }
  });

  it("Admin dashboard no longer links to the retired RAP Reports page", () => {
    const dashboard = read(DASHBOARD);
    expect(dashboard).not.toContain("/admin/thesis/rap-reports");
  });

  it("Panelist E-Signatures workflow remains active (pending + own-slot sign)", () => {
    const page = read(PANELIST_SIGNATURES);
    expect(page).toContain("/thesis/defense/rap-reports/pending");
    expect(page).toContain("/thesis/defense/rap-reports/${selectedDoc}/sign");
  });

  it("preserved backend RAP endpoints remain (student access, panelist sign, reminder)", () => {
    const routes = read(ROUTES);
    expect(routes).toContain('"/defense/rap-reports/pending"');
    expect(routes).toContain('"/defense/rap-reports/:sigId/sign"');
    expect(routes).toContain('"/student/defense/:scheduleId/rap"');
    expect(routes).toContain('"/defense/rap-reports/:rapId/remind"');
  });
});
