import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATIONS_DIR = resolve(process.cwd(), "prisma/migrations");
const MIGRATION_NAME = "20261024090000_defense_application_submitted_at";
const MIGRATION_DIR = resolve(MIGRATIONS_DIR, MIGRATION_NAME);
const migrationPath = resolve(MIGRATION_DIR, "migration.sql");
const schemaPath = resolve(process.cwd(), "prisma/schema.prisma");

describe("FORM-INT-4 FIX-4 stage application submission timestamps migration", () => {
  it("is a new migration after the accepted migration history", () => {
    const names = readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    expect(names).toContain(MIGRATION_NAME);
    expect(names.at(-1)).toBe(MIGRATION_NAME);
    expect(existsSync(migrationPath)).toBe(true);
  });

  it("adds exactly three nullable DATETIME(3) columns with no defaults", () => {
    const sql = readFileSync(migrationPath, "utf8");
    for (const column of [
      "title_application_submitted_at",
      "proposal_application_submitted_at",
      "final_application_submitted_at",
    ]) {
      expect(sql).toMatch(
        new RegExp(`ADD COLUMN \`${column}\` DATETIME\\(3\\) NULL`),
      );
    }
    expect(sql).not.toMatch(/DEFAULT\s+CURRENT_TIMESTAMP/i);
  });

  it("is additive with no destruction or speculative backfill", () => {
    const sql = readFileSync(migrationPath, "utf8");
    expect(sql).not.toMatch(/\bDROP\s+(TABLE|COLUMN|INDEX)\b/i);
    expect(sql).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(sql).not.toMatch(/\bUPDATE\s+`?thesis_records`?\s+SET\b/i);
    expect(sql).not.toMatch(/\bALTER\s+COLUMN\b/i);
  });

  it("declares the three stage fields on ThesisRecord in the Prisma schema", () => {
    const schema = readFileSync(schemaPath, "utf8");
    expect(schema).toMatch(
      /titleApplicationSubmittedAt\s+DateTime\?\s+@map\("title_application_submitted_at"\)/,
    );
    expect(schema).toMatch(
      /proposalApplicationSubmittedAt\s+DateTime\?\s+@map\("proposal_application_submitted_at"\)/,
    );
    expect(schema).toMatch(
      /finalApplicationSubmittedAt\s+DateTime\?\s+@map\("final_application_submitted_at"\)/,
    );
  });
});
