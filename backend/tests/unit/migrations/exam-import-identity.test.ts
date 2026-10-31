import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync("prisma/migrations/20261029020000_exam_import_identity/migration.sql", "utf8");
const schema = readFileSync("prisma/schema.prisma", "utf8");
describe("additive verified-package identity", () => {
  it("protects package identity and per-source question numbers with unique keys", () => {
    expect(sql).toContain("CREATE TABLE `exam_content_imports`");
    expect(sql).toContain("PRIMARY KEY (`id`)");
    expect(sql).toContain("CREATE UNIQUE INDEX `exam_questions_source_import_id_source_question_number_key`");
    expect(sql).toContain("FOREIGN KEY (`source_import_id`) REFERENCES `exam_content_imports`(`id`) ON DELETE RESTRICT");
    expect(schema).toContain("@@unique([sourceImportId, sourceQuestionNumber])");
  });

  it("leaves legacy identity nullable without rewriting bank data or scoring", () => {
    expect(sql).toContain("`source_import_id` VARCHAR(64) NULL");
    expect(sql).toContain("`source_question_number` INTEGER NULL");
    const executable = sql.replace(/--[^\n]*/g, "").replace(/\bON (?:DELETE RESTRICT|UPDATE CASCADE)\b/g, "");
    expect(executable).not.toMatch(/\b(DROP|DELETE|INSERT|UPDATE|TRUNCATE|MODIFY|RENAME)\b/i);
    expect(sql).not.toMatch(/applicant_answers|is_correct|selected_option_id/);
  });
});
