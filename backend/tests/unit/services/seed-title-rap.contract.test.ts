import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";
import { getRapSignatoryRoles } from "../../../src/services/rap-signature.policy";

/**
 * RAP-1 FIX-1 static contract guards for the seeded concluded TITLE_DEFENSE
 * demo fixture. No runtime DB is used; this reads seed source text, matching the
 * established credential-notification seed contract style.
 *
 * Canonical Title policy: Chairman + Panelists + Rapporteur (no Adviser,
 * no Facilitator); Title has no numerical Oral Examination scoring workflow.
 */
const SEED = readFileSync("prisma/seed.ts", "utf8");

/** The concluded TITLE_DEFENSE demo fixture block only. */
function concludedTitleRegion(): string {
  const start = SEED.indexOf("// 2) CONCLUDED lobby");
  const end = SEED.indexOf("// ── Defense eligibility fixtures", start);
  return start === -1 ? "" : end === -1 ? SEED.slice(start) : SEED.slice(start, end);
}

describe("RAP-1 FIX-1 seeded concluded Title RAP fixture", () => {
  it("concluded Title fixture exists and is scoped", () => {
    const region = concludedTitleRegion();
    expect(region.length).toBeGreaterThan(0);
    expect(region).toContain("TITLE_DEFENSE");
  });

  it("has no ADVISER committee assignment and no adviser score", () => {
    const region = concludedTitleRegion();
    expect(region).not.toContain('"ADVISER"');
    expect(region).not.toMatch(/concludedAdviser/);
    // No numerical adviser scoring data (Title has no numerical workflow).
    expect(region).not.toMatch(/ensureScore\(\s*concludedAdviser/);
  });

  it("has a RAPPORTEUR committee assignment", () => {
    const region = concludedTitleRegion();
    expect(region).toContain('"RAPPORTEUR"');
    expect(region).toMatch(/concludedRapporteur/);
  });

  it("RAP signature slots include Chairman/Panelist/Rapporteur and exclude Adviser/Facilitator", () => {
    const region = concludedTitleRegion();
    expect(region).toContain('roleAtDefense: "CHAIRMAN"');
    expect(region).toContain('roleAtDefense: "PANELIST"');
    expect(region).toContain('roleAtDefense: "RAPPORTEUR"');
    expect(region).not.toContain('roleAtDefense: "ADVISER"');
    expect(region).not.toContain('roleAtDefense: "FACILITATOR"');
    expect(region).toContain("required: true");
  });

  it("canonical RAP policy is unchanged (Title = Chairman + Panelist + Rapporteur)", () => {
    expect(getRapSignatoryRoles("TITLE_DEFENSE")).toEqual([
      "CHAIRMAN",
      "PANELIST",
      "RAPPORTEUR",
    ]);
  });

  it("Defense Record detail RAP table remains data-driven (unchanged source)", () => {
    const page = readFileSync(
      "../frontend/src/app/(portal)/admin/thesis/defense-records/[scheduleId]/page.tsx",
      "utf8",
    );
    expect(page).toContain("data.rapReport.signatories");
    expect(page).toContain("ROLE_LABELS[s.roleAtDefense]");
  });
});
