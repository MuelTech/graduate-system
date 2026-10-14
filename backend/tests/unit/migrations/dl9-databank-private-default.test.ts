import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";

/**
 * DL-9: the archive privacy guarantee is a forward-only DEFAULT change.
 * Existing rows (including legacy is_public = true) must not be rewritten.
 */
describe("DL-9 databank private-default migration", () => {
  const sql = readFileSync(
    "prisma/migrations/20261002040000_dl9_databank_private_default/migration.sql",
    "utf8",
  );

  it("changes only the is_public column default to false", () => {
    expect(sql).toMatch(/ALTER TABLE\s+`e_library`\s+ALTER COLUMN\s+`is_public`\s+SET DEFAULT false/i);
  });

  it("never updates, deletes, drops, or backfills existing rows", () => {
    expect(sql).not.toMatch(/\bUPDATE\b/i);
    expect(sql).not.toMatch(/\bDELETE\b/i);
    expect(sql).not.toMatch(/\bDROP\b/i);
  });

  it("schema default matches the private archive boundary", () => {
    const schema = readFileSync("prisma/schema.prisma", "utf8");
    expect(schema).toMatch(/isPublic\s+Boolean\s+@default\(false\)/);
    expect(schema).not.toMatch(/isPublic\s+Boolean\s+@default\(true\)/);
  });
});
