import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";

/**
 * COR-7: the credential_dispatch correction is a data-only, forward-only
 * migration scoped to the obsolete template. No schema SQL, no broad updates.
 */
describe("COR-7 credential_dispatch data migration", () => {
  const sql = readFileSync(
    "prisma/migrations/20261005010000_cor7_credential_notification/migration.sql",
    "utf8",
  );
  const setClause = sql.split(/\bWHERE\b/i)[0];

  it("targets only the credential_dispatch template", () => {
    expect(sql).toMatch(/`template_key`\s*=\s*'credential_dispatch'/);
    // The correction is scoped to the obsolete template marker.
    expect(sql).toMatch(/\{\{default_password\}\}|last name in all caps/i);
  });

  it("writes a truthful body with no password claim", () => {
    expect(setClause).toContain("{{student_name}}");
    expect(setClause).toContain("{{student_number}}");
    expect(setClause).toContain("{{portal_link}}");
    expect(setClause).toMatch(/existing account password/i);
    expect(setClause).not.toMatch(/\{\{default_password\}\}/i);
    expect(setClause).not.toMatch(/default password/i);
    expect(setClause).not.toMatch(/initial password/i);
    expect(setClause).not.toMatch(/last name in all caps/i);
    expect(setClause).not.toMatch(/date of birth/i);
  });

  it("contains no destructive or schema-changing SQL", () => {
    expect(sql).not.toMatch(/\bDROP\b/i);
    expect(sql).not.toMatch(/\bDELETE\b/i);
    expect(sql).not.toMatch(/\bTRUNCATE\b/i);
    expect(sql).not.toMatch(/\bALTER\b/i);
    expect(sql).not.toMatch(/\bCREATE\b/i);
  });
});
