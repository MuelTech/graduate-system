import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";

describe("EXAM-CONTENT-1 non-destructive migration contract", () => {
  const sql = readFileSync("prisma/migrations/20261029000000_exam_mixed_content/migration.sql", "utf8");
  const schema = readFileSync("prisma/schema.prisma", "utf8");

  it("defaults existing questions to NONE and leaves new data nullable", () => {
    expect(sql).toMatch(/`stimulus_type` ENUM\('NONE', 'IMAGE', 'STRUCTURED'\) NOT NULL DEFAULT 'NONE'/);
    expect(sql).toMatch(/`structured_stimulus` JSON NULL/);
    expect(sql).toMatch(/`stimulus_media_id` VARCHAR\(36\) NULL/);
    expect(sql).toMatch(/`label` VARCHAR\(8\) NULL/);
    expect(sql).toMatch(/`media_id` VARCHAR\(36\) NULL/);
    expect(sql).toMatch(/MODIFY `option_text` TEXT NULL/);
  });

  it("does not delete/rewrite data, identities, order, correctness or answer references", () => {
    expect(sql).not.toMatch(/\b(DROP|DELETE|UPDATE|TRUNCATE|RENAME)\b/i);
    expect(sql).not.toMatch(/`(question_id|option_id|selected_option_id|is_correct|order)`/);
    expect(sql).not.toContain("applicant_answers");
  });

  it("keeps response type separate and selectedOptionId unchanged", () => {
    expect(schema.match(/enum QuestionType \{([^}]+)\}/)?.[1]).toMatch(/^\s*MULTIPLE_CHOICE\s+ESSAY\s+@@map\("question_type"\)\s*$/);
    expect(schema).toMatch(/selectedOptionId\s+String\?\s+@map\("selected_option_id"\)/);
    expect(schema).not.toMatch(/correctAnswer\s+String/);
  });
});
