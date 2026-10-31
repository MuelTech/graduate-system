import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync("prisma/migrations/20261029010000_exam_private_media/migration.sql", "utf8");
const schema = readFileSync("prisma/schema.prisma", "utf8");

describe("private exam-media additive migration and relation integrity", () => {
  it("creates authoritative media storage and checksum metadata with UUID identity", () => {
    expect(sql).toContain("CREATE TABLE `exam_media`");
    for (const column of ["media_id", "storage_key", "storage_provider", "verified_mime_type", "size_bytes", "checksum", "checksum_algorithm", "created_at"]) expect(sql).toContain(`\`${column}\``);
    expect(sql).toContain("`media_id` VARCHAR(36) NOT NULL");
    expect(sql).toContain("UNIQUE INDEX `exam_media_storage_key_key`");
  });

  it("restricts deletion of both referenced stimulus and option media", () => {
    expect(sql).toMatch(/FOREIGN KEY \(`stimulus_media_id`\) REFERENCES `exam_media`\(`media_id`\) ON DELETE RESTRICT/);
    expect(sql).toMatch(/FOREIGN KEY \(`media_id`\) REFERENCES `exam_media`\(`media_id`\) ON DELETE RESTRICT/);
    expect(schema).toMatch(/stimulusMediaId\s+String\?/);
    expect(schema).toMatch(/mediaId\s+String\?/);
    expect(sql).toContain("CREATE INDEX `exam_options_media_id_idx`");
    expect(sql).toContain("CREATE INDEX `exam_questions_stimulus_media_id_idx`");
  });

  it("never rewrites existing content, fabricates media, or changes answer/scoring identity", () => {
    const statements = sql.replace(/--[^\n]*/g, "").replace(/\bON (?:DELETE RESTRICT|UPDATE CASCADE)\b/g, "");
    expect(statements).not.toMatch(/\b(DROP|DELETE|INSERT|UPDATE|TRUNCATE|MODIFY|RENAME)\b/i);
    expect(sql).not.toContain("applicant_answers");
    expect(sql).not.toContain("is_correct");
    expect(sql).not.toContain("option_id");
  });
});
