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
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
const gateway = vi.hoisted(() => ({ $transaction: vi.fn(), entranceExamApplication: { findMany: vi.fn() } }));
vi.mock("../../src/config/database", () => ({ default: gateway }));
import { sweepExpiredExaminations } from "../../src/workers/exam-expiry.worker";
import { ExamExecutionRepository } from "../../src/repositories/exam-execution.repository";
import { ExamFinalizationRepository } from "../../src/repositories/exam-finalization.repository";
import { ExamEngineRepository } from "../../src/repositories/exam-engine.repository";
import { manilaCalendarDate } from "../../src/services/exam-schedule-time";
import { EXAM_CONFIGURATION_KEY } from "../../src/services/exam-configuration.rules";
import { setQuestion } from "../fixtures/exam-question-set";

function deferred() { let resolve!: () => void; const promise = new Promise<void>(done => { resolve = done; }); return { resolve, promise }; }
describe.skipIf(process.env.EXAM_B6_DB_TEST !== "1")("B6 real MariaDB execution/migration authority", () => {
  const database = `exam_b6_test_${randomUUID().replaceAll("-", "")}`;
  const migration = "20261104000000_exam_finalization_authority";
  const ids = Object.fromEntries(["user", "admin", "student", "program", "slot", "app", "clean", "legacy", "completed", "q", "essay", "revision", "preRevision", "media"].map(key => [key, randomUUID()]));
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
    if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) throw new Error("B6 requires a LOCAL disposable test database.");
    source = await mysql.createConnection(url.toString()); original = await snapshot(source);
    const adminUrl = new URL(url); adminUrl.pathname = "/";
    admin = await mysql.createConnection({ uri: adminUrl.toString(), multipleStatements: true });
    if (!/^exam_b6_test_[0-9a-f]{32}$/.test(database)) throw new Error("Invalid test database identity");
    await admin.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`); created = true;
    await admin.query(`USE \`${database}\``); url.pathname = `/${database}`;
    folder = mkdtempSync(path.join(tmpdir(), "exam-b6-"));
    const migrations = path.join(folder, "migrations");
    for (const item of readdirSync("prisma/migrations")) if (item < migration || item === "migration_lock.toml") cpSync(path.resolve("prisma/migrations", item), path.join(migrations, item), { recursive: true });
    prismaConfig = path.join(folder, "prisma.config.ts");
    writeFileSync(prismaConfig, `export default ${JSON.stringify({ schema: path.resolve("prisma/schema.prisma"), migrations: { path: migrations }, datasource: { url: url.toString() } })}`);
    migrate(); // Entire committed pre-B6 migration chain on empty isolated database.
    await admin.execute("INSERT INTO programs (program_id, program_name, program_type) VALUES (?, 'B6 synthetic', 'MASTERS')", [ids.program]);
    for (const [id, role] of [[ids.user, "APPLICANT"], [ids.admin, "ADMIN"]]) await admin.execute("INSERT INTO users (user_id,email,password_hash,first_name,last_name,role,updated_at) VALUES (?,?, 'unusable', 'B6', 'Fixture', ?, NOW(3))", [id, `${id}@example.invalid`, role]);
    await admin.execute("INSERT INTO students (student_id,user_id,program_id,pinnacle_applicant_id,alignment_status) VALUES (?,?,?,'B6-SYNTHETIC','ALIGNED')", [ids.student, ids.user, ids.program]);
    await admin.execute("INSERT INTO exam_slots (slot_id,program_id,exam_date,exam_time,max_slots,slots_taken) VALUES (?,?,?,'00:00:00',4,4)", [ids.slot, ids.program, manilaCalendarDate()]);
    for (const [id, status] of [[ids.app, "PENDING"], [ids.clean, "PENDING"], [ids.legacy, "PENDING"], [ids.completed, "TAKEN"]]) await admin.execute("INSERT INTO entrance_exam_applications (application_id,student_id,program_id,slot_id,exam_date,exam_time,status) VALUES (?,?,?,?,?,'00:00:00',?)", [id, ids.student, ids.program, ids.slot, manilaCalendarDate(), status]);
    await admin.execute("INSERT INTO exam_questions (question_id,question_text,type) VALUES (?, 'Synthetic legacy essay', 'ESSAY')", [ids.essay]);
    await admin.execute("INSERT INTO applicant_answers (answer_id,application_id,question_id,essay_answer) VALUES (?,?,?, 'Preserve legacy evidence')", [randomUUID(), ids.legacy, ids.essay]);
    await admin.execute("INSERT INTO exam_content_revisions (id,published_by_id) VALUES (?,?)", [ids.preRevision, ids.admin]);
    const preContent = { ...setQuestion(ids.essay), type: "ESSAY", options: [] };
    await admin.execute("INSERT INTO exam_revision_questions (revision_id,question_id,position,content) VALUES (?,?,0,?)", [ids.preRevision, ids.essay, JSON.stringify(preContent)]);
    await admin.execute("UPDATE entrance_exam_applications SET actual_started_at=NOW(3), deadline_at=DATE_ADD(NOW(3), INTERVAL 120 MINUTE), execution_configuration=?, content_revision_id=? WHERE application_id=?", [JSON.stringify({ ...config, timezone: "Asia/Manila", passingThresholdUnit: null }), ids.preRevision, ids.app]);
    await admin.execute("INSERT INTO entrance_exam_scores (score_id,application_id,status,multiple_choice_score) VALUES (?,?,'PENDING',0)", [randomUUID(), ids.completed]);
    // Snapshot every preexisting column, including legacy answer and terminal record.
    before = await snapshot(admin);
    const foreignKeySql = "SELECT CONSTRAINT_NAME,COLUMN_NAME,REFERENCED_TABLE_NAME,REFERENCED_COLUMN_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('entrance_exam_applications','applicant_answers','entrance_exam_scores') AND REFERENCED_TABLE_NAME IS NOT NULL ORDER BY TABLE_NAME,CONSTRAINT_NAME,ORDINAL_POSITION";
    const [foreignKeysBefore] = await admin.query(foreignKeySql);
    for (const item of readdirSync("prisma/migrations")) if (item === migration) cpSync(path.resolve("prisma/migrations", item), path.join(migrations, item), { recursive: true });
    const output = migrate(); expect(output).toContain(migration);
    const [oldApps] = await admin.query("SELECT finalized_at, finalization_reason, finalization_receipt_id FROM entrance_exam_applications");
    expect((oldApps as any[]).every(row => Object.values(row).every(value => value === null))).toBe(true);
    const [columns] = await admin.query("SHOW COLUMNS FROM entrance_exam_applications");
    expect((columns as any[]).filter(c => c.Field.startsWith("finalization_") || c.Field === "finalized_at").every(c => c.Null === "YES")).toBe(true);
    expect((await admin.query(foreignKeySql))[0]).toEqual(foreignKeysBefore);
    const projected = new Proxy(admin, { get(target, property) {
      if (property !== "query") return Reflect.get(target, property);
      return (sql: string) => target.query(sql === "SELECT * FROM `entrance_exam_applications`" ? `SELECT ${(columns as any[]).filter(c => !["finalized_at", "finalization_reason", "finalization_receipt_id", "finalization_answered_count", "finalization_question_count"].includes(c.Field)).map(c => `\`${c.Field}\``).join(",")} FROM entrance_exam_applications` : sql);
    } });
    expect(await snapshot(projected)).toBe(before);
    // Rehearse B6 original columns before installing successor migrations.
    for (const item of readdirSync("prisma/migrations")) if (item > migration && item !== "migration_lock.toml") cpSync(path.resolve("prisma/migrations", item), path.join(migrations, item), { recursive: true });
    migrate();
    const status = execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "status", "--config", prismaConfig], { encoding: "utf8", stdio: "pipe" });
    expect(status).toContain("up to date"); expect(migrate()).toContain("No pending migrations");
    const client = () => new PrismaClient({ adapter: new PrismaMariaDb(url.toString().replace("mysql://", "mariadb://")) });
    observer = client(); workers = [client(), client()]; await Promise.all([observer, ...workers].map(db => db.$connect()));
    const engine = await observer.$queryRaw<any[]>`SELECT VERSION() AS version, @@tx_isolation AS isolation_level`;
    console.log("B6 real MariaDB", JSON.stringify(engine), "full pre-B6 chain + B6 deploy/status/redeploy; old-column SHA-256 preserved", before);

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
        if (!/^exam_b6_test_[0-9a-f]{32}$/.test(database)) throw new Error("Unsafe test cleanup identity");
        await admin.query(`DROP DATABASE \`${database}\``);
        const [remaining] = await admin.query("SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?", [database]); expect(remaining).toHaveLength(0);
        console.log("B6 cleanup: exact disposable database removed, zero synthetic records remain; configured canonical snapshot unchanged", original);
      }
    } finally {
      if (admin) await admin.end(); if (source) await source.end();
      if (folder && path.dirname(folder) === path.resolve(tmpdir()) && path.basename(folder).startsWith("exam-b6-")) rmSync(folder, { recursive: true, force: true });
    }
  }, 20_000);
  beforeEach(async () => {
    gateway.entranceExamApplication.findMany.mockImplementation(args => observer.entranceExamApplication.findMany(args));
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
  async function contend(first: () => Promise<unknown>, second: () => Promise<unknown>, table = "students", whileBlocked?: () => void) {
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
      if (observed) whileBlocked?.();
    } finally { release.resolve(); await result1; if (result2) await result2; }
    expect(observed, "real independent database lock wait required").toBe(true); console.log(`B6 observed ${table} lock wait: ${connections.join(" / ")}`);
    gateway.$transaction.mockImplementation((fn, options) => workers[0].$transaction(fn, options));
    return Promise.all([result1, result2!]);
  }
  const save = (questionId: string, value: object, expectedRevision = 0, userId = ids.user) => answers.saveDraft(ids.app, { questionId, ...value, expectedRevision }, userId);
  const read = () => answers.readDrafts(ids.app, ids.user);
  const finalizer = new ExamFinalizationRepository();
  const final = (acknowledgeIncomplete = true) => finalizer.submit(ids.app, { acknowledgeIncomplete }, ids.user);
  const expire = () => finalizer.expire(ids.app);
  async function overdue() { const actualStartedAt = new Date(Date.now() - 121 * 60_000); await observer.entranceExamApplication.update({ where: { id: ids.app }, data: { actualStartedAt, deadlineAt: new Date(actualStartedAt.getTime() + 120 * 60_000) } }); }
  afterEach(() => vi.useRealTimers());
  it("migration preserves clean/started/legacy/answers/score; nullable evidence and indexes are honest", async () => {
    const legacy = await observer.entranceExamApplication.findUniqueOrThrow({ where: { id: ids.completed } });
    expect(legacy).toMatchObject({ status: "TAKEN", finalizedAt: null, finalizationReason: null, finalizationReceiptId: null });
    expect(await observer.entranceExamScore.count({ where: { applicationId: ids.completed } })).toBe(1);
    const indexes = await observer.$queryRaw<any[]>`SHOW INDEX FROM entrance_exam_applications`;
    expect(indexes.some(row => row.Key_name === "exam_expiry_candidates")).toBe(true);
    expect(indexes.some(row => row.Column_name === "finalization_receipt_id" && Number(row.Non_unique) === 0)).toBe(true);
    expect(await observer.applicantAnswer.findMany({ where: { applicationId: ids.legacy } })).toMatchObject([{ essayAnswer: "Preserve legacy evidence", draftRevision: 0 }]);
  });
  it("complete explicit submit uses saved rows/frozen key, one PENDING raw score and no fabricated essays", async () => {
    await start(); await save(ids.q, { selectedOptionId: question.options[0].id }); await save(ids.essay, { essayAnswer: "Actual essay" });
    const before = await observer.applicantAnswer.findMany({ where: { applicationId: ids.app }, orderBy: { id: "asc" } });
    const receipt = await final(false); expect(receipt).toMatchObject({ finalizationReason: "APPLICANT_SUBMITTED", answeredCount: 2, unansweredCount: 0 });
    expect(await observer.applicantAnswer.findMany({ where: { applicationId: ids.app }, orderBy: { id: "asc" } })).toEqual(before);
    const score = await observer.entranceExamScore.findUniqueOrThrow({ where: { applicationId: ids.app } });
    expect(Number(score.multipleChoiceScore)).toBe(1); expect(score).toMatchObject({ essayScore: null, totalScore: null, status: "PENDING" });
  });
  it("incomplete submit rejects without writes, explicit acknowledgment succeeds", async () => {
    await start(); await expect(final(false)).rejects.toMatchObject({ statusCode: 409, code: "INCOMPLETE_CONFIRMATION_REQUIRED" });
    expect(await observer.entranceExamScore.count({ where: { applicationId: ids.app } })).toBe(0);
    expect(await observer.entranceExamApplication.findUniqueOrThrow({ where: { id: ids.app } })).toMatchObject({ status: "PENDING", finalizedAt: null });
    expect(await final()).toMatchObject({ unansweredCount: 2, finalizationReason: "APPLICANT_SUBMITTED" });
    expect(await observer.applicantAnswer.count({ where: { applicationId: ids.app } })).toBe(0);
  });
  it("expiry consumes last acknowledgment including clear states, no answer fabrication", async () => {
    await start(); await save(ids.q, { selectedOptionId: question.options[0].id }); await save(ids.q, { selectedOptionId: null }, 1); await save(ids.essay, { essayAnswer: "  " });
    const before = await observer.applicantAnswer.findMany({ where: { applicationId: ids.app }, orderBy: { id: "asc" } }); await overdue();
    expect(await expire()).toMatchObject({ finalizationReason: "TIME_EXPIRED", answeredCount: 0, unansweredCount: 2 });
    expect(await observer.applicantAnswer.findMany({ where: { applicationId: ids.app }, orderBy: { id: "asc" } })).toEqual(before);
    await expect(save(ids.essay, { essayAnswer: "unsent local value" }, 1)).rejects.toMatchObject({ statusCode: 409 });
  });
  it("expiry sweep ignores never-started and legacy terminal records", async () => {
    expect(await sweepExpiredExaminations()).toEqual({ examined: 0, finalized: 0 });
    expect(await observer.entranceExamApplication.findUniqueOrThrow({ where: { id: ids.app } })).toMatchObject({ status: "PENDING", actualStartedAt: null, finalizedAt: null });
  });
  it("submit vs submit recovers one receipt across an observed InnoDB lock wait", async () => {
    await start(); const [first, second] = await contend(final, final, "entrance_exam_applications");
    expect(first).toHaveProperty("value.finalizationReason", "APPLICANT_SUBMITTED"); expect(second).toEqual(first);
    expect(await observer.entranceExamScore.count({ where: { applicationId: ids.app } })).toBe(1);
  }, 15000);
  it("explicit lock before deadline wins against an expiry contender", async () => {
    await start(); const [first, second] = await contend(final, expire, "entrance_exam_applications");
    expect(first).toHaveProperty("value.finalizationReason", "APPLICANT_SUBMITTED"); expect(second).toEqual(first);
  }, 15000);
  it("expiry lock first wins; waiting Applicant request recovers the timeout receipt", async () => {
    await start(); await overdue(); const [first, second] = await contend(expire, final, "entrance_exam_applications");
    expect(first).toHaveProperty("value.finalizationReason", "TIME_EXPIRED"); expect(second).toEqual(first);
  }, 15000);
  it("draft lock first commits and explicit finalizer consumes its exact acknowledgment", async () => {
    await start(); const [draft, receipt] = await contend(() => save(ids.essay, { essayAnswer: "Last acknowledged essay" }), final, "entrance_exam_applications");
    expect(draft).toHaveProperty("value.revision", 1); expect(receipt).toHaveProperty("value.answeredCount", 1);
    expect((await observer.applicantAnswer.findFirstOrThrow({ where: { applicationId: ids.app } })).essayAnswer).toBe("Last acknowledged essay");
  }, 15000);
  it("explicit lock first makes waiting draft reject without answer insertion", async () => {
    await start(); const [receipt, draft] = await contend(final, () => save(ids.essay, { essayAnswer: "Too late" }), "entrance_exam_applications");
    expect(receipt).toHaveProperty("value.receiptId"); expect(draft).toHaveProperty("error.statusCode", 409);
    expect(await observer.applicantAnswer.count({ where: { applicationId: ids.app } })).toBe(0);
  }, 15000);
  it("expiry lock first makes waiting draft reject and preserves last saved state", async () => {
    await start(); await save(ids.essay, { essayAnswer: "saved" }); await overdue();
    const [receipt, draft] = await contend(expire, () => save(ids.essay, { essayAnswer: "Too late" }, 1), "entrance_exam_applications");
    expect(receipt).toHaveProperty("value.finalizationReason", "TIME_EXPIRED"); expect(draft).toHaveProperty("error.statusCode", 409);
    expect((await observer.applicantAnswer.findFirstOrThrow({ where: { applicationId: ids.app } })).essayAnswer).toBe("saved");
  }, 15000);
  it("exact now equal to deadline resolves explicit submit to TIME_EXPIRED without acknowledgment", async () => {
    await start(); const app = await observer.entranceExamApplication.findUniqueOrThrow({ where: { id: ids.app } });
    vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(app.deadlineAt!);
    expect(await final(false)).toMatchObject({ finalizationReason: "TIME_EXPIRED", finalizedAt: app.deadlineAt!.toISOString() });
  });
  const lockOnly = () => gateway.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.$queryRaw`SELECT status FROM entrance_exam_applications WHERE application_id = ${ids.app} FOR UPDATE`; return true;
  });
  it("explicit request waiting across deadline loses to expiry after current-state reread", async () => {
    await start(); const app = await observer.entranceExamApplication.findUniqueOrThrow({ where: { id: ids.app } });
    vi.useFakeTimers({ toFake: ["Date"] });
    const [blocker, receipt] = await contend(lockOnly, () => final(false), "entrance_exam_applications", () => vi.setSystemTime(app.deadlineAt!));
    expect(blocker).toHaveProperty("value", true); expect(receipt).toHaveProperty("value.finalizationReason", "TIME_EXPIRED");
  }, 15000);
  it("draft awaiting the lock past deadline fails; timeout uses only previous acknowledged draft", async () => {
    await start(); await save(ids.essay, { essayAnswer: "acknowledged" }); const app = await observer.entranceExamApplication.findUniqueOrThrow({ where: { id: ids.app } });
    vi.useFakeTimers({ toFake: ["Date"] });
    const [, draft] = await contend(lockOnly, () => save(ids.essay, { essayAnswer: "never saved" }, 1), "entrance_exam_applications", () => vi.setSystemTime(app.deadlineAt!));
    expect(draft).toHaveProperty("error.statusCode", 409); expect(await expire()).toMatchObject({ answeredCount: 1, finalizationReason: "TIME_EXPIRED" });
    expect((await observer.applicantAnswer.findFirstOrThrow({ where: { applicationId: ids.app } })).essayAnswer).toBe("acknowledged");
  }, 15000);
  it("repeated sweeps skip completed records and preserve one receipt", async () => {
    await start(); await overdue(); expect(await sweepExpiredExaminations()).toEqual({ examined: 1, finalized: 1 });
    const receipt = await finalizer.read(ids.app, ids.user); expect(await sweepExpiredExaminations()).toEqual({ examined: 0, finalized: 0 }); expect(await finalizer.read(ids.app, ids.user)).toEqual(receipt);
  });
  it("two independent sweep services recover one result via database authority", async () => {
    await start(); await overdue(); const [first, second] = await contend(sweepExpiredExaminations, sweepExpiredExaminations, "entrance_exam_applications");
    expect(first).toHaveProperty("value.finalized", 1); expect(second).toHaveProperty("value.finalized", 1);
    expect(await observer.entranceExamScore.count({ where: { applicationId: ids.app } })).toBe(1);
  }, 15000);
  it("lost response retry and new Prisma connection return exact immutable receipt", async () => {
    await start(); const committed = await final();
    const fresh = new PrismaClient({ adapter: new PrismaMariaDb(url.toString().replace("mysql://", "mariadb://")) });
    try { gateway.$transaction.mockImplementation((fn, options) => fresh.$transaction(fn, options)); expect(await final()).toEqual(committed); expect((await finalizer.read(ids.app, ids.user)).receipt).toEqual(committed); }
    finally { await fresh.$disconnect(); }
  });
  it("exception after actual score and finalization writes rolls everything back, preserving acknowledged answers", async () => {
    await start(); await save(ids.essay, { essayAnswer: "preserved" });
    const before = await observer.applicantAnswer.findMany({ where: { applicationId: ids.app } });
    gateway.$transaction.mockImplementation((fn, options) => workers[0].$transaction(tx => fn(new Proxy(tx, { get(target, key) {
      if (key !== "entranceExamScore") return Reflect.get(target, key);
      return new Proxy(target.entranceExamScore, { get(model, operation) { if (operation !== "create") return Reflect.get(model, operation); return async (args: any) => { await model.create(args); throw new Error("B6 injected after actual finalization/score writes"); }; } });
    } })), options));
    await expect(final()).rejects.toThrow("B6 injected");
    expect(await observer.entranceExamApplication.findUniqueOrThrow({ where: { id: ids.app } })).toMatchObject({ status: "PENDING", finalizedAt: null, finalizationReceiptId: null });
    expect(await observer.entranceExamScore.count({ where: { applicationId: ids.app } })).toBe(0); expect(await observer.applicantAnswer.findMany({ where: { applicationId: ids.app } })).toEqual(before);
  });
  it("separate Node process startup catches up an overdue closed-browser examination", async () => {
    await start(); await save(ids.essay, { essayAnswer: "before server downtime" }); await overdue(); const before = new Date();
    const code = `const db=require('./dist/config/database').default; const {startExamExpiryWorker,sweepExpiredExaminations}=require('./dist/workers/exam-expiry.worker'); let worker; worker=startExamExpiryWorker(async()=>{try{console.log('B6_CATCHUP',JSON.stringify(await sweepExpiredExaminations()));}finally{setImmediate(async()=>{worker.stop();await db.$disconnect();});}});`;
    const output = execFileSync(process.execPath, ["-e", code], { encoding: "utf8", stdio: "pipe", env: { ...process.env, DATABASE_URL: url.toString() }, timeout: 20000 });
    expect(output).toContain('"finalized":1'); const receipt = (await finalizer.read(ids.app, ids.user)).receipt!;
    expect(receipt.finalizationReason).toBe("TIME_EXPIRED"); expect(Date.parse(receipt.finalizedAt)).toBeGreaterThanOrEqual(before.getTime()); expect(Date.parse(receipt.finalizedAt)).toBeGreaterThan(Date.parse(receipt.deadlineAt));
    expect((await observer.applicantAnswer.findFirstOrThrow({ where: { applicationId: ids.app } })).essayAnswer).toBe("before server downtime");
    console.log("B6 separate Node process startup catch-up:", receipt.receiptId);
  }, 30000);
  it("runs B5/B4/B0A/B2 directly affected real database regressions separately", () => {
    const output = execFileSync(process.execPath, ["node_modules/vitest/vitest.mjs", "run", "tests/integration/exam-draft-contention.test.ts", "--reporter=verbose"], { encoding: "utf8", stdio: "pipe", env: { ...process.env, DATABASE_URL: url.toString(), EXAM_B5_DB_TEST: "1" }, timeout: 180000 });
    expect(output).toMatch(/11 passed/); console.log("B6 nested regression only: B5 11 PASS including B4 11, B0A 5, B2 4. Not independent B6 tests.");
  }, 180000);
});
