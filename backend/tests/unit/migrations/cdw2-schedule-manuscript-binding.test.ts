import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * CDW-2 correction: DefenseSchedule must persist the EXACT attempt manuscript as
 * an additive nullable FK. The migration must be additive (no drops, no
 * destructive rewrite, no speculative historical backfill).
 */
const MIGRATION_DIR = "prisma/migrations/20261017090000_defense_schedule_manuscript_binding";
const migrationPath = resolve(process.cwd(), MIGRATION_DIR, "migration.sql");
const schemaPath = resolve(process.cwd(), "prisma/schema.prisma");

describe("CDW-2 defense schedule manuscript binding migration", () => {
  it("ships a committed migration file", () => {
    expect(existsSync(migrationPath)).toBe(true);
  });

  it("adds a nullable FK column, index, and ThesisDocument constraint", () => {
    const sql = readFileSync(migrationPath, "utf8");
    expect(sql).toMatch(/ADD COLUMN `manuscript_document_id` VARCHAR\(191\) NULL/);
    expect(sql).toMatch(/CREATE INDEX `defense_schedules_manuscript_document_id_fkey`/);
    expect(sql).toMatch(
      /FOREIGN KEY \(`manuscript_document_id`\) REFERENCES `thesis_documents`\(`document_id`\)/,
    );
    expect(sql).toMatch(/ON DELETE RESTRICT/);
  });

  it("is additive with no destruction and no speculative backfill", () => {
    const sql = readFileSync(migrationPath, "utf8");
    expect(sql).not.toMatch(/\bDROP\s+(TABLE|COLUMN|INDEX)\b/i);
    expect(sql).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(sql).not.toMatch(/\bTRUNCATE\b/i);
    // No historical data rewrite / backfill.
    expect(sql).not.toMatch(/\bUPDATE\s+`?defense_schedules/i);
    expect(sql).not.toMatch(/\bINSERT\s+INTO\b/i);
  });

  it("declares the binding on DefenseSchedule in the Prisma schema", () => {
    const schema = readFileSync(schemaPath, "utf8");
    expect(schema).toMatch(/manuscriptDocumentId\s+String\?\s+@map\("manuscript_document_id"\)/);
    expect(schema).toMatch(/manuscriptDocument\s+ThesisDocument\?/);
  });
});
