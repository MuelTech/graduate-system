// Explicit opt-in. Creates a unique LOCAL disposable database; never migrates/resets the configured bank.
import { randomUUID } from "node:crypto";
import { readFileSync, mkdtempSync, writeFileSync, unlinkSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import mysql, { type Connection } from "mysql2/promise";
import { parse } from "dotenv";
import { PrismaClient, Prisma } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
const gateway = vi.hoisted(() => ({ $transaction: vi.fn(), examContentRevision: { findUnique: vi.fn() }, examMedia: { deleteMany: vi.fn() } }));
vi.mock("../../src/config/database", () => ({ default: gateway }));
import { ExamQuestionSetRepository } from "../../src/repositories/exam-question-set.repository";
import { ExamEngineRepository } from "../../src/repositories/exam-engine.repository";
import { ExamMediaRepository } from "../../src/repositories/exam-media.repository";
import { ExamContentImportRepository } from "../../src/repositories/exam-content-import.repository";
import { validateExamQuestion } from "../../src/services/exam-content.rules";

describe.skipIf(process.env.EXAM_B2_DB_TEST !== "1")("B2 local migration rehearsal and real InnoDB integrity", () => {
  const database = `exam_b2_test_${randomUUID().replaceAll("-", "")}`;
  const ids = Object.fromEntries(["user", "student", "program", "slot", "app", "q", "answerQ", "media", "answer"].map(k => [k, randomUUID()]));
  const repo = new ExamQuestionSetRepository();
  let db: PrismaClient; let admin: Connection; let source: Connection; let created = false;
  let original: unknown; let beforeMigration: unknown; let optionIds: string[];
  const tables = ["exam_questions", "exam_options", "exam_media", "exam_content_imports", "applicant_answers"];
  async function snapshot(connection: Connection) {
    return Promise.all(tables.map(async table => { const [rows] = await connection.query(`SELECT * FROM \`${table}\``); return JSON.parse(JSON.stringify(rows)).sort((a: any, b: any) => JSON.stringify(a).localeCompare(JSON.stringify(b))); }));
  }
  beforeAll(async () => {
    const env = parse(readFileSync(".env")); const url = new URL(process.env.DATABASE_URL || env.DATABASE_URL);
    if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) throw new Error("B2 rehearsal only permits a local database server.");
    source = await mysql.createConnection(url.toString()); original = await snapshot(source);
    const adminUrl = new URL(url); adminUrl.pathname = "/";
    admin = await mysql.createConnection({ uri: adminUrl.toString(), multipleStatements: true });
    expect(/^exam_b2_test_[0-9a-f]{32}$/.test(database)).toBe(true);
    await admin.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`); created = true;
    await admin.query(`USE \`${database}\``);
    const folder = mkdtempSync(path.join(tmpdir(), "exam-b2-"));
    const schema = path.join(folder, "baseline.prisma"); const sql = path.join(folder, "baseline.sql");
    try {
      writeFileSync(schema, execFileSync("git", ["show", "7083a28fffe75a8177a322eadf30e6f2b6429db7:backend/prisma/schema.prisma"]));
      execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "diff", "--from-empty", "--to-schema", schema, "--script", "--output", sql], { stdio: "pipe" });
      await admin.query(readFileSync(sql, "utf8"));
    } finally { for (const file of [schema, sql]) { try { unlinkSync(file); } catch {} } rmdirSync(folder); }
    url.pathname = `/${database}`;
    db = new PrismaClient({ adapter: new PrismaMariaDb(url.toString().replace("mysql://", "mariadb://")) }); await db.$connect();
    await db.user.create({ data: { id: ids.user, email: `${database}@example.invalid`, passwordHash: "test-unusable", role: "ADMIN", firstName: "B2", lastName: "Fixture" } });
    await db.program.create({ data: { id: ids.program, programName: "B2 fixture", programType: "MASTERS" } });
    await db.student.create({ data: { id: ids.student, userId: ids.user, programId: ids.program } });
    await db.examSlot.create({ data: { id: ids.slot, programId: ids.program, examDate: new Date("2026-11-02T00:00:00Z"), examTime: new Date("1970-01-01T09:00:00Z"), maxSlots: 1 } });
    await db.entranceExamApplication.create({ data: { id: ids.app, studentId: ids.student, programId: ids.program, slotId: ids.slot } });
    await db.examContentImport.create({ data: { id: "b2-synthetic-existing", fingerprint: "f".repeat(64), questionCount: 1 } });
    await db.examMedia.create({ data: { id: ids.media, storageKey: `${database}/synthetic`, storageProvider: "local", verifiedMimeType: "image/png", sizeBytes: 1, checksum: "a".repeat(64) } });
    const q = await db.examQuestion.create({ data: { id: ids.q, questionText: "Synthetic NOT instruction", questionTextEmphasis: [{ start: 10, end: 13, style: "ITALIC" }], type: "MULTIPLE_CHOICE", order: 2,
      sourceImportId: "b2-synthetic-existing", sourceQuestionNumber: 1, stimulusType: "IMAGE", stimulusMediaId: ids.media,
      options: { create: [{ label: "F", order: 3, optionText: "Correct", isCorrect: true }, { label: "K", order: 8, optionText: null, mediaId: ids.media, isCorrect: false }] } }, include: { options: { orderBy: { order: "asc" } } } });
    optionIds = q.options.map(o => o.id);
    await db.examQuestion.create({ data: { id: ids.answerQ, questionText: "Existing synthetic answer prompt", type: "ESSAY" } });
    await db.applicantAnswer.create({ data: { id: ids.answer, applicationId: ids.app, questionId: ids.answerQ, essayAnswer: "Preserved existing history" } });
    beforeMigration = await snapshot(admin);
    await admin.query(readFileSync("prisma/migrations/20261102010000_exam_question_sets/migration.sql", "utf8"));
    gateway.$transaction.mockImplementation((fn, options) => db.$transaction(fn, options));
    gateway.examContentRevision.findUnique.mockImplementation(args => db.examContentRevision.findUnique(args));
    gateway.examMedia.deleteMany.mockImplementation(args => db.examMedia.deleteMany(args));
  }, 60_000);
  afterAll(async () => {
    try {
      if (source && original) expect(await snapshot(source)).toEqual(original);
      if (db) await db.$disconnect();
      if (admin && created) {
        // Only this exact generated disposable DB; never the configured source database.
        if (!/^exam_b2_test_[0-9a-f]{32}$/.test(database)) throw new Error("Unsafe disposable database identity");
        await admin.query(`DROP DATABASE \`${database}\``);
      }
    } finally { if (admin) await admin.end(); if (source) await source.end(); }
  });

  it("migration preserves every existing question/option/media/import/answer value and starts with empty new authority", async () => {
    expect(await snapshot(admin)).toEqual(beforeMigration);
    expect(await db.examQuestionSelection.count()).toBe(0); expect(await db.examContentRevision.count()).toBe(0);
    expect((await repo.getCurrent()).questionIds).toEqual([]);
    const [engines] = await admin.query("SELECT ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('exam_content_revisions', 'exam_revision_questions', 'exam_revision_options', 'exam_revision_media')");
    expect((engines as any[]).map(row => row.ENGINE)).toEqual(Array(4).fill("InnoDB"));
    console.log("B2 migration preservation: 2 questions, 2 options, 1 media, 1 import, 1 ApplicantAnswer; exact rows/IDs unchanged; empty selection/revisions.");
  });
  it("rolls back a real revision/member/option/media write if publication fails before commit", async () => {
    await repo.replaceSelection({ questionIds: [ids.q] });
    gateway.$transaction.mockImplementationOnce((fn, options) => db.$transaction(tx => fn(new Proxy(tx, { get(target, key) {
      if (key === "examContentRevision") return { ...target.examContentRevision, create: async (args: any) => { await target.examContentRevision.create(args); throw new Error("injected after real nested writes"); } };
      return Reflect.get(target, key);
    } })), options));
    await expect(repo.publish({ questionIds: [ids.q] }, ids.user)).rejects.toThrow("injected");
    expect(await db.examContentRevision.count()).toBe(0); expect(await db.examRevisionQuestion.count()).toBe(0); expect(await db.examRevisionOption.count()).toBe(0); expect(await db.examRevisionMedia.count()).toBe(0);
  });
  it("publishes immutable exact content/key and rejects physical historical identity deletion with real foreign keys", async () => {
    const publication = await repo.publish({ questionIds: [ids.q] }, ids.user); const received = await repo.getForBinding(publication.id);
    expect(received.questions.map(q => q.id)).toEqual([ids.q]); expect(received.questions[0].options.map(o => o.id)).toEqual(optionIds);
    expect(received.answerKey[0].correctOptionIds).toEqual([optionIds[0]]);
    await expect(db.examQuestion.delete({ where: { id: ids.answerQ } })).rejects.toMatchObject({ code: "P2003" });
    await expect(db.examQuestion.delete({ where: { id: ids.q } })).rejects.toMatchObject({ code: "P2003" });
    await expect(db.examOption.delete({ where: { id: optionIds[1] } })).rejects.toMatchObject({ code: "P2003" });
    await expect(new ExamEngineRepository().deleteQuestion(ids.answerQ)).rejects.toMatchObject({ statusCode: 409 });
    await expect(new ExamEngineRepository().deleteQuestion(ids.q)).rejects.toMatchObject({ statusCode: 409 });
    await db.examQuestion.update({ where: { id: ids.q }, data: { questionText: "Changed synthetic bank", questionTextEmphasis: Prisma.DbNull, stimulusType: "NONE", stimulusMediaId: null } });
    await db.examOption.update({ where: { id: optionIds[0] }, data: { optionText: "Changed", order: 22, isCorrect: false } });
    await db.examOption.update({ where: { id: optionIds[1] }, data: { optionText: "New correct", mediaId: null, isCorrect: true } });
    await repo.replaceSelection({ questionIds: [] });
    expect(await repo.getForBinding(publication.id)).toEqual(received);
    expect(await new ExamMediaRepository().deleteUnreferenced(ids.media, `${database}/synthetic`, "local")).toEqual({ count: 0 });
    await expect(db.examMedia.delete({ where: { id: ids.media } })).rejects.toMatchObject({ code: "P2003" });
    expect(await db.applicantAnswer.count()).toBe(1);
    expect(JSON.stringify(received.applicantQuestions)).not.toMatch(/isCorrect|sourceImport|storageKey|checksum/);
  });
  it("future synthetic import/manual creation does not select or mutate published content; unused questions can delete safely", async () => {
    const publications = await db.examContentRevision.findMany({ include: { questions: true, media: true } });
    await new ExamContentImportRepository().commit("b2-future-synthetic", "e".repeat(64), [{ sourceQuestionNumber: 1, input: validateExamQuestion({ questionText: "Future synthetic choice", type: "MULTIPLE_CHOICE", options: [{ optionText: "Yes", isCorrect: true }, { optionText: "No", isCorrect: false }] }) }]);
    const manual = await db.examQuestion.create({ data: { questionText: "Unused synthetic question" } });
    expect(await db.examQuestionSelection.count()).toBe(0); expect(await db.examContentRevision.findMany({ include: { questions: true, media: true } })).toEqual(publications);
    await new ExamEngineRepository().deleteQuestion(manual.id); expect(await db.examQuestion.count({ where: { id: manual.id } })).toBe(0);
    const second = await repo.replaceSelection({ questionIds: [ids.q] }); const publication = await repo.publish({ questionIds: second.questionIds }, ids.user);
    expect((await repo.getForBinding(publication.id)).answerKey[0].correctOptionIds).toEqual([optionIds[1]]);
    await db.applicantAnswer.create({ data: { applicationId: ids.app, questionId: ids.q, selectedOptionId: optionIds[0] } });
    await expect(db.examOption.delete({ where: { id: optionIds[0] } })).rejects.toMatchObject({ code: "P2003" });
    expect(await db.examContentRevision.count()).toBe(2);
  });
});
