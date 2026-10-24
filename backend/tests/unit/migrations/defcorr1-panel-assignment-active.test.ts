import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * DEF-CORR-1 Checkpoint A: PanelAssignment needs a backward-compatible
 * active/inactive lifecycle. Existing rows must become active without
 * destructive rewrites, and historical assignment ids must remain resolvable.
 */
const MIGRATION_DIR =
  "prisma/migrations/20261024230000_panel_assignment_active_lifecycle";
const migrationPath = resolve(process.cwd(), MIGRATION_DIR, "migration.sql");
const schemaPath = resolve(process.cwd(), "prisma/schema.prisma");

describe("DEF-CORR-1 PanelAssignment active lifecycle migration", () => {
  it("ships a committed additive migration", () => {
    expect(existsSync(migrationPath)).toBe(true);
  });

  it("adds a non-null active flag defaulting to true", () => {
    const sql = readFileSync(migrationPath, "utf8");
    expect(sql).toMatch(
      /ADD COLUMN `is_active` (?:BOOLEAN|TINYINT\(1\)) NOT NULL DEFAULT true/i,
    );
  });

  it("is additive with no destructive rewrite or speculative backfill", () => {
    const sql = readFileSync(migrationPath, "utf8");
    expect(sql).not.toMatch(/\bDROP\s+(TABLE|COLUMN|INDEX)\b/i);
    expect(sql).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(sql).not.toMatch(/\bTRUNCATE\b/i);
    expect(sql).not.toMatch(/\bUPDATE\s+`?panel_assignments/i);
    expect(sql).not.toMatch(/\bINSERT\s+INTO\b/i);
  });

  it("declares the active flag on PanelAssignment", () => {
    const schema = readFileSync(schemaPath, "utf8");
    expect(schema).toMatch(
      /isActive\s+Boolean\s+@default\(true\)\s+@map\("is_active"\)/,
    );
  });
});
