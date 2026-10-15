import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * CDW-1: the collaborative data model must ship a COMMITTED additive migration
 * (no illustrative-only SQL), must not destructively drop/rewrite existing data,
 * and the new models must exist in the Prisma schema.
 */
const MIGRATION_DIR =
  "prisma/migrations/20261016090000_cdw1_collaborative_defense_foundation";
const migrationPath = resolve(process.cwd(), MIGRATION_DIR, "migration.sql");
const schemaPath = resolve(process.cwd(), "prisma/schema.prisma");

describe("CDW-1 collaborative defense foundation migration", () => {
  it("ships a committed migration file", () => {
    expect(existsSync(migrationPath)).toBe(true);
  });

  it("is additive: creates annotation tables and adds report/signature fields", () => {
    const sql = readFileSync(migrationPath, "utf8");
    expect(sql).toMatch(/CREATE TABLE `defense_annotations`/);
    expect(sql).toMatch(/CREATE TABLE `defense_annotation_comments`/);
    expect(sql).toMatch(/ADD COLUMN `body_document`/);
    expect(sql).toMatch(/ADD COLUMN `frozen_content`/);
    expect(sql).toMatch(/ADD COLUMN `frozen_content_hash`/);
    expect(sql).toMatch(/ADD COLUMN `signed_content_hash`/);
  });

  it("does not destructively drop or rewrite existing data", () => {
    const sql = readFileSync(migrationPath, "utf8");
    expect(sql).not.toMatch(/\bDROP\s+(TABLE|COLUMN|INDEX)\b/i);
    expect(sql).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(sql).not.toMatch(/\bTRUNCATE\b/i);
  });

  it("persists the new models in the Prisma schema", () => {
    const schema = readFileSync(schemaPath, "utf8");
    expect(schema).toMatch(/model DefenseAnnotation \{/);
    expect(schema).toMatch(/model DefenseAnnotationComment \{/);
  });
});
