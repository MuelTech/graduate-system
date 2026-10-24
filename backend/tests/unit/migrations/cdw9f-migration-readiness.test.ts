import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * CDW-9F — final migration-chain / production-readiness audit.
 *
 * This is a durable source-contract guard, not an execution replay. The
 * executable `prisma migrate deploy` replay against disposable databases is
 * recorded in `docs/superpowers/cdw-9/cdw-9f-report.md`.
 */
const MIGRATIONS_DIR = resolve(process.cwd(), "prisma/migrations");
const SCHEMA_PATH = resolve(process.cwd(), "prisma/schema.prisma");

const REQUIRED_MIGRATIONS = [
  "20261015120000_add_redefense_required_outcome",
  "20261016090000_cdw1_collaborative_defense_foundation",
  "20261017090000_defense_schedule_manuscript_binding",
  "20261018090000_oral_evaluation_scoring_version",
] as const;

const ADDITIVE_CDW_MIGRATIONS = REQUIRED_MIGRATIONS;

function migrationNames(): string[] {
  return readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function readMigration(name: string): string {
  return readFileSync(resolve(MIGRATIONS_DIR, name, "migration.sql"), "utf8");
}

describe("CDW-9F migration chain integrity", () => {
  it("contains one committed migration per timestamp with a stable sortable name", () => {
    const names = migrationNames();
    expect(names.length).toBeGreaterThanOrEqual(37);

    const timestamps = names.map((name) => name.split("_")[0]);
    for (const name of names) {
      expect(name).toMatch(/^\d{14}_[a-z0-9_]+$/);
    }
    expect(new Set(timestamps).size).toBe(timestamps.length);
    expect(names).toEqual([...names].sort());
  });

  it("preserves the required pre-CDW and CDW migrations", () => {
    const names = migrationNames();
    for (const required of REQUIRED_MIGRATIONS) {
      expect(names).toContain(required);
      expect(existsSync(resolve(MIGRATIONS_DIR, required, "migration.sql"))).toBe(
        true,
      );
    }
    // Later product migrations are allowed after the CDW chain. This guard
    // verifies the required historical migrations remain present rather than
    // assuming a CDW migration must stay the repository's latest migration.
  });

  it("keeps the CDW additions additive: no drops, deletes, truncation, or backfill writes", () => {
    for (const name of ADDITIVE_CDW_MIGRATIONS) {
      const sql = readMigration(name);
      expect(sql).not.toMatch(/\bDROP\s+(TABLE|COLUMN|INDEX)\b/i);
      expect(sql).not.toMatch(/\bDELETE\s+FROM\b/i);
      expect(sql).not.toMatch(/\bTRUNCATE\b/i);
      expect(sql).not.toMatch(/\bUPDATE\s+`/i);
      expect(sql).not.toMatch(/\bINSERT\s+INTO\b/i);
    }
  });

  it("retains every historical defense outcome while adding REDEFENSE_REQUIRED", () => {
    const sql = readMigration("20261015120000_add_redefense_required_outcome");
    for (const outcome of [
      "PASSED",
      "REVISION_REQUIRED",
      "FAILED",
      "REDEFENSE_REQUIRED",
    ]) {
      expect(sql).toContain(`'${outcome}'`);
    }
  });

  it("marks new scoring rows as V2 while defaulting existing rows to V1", () => {
    const sql = readMigration("20261018090000_oral_evaluation_scoring_version");
    expect(sql).toMatch(/NOT NULL DEFAULT 'LEGACY_POINTS_V1'/);
    expect(sql).toMatch(/INSTITUTIONAL_MATRIX_V2/);
    expect(sql).not.toMatch(/\bUPDATE\b/i);

    const schema = readFileSync(SCHEMA_PATH, "utf8");
    expect(schema).toMatch(
      /scoringVersion\s+OralEvaluationScoringVersion\s+@default\(LEGACY_POINTS_V1\)\s+@map\("scoring_version"\)/,
    );
    expect(schema).toMatch(/enum OralEvaluationScoringVersion \{/);
    expect(schema).toMatch(/LEGACY_POINTS_V1/);
    expect(schema).toMatch(/INSTITUTIONAL_MATRIX_V2/);
  });

  it("keeps the collaborative persistence fields represented in the schema", () => {
    const schema = readFileSync(SCHEMA_PATH, "utf8");
    expect(schema).toMatch(/manuscriptDocumentId\s+String\?\s+@map\("manuscript_document_id"\)/);
    expect(schema).toMatch(/frozenContent\s+Json\?\s+@map\("frozen_content"\)/);
    expect(schema).toMatch(/frozenContentHash\s+String\?\s+@map\("frozen_content_hash"\)/);
    expect(schema).toMatch(/signedContentHash\s+String\?\s+@map\("signed_content_hash"\)/);
    expect(schema).toMatch(/model DefenseAnnotation \{/);
    expect(schema).toMatch(/model DefenseAnnotationComment \{/);
    expect(schema).toMatch(/model AuditLog \{/);
  });

  it("does not rely on prisma db push in package scripts", () => {
    const pkg = JSON.parse(
      readFileSync(resolve(process.cwd(), "package.json"), "utf8"),
    ) as { scripts?: Record<string, string> };
    const scripts = Object.values(pkg.scripts ?? {}).join("\n");
    expect(scripts).not.toMatch(/prisma\s+db\s+push/i);
    expect(scripts).toMatch(/prisma\s+migrate\s+deploy|prisma\s+migrate\s+dev/i);
  });
});
