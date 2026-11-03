// Opt-in LOCAL disposable database. Actual committed migration chain; never db push.
import { randomUUID, createHash } from "node:crypto";
import { readFileSync, mkdtempSync, writeFileSync, readdirSync, cpSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import mysql, { type Connection } from "mysql2/promise";
import { parse } from "dotenv";
import { PrismaClient, Prisma } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
const gateway = vi.hoisted(() => ({ $transaction: vi.fn() }));
vi.mock("../../src/config/database", () => ({ default: gateway }));
import { ExamExecutionRepository } from "../../src/repositories/exam-execution.repository";
import { ExamFinalizationRepository } from "../../src/repositories/exam-finalization.repository";
import { ExamEngineRepository } from "../../src/repositories/exam-engine.repository";
import { manilaCalendarDate } from "../../src/services/exam-schedule-time";
import { EXAM_CONFIGURATION_KEY } from "../../src/services/exam-configuration.rules";
import { setQuestion } from "../fixtures/exam-question-set";

function deferred() { let resolve!: () => void; const promise = new Promise<void>(done => { resolve = done; }); return { resolve, promise }; }
describe.skipIf(process.env.EXAM_B5_DB_TEST !== "1")("B5 real MariaDB execution/migration authority", () => {
  const database = `exam_b5_test_${randomUUID().replaceAll("-", "")}`;
  const migration = "20261103010000_exam_answer_draft_revision";
  const ids = Object.fromEntries(["user", "admin", "student", "program", "slot", "app", "legacy", "completed", "q", "essay", "revision", "media"].map(key => [key, randomUUID()]));
  const repo = new ExamExecutionRepository(), answers = new ExamEngineRepository();
  const config = { examDurationMinutes: 120, mcqPointsPerCorrectItem: 2, essayMaximumScore: null, passingThreshold: null };
  const tables = ["exam_questions", "exam_options", "exam_media", "exam_content_imports", "applicant_answers", "exam_slots", "entrance_exam_applications", "exam_content_revisions", "exam_revision_questions", "exam_revision_options", "exam_revision_media", "exam_question_selection", "entrance_exam_scores", "system_settings"];
  let source: Connection, admin: Connection, observer: PrismaClient, workers: PrismaClient[] = [];
  let original: string, before: string, created = false, folder: string, prismaConfig: string, url: URL;
  let question: ReturnType<typeof setQuestion>;
  const today = () => new Date(`${manilaCalendarDate()}T00:00:00Z`);
  async function snapshot(connection: Connection, selected = tables) {
    const data = await Promise.all(selected.map(async table => {
      const [rows] = await connection.query(`SELECT * FROM \`${table}\``);
      return JSON.parse(JSON.stringify(rows)).sort((a: unknown, b: unknown) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    })); return createHash("sha256").update(JSON.stringify(data)).digest("hex");
  }
  function migrate() {
    return execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy", "--config", prismaConfig], { encoding: "utf8", stdio: "pipe" });
  }
  beforeAll(async () => {
    const env = parse(readFileSync(".env")); url = new URL(process.env.DATABASE_URL || env.DATABASE_URL);
    if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) throw new Error("B5 requires a LOCAL disposable test database.");
    source = await mysql.createConnection(url.toString()); original = await snapshot(source);
    const adminUrl = new URL(url); adminUrl.pathname = "/";
    admin = await mysql.createConnection({ uri: adminUrl.toString(), multipleStatements: true });
    if (!/^exam_b5_test_[0-9a-f]{32}$/.test(database)) throw new Error("Invalid test database identity");
    await admin.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`); created = true;
    await admin.query(`USE \`${database}\``); url.pathname = `/${database}`;
    folder = mkdtempSync(path.join(tmpdir(), "exam-b5-"));
    const migrations = path.join(folder, "migrations");
    for (const item of readdirSync("prisma/migrations")) if (item < migration || item === "migration_lock.toml") cpSync(path.resolve("prisma/migrations", item), path.join(migrations, item), { recursive: true });
    prismaConfig = path.join(folder, "prisma.config.ts");
    writeFileSync(prismaConfig, `export default ${JSON.stringify({ schema: path.resolve("prisma/schema.prisma"), migrations: { path: migrations }, datasource: { url: url.toString() } })}`);
    migrate(); // Entire committed pre-B5 migration chain on empty isolated database.
    await admin.execute("INSERT INTO programs (program_id, program_name, program_type) VALUES (?, 'B5 synthetic', 'MASTERS')", [ids.program]);
    for (const [id, role] of [[ids.user, "APPLICANT"], [ids.admin, "ADMIN"]]) await admin.execute("INSERT INTO users (user_id,email,password_hash,first_name,last_name,role,updated_at) VALUES (?,?, 'unusable', 'B5', 'Fixture', ?, NOW(3))", [id, `${id}@example.invalid`, role]);
    await admin.execute("INSERT INTO students (student_id,user_id,program_id,pinnacle_applicant_id,alignment_status) VALUES (?,?,?,'B5-SYNTHETIC','ALIGNED')", [ids.student, ids.user, ids.program]);
    await admin.execute("INSERT INTO exam_slots (slot_id,program_id,exam_date,exam_time,max_slots,slots_taken) VALUES (?,?,?,'00:00:00',3,3)", [ids.slot, ids.program, manilaCalendarDate()]);
    for (const [id, status] of [[ids.app, "PENDING"], [ids.legacy, "PENDING"], [ids.completed, "TAKEN"]]) await admin.execute("INSERT INTO entrance_exam_applications (application_id,student_id,program_id,slot_id,exam_date,exam_time,status) VALUES (?,?,?,?,?,'00:00:00',?)", [id, ids.student, ids.program, ids.slot, manilaCalendarDate(), status]);
    await admin.execute("INSERT INTO exam_questions (question_id,question_text,type) VALUES (?, 'Synthetic legacy essay', 'ESSAY')", [ids.essay]);
    await admin.execute("INSERT INTO applicant_answers (answer_id,application_id,question_id,essay_answer) VALUES (?,?,?, 'Preserve legacy evidence')", [randomUUID(), ids.legacy, ids.essay]);
    // Snapshot every preexisting column, including legacy answer and terminal record.
    before = await snapshot(admin);
    cpSync(path.resolve("prisma/migrations", migration), path.join(migrations, migration), { recursive: true });
    const output = migrate(); expect(output).toContain(migration);
    const [oldAnswers] = await admin.query("SELECT draft_revision FROM applicant_answers");
    expect(oldAnswers).toEqual([{ draft_revision: 0 }]);
    const [columns] = await admin.query("SHOW COLUMNS FROM applicant_answers");
    const projected = new Proxy(admin, { get(target, property) {
      if (property !== "query") return Reflect.get(target, property);
      return (sql: string) => target.query(sql === "SELECT * FROM `applicant_answers`" ? `SELECT ${(columns as any[]).filter(c => c.Field !== "draft_revision").map(c => `\`${c.Field}\``).join(",")} FROM applicant_answers` : sql);
    } });
    expect(await snapshot(projected)).toBe(before);
    // Newer packages are applied only after comparing the historical migration's original columns.
    for (const item of readdirSync("prisma/migrations")) if (item > migration && item !== "migration_lock.toml") cpSync(path.resolve("prisma/migrations", item), path.join(migrations, item), { recursive: true });
    migrate();
    const status = execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "status", "--config", prismaConfig], { encoding: "utf8", stdio: "pipe" });
    expect(status).toContain("up to date"); expect(migrate()).toContain("No pending migrations");
    const client = () => new PrismaClient({ adapter: new PrismaMariaDb(url.toString().replace("mysql://", "mariadb://")) });
    observer = client(); workers = [client(), client()]; await Promise.all([observer, ...workers].map(db => db.$connect()));
    const engine = await observer.$queryRaw<any[]>`SELECT VERSION() AS version, @@tx_isolation AS isolation_level`;
    console.log("B5 real MariaDB", JSON.stringify(engine), "full pre-B5 chain + B5 deploy/status/redeploy; old-column SHA-256 preserved", before);

    question = setQuestion(ids.q); question.stimulusType = "IMAGE"; question.stimulusMediaId = ids.media;
    await observer.examMedia.create({ data: { id: ids.media, storageKey: `${database}/synthetic`, storageProvider: "local", verifiedMimeType: "image/png", sizeBytes: 1, checksum: "a".repeat(64) } });
    await observer.examQuestion.create({ data: { id: ids.q, questionText: question.questionText, options: { create: question.options.map(o => ({ id: o.id, optionText: o.optionText, isCorrect: o.isCorrect, label: o.label, order: o.order })) } } });
    await observer.examContentRevision.create({ data: { id: ids.revision, publishedAt: new Date("2026-01-01T00:00:00Z"), publishedById: ids.admin, questions: { create: [
      { questionId: ids.q, position: 0, content: question as unknown as Prisma.InputJsonValue, options: { create: question.options.map(o => ({ optionId: o.id })) } },
      { questionId: ids.essay, position: 1, content: { ...question, id: ids.essay, questionText: "Synthetic essay", type: "ESSAY", options: [], stimulusType: "NONE", stimulusMediaId: null, questionTextEmphasis: null } as unknown as Prisma.InputJsonValue },
    ] }, media: { create: { mediaId: ids.media } } } });
  }, 60_000);
  afterAll(async () => {
    try {
      if (source && original) expect(await snapshot(source), "configured canonical data must remain untouched").toBe(original);
      await Promise.all([observer, ...workers].filter(Boolean).map(db => db.$disconnect()));
      if (admin && created) {
        if (!/^exam_b5_test_[0-9a-f]{32}$/.test(database)) throw new Error("Unsafe test cleanup identity");
        await admin.query(`DROP DATABASE \`${database}\``);
        const [remaining] = await admin.query("SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?", [database]); expect(remaining).toHaveLength(0);
        console.log("B5 cleanup: exact disposable database removed, zero synthetic records remain; configured canonical snapshot unchanged", original);
      }
    } finally {
      if (admin) await admin.end(); if (source) await source.end();
      if (folder && path.dirname(folder) === path.resolve(tmpdir()) && path.basename(folder).startsWith("exam-b5-")) rmSync(folder, { recursive: true, force: true });
    }
  }, 20_000);
  beforeEach(async () => {
    gateway.$transaction.mockReset(); gateway.$transaction.mockImplementation((fn, options) => workers[0].$transaction(fn, options));
    await observer.applicantAnswer.deleteMany({ where: { applicationId: ids.app } }); await observer.entranceExamScore.deleteMany({ where: { applicationId: ids.app } });
    await observer.entranceExamApplication.update({ where: { id: ids.app }, data: { status: "PENDING", finalizedAt: null, finalizationReason: null, finalizationReceiptId: null, finalizationAnsweredCount: null, finalizationQuestionCount: null, actualStartedAt: null, deadlineAt: null, contentRevisionId: null, executionConfiguration: Prisma.DbNull, startAuthorizedAt: null, startAuthorizedById: null, examDate: today(), examTime: new Date("1970-01-01T00:00:00Z") } });
    await observer.examSlot.update({ where: { id: ids.slot }, data: { examDate: today(), examTime: new Date("1970-01-01T00:00:00Z") } });
    await observer.systemSetting.upsert({ where: { settingKey: EXAM_CONFIGURATION_KEY }, create: { settingKey: EXAM_CONFIGURATION_KEY, settingType: "JSON", settingValue: JSON.stringify(config) }, update: { settingValue: JSON.stringify(config) } });
    // Test-only cleanup of synthetic future publications, respecting B2 RESTRICT.
    await observer.examRevisionOption.deleteMany({ where: { revisionId: { not: ids.revision } } });
    await observer.examRevisionQuestion.deleteMany({ where: { revisionId: { not: ids.revision } } });
    await observer.examRevisionMedia.deleteMany({ where: { revisionId: { not: ids.revision } } });
    await observer.examContentRevision.deleteMany({ where: { id: { not: ids.revision } } });
  });
  const start = () => repo.start(ids.user, ids.app);
  async function earlySlot() { await observer.examSlot.update({ where: { id: ids.slot }, data: { examTime: new Date("1970-01-01T23:59:00Z") } }); await observer.entranceExamApplication.update({ where: { id: ids.app }, data: { examTime: new Date("1970-01-01T23:59:00Z") } }); }
  async function contend(first: () => Promise<unknown>, second: () => Promise<unknown>, table = "students") {
    const acquired = deferred(), attempted = deferred(), release = deferred(); let invocation = 0, secondAcquired = false, observed = false;
    const connections: number[] = [];
    gateway.$transaction.mockImplementation((fn, options) => {
      const index = invocation++;
      return workers[index].$transaction(async tx => {
        const [connection] = await tx.$queryRaw<{ id: bigint }[]>`SELECT CONNECTION_ID() AS id`; connections[index] = Number(connection.id);
        await tx.entranceExamApplication.count(); // Expose accidental stale REPEATABLE READ snapshot authorization.
        return fn(new Proxy(tx, { get(target, property) {
          if (property !== "$queryRaw") return Reflect.get(target, property);
          return async (...args: Parameters<typeof tx.$queryRaw>) => {
            const matching = String(args[0]).includes(`FROM ${table}`);
            if (matching && index === 1) attempted.resolve();
            const result = await target.$queryRaw(...args);
            if (matching && index === 0) { acquired.resolve(); await release.promise; }
            if (matching && index === 1) secondAcquired = true;
            return result;
          };
        } }));
      }, { ...options, timeout: 12_000 });
    });
    const result1 = first().then(value => ({ value }), error => ({ error })); let result2: Promise<any> | undefined;
    try {
      await Promise.race([acquired.promise, delay(4000).then(() => { throw new Error("First lock not acquired"); })]);
      result2 = second().then(value => ({ value }), error => ({ error }));
      await Promise.race([attempted.promise, delay(4000).then(() => { throw new Error("Second lock not attempted"); })]); expect(connections[0]).not.toBe(connections[1]);
      for (let step = 0; step < 60; step++) {
        const rows = await observer.$queryRaw<{ Id: bigint; Info: string | null }[]>`SHOW FULL PROCESSLIST`;
        if (rows.some(row => Number(row.Id) === connections[1] && row.Info?.includes(`FROM ${table}`) && row.Info.includes("FOR UPDATE")) && !secondAcquired) { await delay(100); expect(secondAcquired).toBe(false); observed = true; break; }
        await delay(40);
      }
    } finally { release.resolve(); await result1; if (result2) await result2; }
    expect(observed, "real independent database lock wait required").toBe(true); console.log(`B5 observed ${table} lock wait: ${connections.join(" / ")}`);
    gateway.$transaction.mockImplementation((fn, options) => workers[0].$transaction(fn, options));
    return Promise.all([result1, result2!]);
  }
  const save = (questionId: string, value: object, expectedRevision = 0, userId = ids.user) => answers.saveDraft(ids.app, { questionId, ...value, expectedRevision }, userId);
  const read = () => answers.readDrafts(ids.app, ids.user);
  const final = () => new ExamFinalizationRepository().submit(ids.app, { acknowledgeIncomplete: true }, ids.user);
  it("rehearsed migration preserves nonempty legacy answers at technical revision zero", async () => {
    expect(await observer.applicantAnswer.findMany({ where: { applicationId: ids.legacy } })).toMatchObject([{ essayAnswer: "Preserve legacy evidence", draftRevision: 0 }]);
    await expect(answers.readDrafts(ids.legacy, ids.user)).rejects.toMatchObject({ statusCode: 409 });
  });
  it.each(["MCQ", "ESSAY"])("two independent clients from one %s revision have one winner and one conflict", async kind => {
    await start(); const id = kind === "MCQ" ? ids.q : ids.essay;
    const first = kind === "MCQ" ? { selectedOptionId: question.options[0].id } : { essayAnswer: "Device A" };
    const second = kind === "MCQ" ? { selectedOptionId: question.options[1].id } : { essayAnswer: "Device B" };
    const [winner, stale] = await contend(() => save(id, first), () => save(id, second), "entrance_exam_applications");
    expect(winner).toHaveProperty("value.revision", 1); expect(stale).toHaveProperty("error.statusCode", 409);
    expect(await read()).toEqual([{ questionId: id, ...first, revision: 1 }]);
  }, 15000);
  it.each(["MCQ", "ESSAY"])("acknowledged %s clearing cannot be resurrected by delayed or duplicate requests", async kind => {
    await start(); const id = kind === "MCQ" ? ids.q : ids.essay;
    const old = kind === "MCQ" ? { selectedOptionId: question.options[0].id } : { essayAnswer: "old essay" };
    const blank = kind === "MCQ" ? { selectedOptionId: null } : { essayAnswer: "" };
    await save(id, old); await save(id, blank, 1);
    for (const revision of [0, 1]) await expect(save(id, old, revision)).rejects.toMatchObject({ statusCode: 409 });
    await expect(save(id, blank, 1)).rejects.toMatchObject({ statusCode: 409 });
    expect(await read()).toEqual([{ questionId: id, ...blank, revision: 2 }]);
  });
  it("refresh and a new Prisma connection recover exactly the persisted safe drafts", async () => {
    await start(); await save(ids.q, { selectedOptionId: question.options[0].id }); await save(ids.essay, { essayAnswer: "recovered" });
    const fresh = new PrismaClient({ adapter: new PrismaMariaDb(url.toString().replace("mysql://", "mariadb://")) });
    try {
      gateway.$transaction.mockImplementation((fn, options) => fresh.$transaction(fn, options));
      const recovered = await new ExamEngineRepository().readDrafts(ids.app, ids.user);
      expect(recovered).toHaveLength(2); expect(JSON.stringify(recovered)).not.toMatch(/isCorrect|storageKey|answerKey|checksum/);
      expect(recovered).toEqual(expect.arrayContaining([{ questionId: ids.essay, essayAnswer: "recovered", revision: 1 }]));
    } finally { await fresh.$disconnect(); }
  });
  it("draft holding lock first commits before final submission", async () => {
    await start(); const [draft, submitted] = await contend(() => save(ids.essay, { essayAnswer: "Draft" }), final, "entrance_exam_applications");
    expect(draft).toHaveProperty("value.revision", 1); expect(submitted).toHaveProperty("value.finalizationReason", "APPLICANT_SUBMITTED");
    expect(await observer.applicantAnswer.findUniqueOrThrow({ where: { applicationId_questionId: { applicationId: ids.app, questionId: ids.essay } } })).toMatchObject({ essayAnswer: "Draft" });
  }, 15000);
  it("submission holding lock first makes waiting and post-TAKEN draft writes reject", async () => {
    await start(); const [submitted, rejected] = await contend(final, () => save(ids.essay, { essayAnswer: "late" }), "entrance_exam_applications");
    expect(submitted).toHaveProperty("value.finalizationReason", "APPLICANT_SUBMITTED"); expect(rejected).toHaveProperty("error.statusCode", 409);
    await expect(save(ids.q, { selectedOptionId: null })).rejects.toMatchObject({ statusCode: 409 });
    await expect(read()).rejects.toMatchObject({ statusCode: 409 });
  }, 15000);
  it("failure after the actual answer write rolls back both value and revision", async () => {
    await start(); await save(ids.essay, { essayAnswer: "previous" });
    gateway.$transaction.mockImplementation((fn, options) => workers[0].$transaction(tx => fn(new Proxy(tx, { get(target, key) {
      if (key !== "applicantAnswer") return Reflect.get(target, key);
      return new Proxy(target.applicantAnswer, { get(model, operation) { if (operation !== "upsert") return Reflect.get(model, operation); return async (args: any) => { await model.upsert(args); throw new Error("B5 injected after real answer write"); }; } });
    } })), options));
    await expect(save(ids.essay, { essayAnswer: "rolled back" }, 1)).rejects.toThrow("B5 injected");
    expect(await observer.applicantAnswer.findUniqueOrThrow({ where: { applicationId_questionId: { applicationId: ids.app, questionId: ids.essay } } })).toMatchObject({ essayAnswer: "previous", draftRevision: 1 });
  });
  it("B4 ownership, unstarted, exact frozen content and deadline remain authoritative", async () => {
    await expect(read()).rejects.toMatchObject({ statusCode: 409 }); await start();
    await expect(save(ids.q, { selectedOptionId: null }, 0, ids.admin)).rejects.toMatchObject({ statusCode: 404 });
    await expect(save(randomUUID(), { selectedOptionId: null })).rejects.toMatchObject({ statusCode: 400 });
    await expect(save(ids.q, { selectedOptionId: randomUUID() })).rejects.toMatchObject({ statusCode: 400 });
    await observer.examQuestion.update({ where: { id: ids.q }, data: { questionText: "mutable source change" } });
    await save(ids.q, { selectedOptionId: question.options[0].id });
    const actualStartedAt = new Date(Date.now() - 121 * 60000);
    await observer.entranceExamApplication.update({ where: { id: ids.app }, data: { actualStartedAt, deadlineAt: new Date(actualStartedAt.getTime() + 120 * 60000) } });
    await expect(save(ids.q, { selectedOptionId: null }, 1)).rejects.toMatchObject({ statusCode: 409 }); await expect(read()).rejects.toMatchObject({ statusCode: 409 });
  });
  it("runs directly affected B4, B0A and B2 real database regressions", () => {
    const output = execFileSync(process.execPath, ["node_modules/vitest/vitest.mjs", "run", "tests/integration/exam-execution-contention.test.ts", "--reporter=verbose"], { encoding: "utf8", stdio: "pipe", env: { ...process.env, DATABASE_URL: url.toString(), EXAM_B4_DB_TEST: "1" } });
    expect(output).toMatch(/11 passed/); console.log("B5 nested B4: 11 PASS, including B0A 5 PASS and B2 4 PASS, all disposable fixtures cleaned.");
  }, 120000);
});
