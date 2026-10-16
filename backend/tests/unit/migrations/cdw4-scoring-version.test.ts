import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * CDW-4 FIX — additive scoring-version marker.
 *
 * The institutional 1.00–2.50 matrix reuses the existing Decimal criterion
 * columns, so a durable per-row version marker is required to distinguish
 * legacy 10/15-point meaning from institutional meaning. Existing rows default
 * to LEGACY_POINTS_V1; the migration is additive with no data rewrite.
 */
const MIGRATION_DIR =
  "prisma/migrations/20261018090000_oral_evaluation_scoring_version";
const migrationPath = resolve(process.cwd(), MIGRATION_DIR, "migration.sql");
const schemaPath = resolve(process.cwd(), "prisma/schema.prisma");

describe("CDW-4 scoring version migration", () => {
  it("ships a committed migration file", () => {
    expect(existsSync(migrationPath)).toBe(true);
  });

  it("adds a non-null scoring_version column defaulting to LEGACY_POINTS_V1", () => {
    const sql = readFileSync(migrationPath, "utf8");
    expect(sql).toMatch(/ADD COLUMN `scoring_version`/);
    expect(sql).toMatch(/LEGACY_POINTS_V1/);
    expect(sql).toMatch(/INSTITUTIONAL_MATRIX_V2/);
    expect(sql).toMatch(/NOT NULL DEFAULT 'LEGACY_POINTS_V1'/);
  });

  it("is additive with no destruction and no speculative backfill", () => {
    const sql = readFileSync(migrationPath, "utf8");
    expect(sql).not.toMatch(/\bDROP\s+(TABLE|COLUMN|INDEX)\b/i);
    expect(sql).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(sql).not.toMatch(/\bTRUNCATE\b/i);
    expect(sql).not.toMatch(/\bUPDATE\s+`?oral_exam_scores/i);
    expect(sql).not.toMatch(/\bINSERT\s+INTO\b/i);
  });

  it("declares the version enum and field on OralExamScore in the schema", () => {
    const schema = readFileSync(schemaPath, "utf8");
    expect(schema).toMatch(/enum OralEvaluationScoringVersion/);
    expect(schema).toMatch(/LEGACY_POINTS_V1/);
    expect(schema).toMatch(/INSTITUTIONAL_MATRIX_V2/);
    expect(schema).toMatch(
      /scoringVersion\s+OralEvaluationScoringVersion\s+@default\(LEGACY_POINTS_V1\)\s+@map\("scoring_version"\)/,
    );
  });
});
