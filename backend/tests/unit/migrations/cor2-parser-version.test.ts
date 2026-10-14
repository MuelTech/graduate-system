import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";

/**
 * COR-2: the parser-version column is a forward-only, additive change.
 * Existing/legacy extraction rows must remain valid (nullable column, no
 * backfill), and historical migrations must not be modified.
 */
describe("COR-2 cor_extractions parser_version migration", () => {
  const sql = readFileSync(
    "prisma/migrations/20261005000000_cor2_cor_parser_version/migration.sql",
    "utf8",
  );

  it("adds only a nullable parser_version column", () => {
    expect(sql).toMatch(
      /ALTER TABLE\s+`cor_extractions`\s+ADD COLUMN\s+`parser_version`\s+VARCHAR\(191\)\s+NULL/i,
    );
  });

  it("never updates, deletes, drops, renames or backfills existing rows", () => {
    expect(sql).not.toMatch(/\bUPDATE\b/i);
    expect(sql).not.toMatch(/\bDELETE\b/i);
    expect(sql).not.toMatch(/\bDROP\b/i);
    expect(sql).not.toMatch(/\bRENAME\b/i);
  });

  it("schema keeps the parser version nullable and distinct from extractorVersion", () => {
    const schema = readFileSync("prisma/schema.prisma", "utf8");
    expect(schema).toMatch(/extractorVersion\s+String\?\s+@map\("extractor_version"\)/);
    expect(schema).toMatch(/parserVersion\s+String\?\s+@map\("parser_version"\)/);
  });
});
