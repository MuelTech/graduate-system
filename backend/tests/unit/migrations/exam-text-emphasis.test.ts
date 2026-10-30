import fs from "node:fs";
import { describe, expect, it } from "vitest";
describe("additive exam text-emphasis migration", () => {
  it("adds exactly one nullable structured metadata column without data writes", () => {
    const sql = fs
      .readFileSync(
        "prisma/migrations/20261031000000_exam_structured_stimulus_emphasis/migration.sql",
        "utf8",
      )
      .replace(/--[^\n]*/g, "")
      .trim();
    expect(sql).toBe(
      "ALTER TABLE `exam_questions` ADD COLUMN `structured_stimulus_emphasis` JSON NULL;",
    );
    expect(sql).not.toMatch(
      /\b(?:DROP|DELETE|UPDATE|INSERT|TRUNCATE|RENAME)\b/i,
    );
  });
  it("adds only two nullable JSON columns without rewriting canonical content or identities", () => {
    const sql = fs
      .readFileSync(
        "prisma/migrations/20261030000000_exam_text_emphasis/migration.sql",
        "utf8",
      )
      .replace(/--[^\n]*/g, "");
    expect(sql.match(/ALTER TABLE/g)).toHaveLength(2);
    expect(sql).toContain("`question_text_emphasis` JSON NULL");
    expect(sql).toContain("`option_text_emphasis` JSON NULL");
    expect(sql).not.toMatch(
      /\b(?:DROP|DELETE|UPDATE|INSERT|TRUNCATE|RENAME)\b/i,
    );
  });
});
