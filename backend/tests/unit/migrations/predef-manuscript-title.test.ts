import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("PREDEF-1B0 exact manuscript-title migration", () => {
  const sql = readFileSync(resolve(process.cwd(), "prisma/migrations/20261024120000_manuscript_version_title/migration.sql"), "utf8");
  const schema = readFileSync(resolve(process.cwd(), "prisma/schema.prisma"), "utf8");

  it("adds only a nullable TEXT column without defaults or historical backfill", () => {
    const statements = sql.replace(/--[^\n]*/g, "").trim().split(";").filter(part => part.trim());
    expect(statements).toHaveLength(1);
    expect(statements[0]).toMatch(/^ALTER TABLE `thesis_documents` ADD COLUMN `manuscript_title` TEXT NULL$/);
    expect(sql).not.toMatch(/\b(?:DROP|DELETE|TRUNCATE|UPDATE|INSERT|DEFAULT|NOT NULL)\b/i);
  });

  it("keeps exact document metadata nullable for existing and non-manuscript rows", () => {
    const model = schema.match(/model ThesisDocument \{([\s\S]*?)\n\}/)![1];
    expect(model).toMatch(/manuscriptTitle\s+String\?\s+@map\("manuscript_title"\)\s+@db.Text/);
    expect(model).toMatch(/supersedesDocumentId\s+String\?/);
  });
});
