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
const gateway = vi.hoisted(() => ({ $transaction: vi.fn(), entranceExamApplication: { findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn() }, examQuestion: { count: vi.fn() } }));
vi.mock("../../src/config/database", () => ({ default: gateway }));
vi.mock("../../src/services/email.service", () => ({ EmailService: { sendTemplateEmail: vi.fn() } }));
import { ExamQuestionSetRepository } from "../../src/repositories/exam-question-set.repository";
import { ExamRepository } from "../../src/repositories/exam.repository";
import { ExamService } from "../../src/services/exam.service";
import { ExamExecutionRepository } from "../../src/repositories/exam-execution.repository";
import { ExamFinalizationRepository } from "../../src/repositories/exam-finalization.repository";
import { ExamEngineRepository } from "../../src/repositories/exam-engine.repository";
import { manilaCalendarDate } from "../../src/services/exam-schedule-time";
import { EXAM_CONFIGURATION_KEY } from "../../src/services/exam-configuration.rules";
import { setQuestion } from "../fixtures/exam-question-set";

function deferred() { let resolve!: () => void; const promise = new Promise<void>(done => { resolve = done; }); return { resolve, promise }; }
describe.skipIf(process.env.EXAM_B7_DB_TEST !== "1")("B7 real MariaDB execution/migration authority", () => {
  const database = `exam_b7_test_${randomUUID().replaceAll("-", "")}`;
  const migration = "20261104010000_exam_essay_evaluation";
  const ids = Object.fromEntries(["user", "admin", "admin2", "student", "program", "slot", "app", "clean", "legacy", "completed", "failed", "q", "essay", "revision", "preRevision", "media"].map(key => [key, randomUUID()]));
  const repo = new ExamExecutionRepository(), answers = new ExamEngineRepository();
  const config = { examDurationMinutes: 120, mcqPointsPerCorrectItem: 2, essayMaximumScore: 25.5, passingThreshold: null };
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
    if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) throw new Error("B7 requires a LOCAL disposable test database.");
    source = await mysql.createConnection(url.toString()); original = await snapshot(source);
    const adminUrl = new URL(url); adminUrl.pathname = "/";
    admin = await mysql.createConnection({ uri: adminUrl.toString(), multipleStatements: true });
    if (!/^exam_b7_test_[0-9a-f]{32}$/.test(database)) throw new Error("Invalid test database identity");
    await admin.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`); created = true;
    await admin.query(`USE \`${database}\``); url.pathname = `/${database}`;
    folder = mkdtempSync(path.join(tmpdir(), "exam-b7-"));
    const migrations = path.join(folder, "migrations");
    for (const item of readdirSync("prisma/migrations")) if (item < migration || item === "migration_lock.toml") cpSync(path.resolve("prisma/migrations", item), path.join(migrations, item), { recursive: true });
    prismaConfig = path.join(folder, "prisma.config.ts");
    writeFileSync(prismaConfig, `export default ${JSON.stringify({ schema: path.resolve("prisma/schema.prisma"), migrations: { path: migrations }, datasource: { url: url.toString() } })}`);
    migrate(); // Entire committed pre-B7 migration chain on empty isolated database.
    await admin.execute("INSERT INTO programs (program_id, program_name, program_type) VALUES (?, 'B7 synthetic', 'MASTERS')", [ids.program]);
    for (const [id, role] of [[ids.user, "APPLICANT"], [ids.admin, "ADMIN"], [ids.admin2, "ADMIN"]]) await admin.execute("INSERT INTO users (user_id,email,password_hash,first_name,last_name,role,updated_at) VALUES (?,?, 'unusable', 'B7', 'Fixture', ?, NOW(3))", [id, `${id}@example.invalid`, role]);
    await admin.execute("INSERT INTO students (student_id,user_id,program_id,pinnacle_applicant_id,alignment_status) VALUES (?,?,?,'B7-SYNTHETIC','ALIGNED')", [ids.student, ids.user, ids.program]);
    await admin.execute("INSERT INTO exam_slots (slot_id,program_id,exam_date,exam_time,max_slots,slots_taken) VALUES (?,?,?,'00:00:00',5,5)", [ids.slot, ids.program, manilaCalendarDate()]);
    for (const [id, status] of [[ids.app, "TAKEN"], [ids.clean, "PENDING"], [ids.legacy, "TAKEN"], [ids.completed, "PASSED"], [ids.failed, "FAILED"]]) await admin.execute("INSERT INTO entrance_exam_applications (application_id,student_id,program_id,slot_id,exam_date,exam_time,status) VALUES (?,?,?,?,?,'00:00:00',?)", [id, ids.student, ids.program, ids.slot, manilaCalendarDate(), status]);
    await admin.execute("INSERT INTO exam_questions (question_id,question_text,type) VALUES (?, 'Synthetic legacy essay', 'ESSAY')", [ids.essay]);
    await admin.execute("INSERT INTO applicant_answers (answer_id,application_id,question_id,essay_answer) VALUES (?,?,?, 'Preserve legacy evidence')", [randomUUID(), ids.legacy, ids.essay]);
    await admin.execute("INSERT INTO exam_content_revisions (id,published_by_id) VALUES (?,?)", [ids.preRevision, ids.admin]);
    const preContent = { ...setQuestion(ids.essay), type: "ESSAY", options: [] };
    await admin.execute("INSERT INTO exam_revision_questions (revision_id,question_id,position,content) VALUES (?,?,0,?)", [ids.preRevision, ids.essay, JSON.stringify(preContent)]);
    await admin.execute("UPDATE entrance_exam_applications SET actual_started_at=DATE_SUB(NOW(3), INTERVAL 60 MINUTE), deadline_at=DATE_ADD(NOW(3), INTERVAL 60 MINUTE), execution_configuration=?, content_revision_id=? WHERE application_id=?", [JSON.stringify({ ...config, timezone: "Asia/Manila", passingThresholdUnit: null }), ids.preRevision, ids.app]);
    await admin.execute("INSERT INTO entrance_exam_scores (score_id,application_id,status,multiple_choice_score) VALUES (?,?,'PENDING',0)", [randomUUID(), ids.completed]);
    await admin.execute("UPDATE entrance_exam_applications SET finalized_at=DATE_ADD(actual_started_at, INTERVAL 10 MINUTE),finalization_reason='APPLICANT_SUBMITTED',finalization_receipt_id=?,finalization_answered_count=0,finalization_question_count=1 WHERE application_id=?", [randomUUID(), ids.app]);
    await admin.execute("INSERT INTO entrance_exam_scores (score_id,application_id,status,multiple_choice_score) VALUES (?,?,'PENDING',0)", [randomUUID(), ids.app]);
    await admin.execute("INSERT INTO entrance_exam_scores (score_id,application_id,status,multiple_choice_score) VALUES (?,?,'PENDING',0)", [randomUUID(), ids.legacy]);
    await admin.execute("UPDATE entrance_exam_scores SET status='PASSED',essay_score=18.25,total_score=80,graded_by=? WHERE application_id=?", [ids.admin, ids.completed]);
    await admin.execute("INSERT INTO entrance_exam_scores (score_id,application_id,status,multiple_choice_score,essay_score,total_score,graded_by) VALUES (?,?,'FAILED',1,0,1,?)", [randomUUID(), ids.failed, ids.admin2]);
    // Snapshot every original column: B6 evidence, B5 answers and legacy grades.
    await admin.execute("UPDATE entrance_exam_applications SET created_at='2020-01-01' WHERE application_id IN (?,?,?)", [ids.legacy, ids.completed, ids.failed]);
    before = await snapshot(admin);
    const foreignKeySql = "SELECT CONSTRAINT_NAME,COLUMN_NAME,REFERENCED_TABLE_NAME,REFERENCED_COLUMN_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('entrance_exam_applications','applicant_answers','entrance_exam_scores') AND REFERENCED_TABLE_NAME IS NOT NULL ORDER BY TABLE_NAME,CONSTRAINT_NAME,ORDINAL_POSITION";
    const [foreignKeysBefore] = await admin.query(foreignKeySql);
    for (const item of readdirSync("prisma/migrations")) if (item === migration) cpSync(path.resolve("prisma/migrations", item), path.join(migrations, item), { recursive: true });
    const output = migrate(); expect(output).toContain(migration);
    const [columns] = await admin.query("SHOW COLUMNS FROM entrance_exam_scores");
    expect((columns as any[]).find(c => c.Field === "essay_evaluated_at").Null).toBe("YES");
    expect((await admin.query("SELECT essay_evaluated_at FROM entrance_exam_scores"))[0]).toEqual(Array(4).fill({ essay_evaluated_at: null }));
    expect((await admin.query(foreignKeySql))[0]).toEqual(foreignKeysBefore);
    const projected = new Proxy(admin, { get(target, property) {
      if (property !== "query") return Reflect.get(target, property);
      return (sql: string) => target.query(sql === "SELECT * FROM `entrance_exam_scores`" ? `SELECT ${(columns as any[]).filter(c => c.Field !== "essay_evaluated_at").map(c => `\`${c.Field}\``).join(",")} FROM entrance_exam_scores` : sql);
    } });
    expect(await snapshot(projected)).toBe(before);
    // Rehearse B7 original columns before installing successor migrations.
    for (const item of readdirSync("prisma/migrations")) if (item > migration && item !== "migration_lock.toml") cpSync(path.resolve("prisma/migrations", item), path.join(migrations, item), { recursive: true });
    migrate();
    const status = execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "status", "--config", prismaConfig], { encoding: "utf8", stdio: "pipe" });
    expect(status).toContain("up to date"); expect(migrate()).toContain("No pending migrations");
    const client = () => new PrismaClient({ adapter: new PrismaMariaDb(url.toString().replace("mysql://", "mariadb://")) });
    observer = client(); workers = [client(), client()]; await Promise.all([observer, ...workers].map(db => db.$connect()));
    const engine = await observer.$queryRaw<any[]>`SELECT VERSION() AS version, @@tx_isolation AS isolation_level`;
    console.log("B7 real MariaDB", JSON.stringify(engine), "full pre-B7 chain + B7 deploy/status/redeploy; old-column SHA-256 preserved", before);

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
        if (!/^exam_b7_test_[0-9a-f]{32}$/.test(database)) throw new Error("Unsafe test cleanup identity");
        await admin.query(`DROP DATABASE \`${database}\``);
        const [remaining] = await admin.query("SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?", [database]); expect(remaining).toHaveLength(0);
        console.log("B7 cleanup: exact disposable database removed, zero synthetic records remain; configured canonical snapshot unchanged", original);
      }
    } finally {
      if (admin) await admin.end(); if (source) await source.end();
      if (folder && path.dirname(folder) === path.resolve(tmpdir()) && path.basename(folder).startsWith("exam-b7-")) rmSync(folder, { recursive: true, force: true });
    }
  }, 20_000);
  beforeEach(async () => {
    gateway.entranceExamApplication.findMany.mockImplementation(args => observer.entranceExamApplication.findMany(args));
    gateway.entranceExamApplication.findFirst.mockImplementation(args => observer.entranceExamApplication.findFirst(args));
    gateway.entranceExamApplication.findUnique.mockImplementation(args => observer.entranceExamApplication.findUnique(args));
    gateway.examQuestion.count.mockImplementation(args => observer.examQuestion.count(args));
    await observer.examQuestionSelection.deleteMany({});
    gateway.$transaction.mockReset(); gateway.$transaction.mockImplementation((fn, options) => workers[0].$transaction(fn, options));
    await observer.applicantAnswer.deleteMany({ where: { applicationId: ids.app } }); await observer.entranceExamScore.deleteMany({ where: { applicationId: ids.app } });
    await observer.entranceExamApplication.update({ where: { id: ids.app }, data: { status: "PENDING", createdAt: new Date(), finalizedAt: null, finalizationReason: null, finalizationReceiptId: null, finalizationAnsweredCount: null, finalizationQuestionCount: null, actualStartedAt: null, deadlineAt: null, contentRevisionId: null, executionConfiguration: Prisma.DbNull, startAuthorizedAt: null, startAuthorizedById: null, examDate: today(), examTime: new Date("1970-01-01T00:00:00Z") } });
    await observer.examSlot.update({ where: { id: ids.slot }, data: { examDate: today(), examTime: new Date("1970-01-01T00:00:00Z") } });
    await observer.systemSetting.upsert({ where: { settingKey: EXAM_CONFIGURATION_KEY }, create: { settingKey: EXAM_CONFIGURATION_KEY, settingType: "JSON", settingValue: JSON.stringify(config) }, update: { settingValue: JSON.stringify(config) } });
    await observer.program.update({ where: { id: ids.program }, data: { examEssayTotal: 30 } });
    await observer.examQuestion.update({ where: { id: ids.essay }, data: { questionText: "Synthetic legacy essay" } });
    // Test-only cleanup of synthetic future publications, respecting B2 RESTRICT.
    await observer.examRevisionOption.deleteMany({ where: { revisionId: { not: ids.revision } } });
    await observer.examRevisionQuestion.deleteMany({ where: { revisionId: { not: ids.revision } } });
    await observer.examRevisionMedia.deleteMany({ where: { revisionId: { not: ids.revision } } });
    await observer.examContentRevision.deleteMany({ where: { id: { not: ids.revision } } });
  });
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
    expect(observed, "real independent database lock wait required").toBe(true); console.log(`B7 observed ${table} lock wait: ${connections.join(" / ")}`);
    gateway.$transaction.mockImplementation((fn, options) => workers[0].$transaction(fn, options));
    return Promise.all([result1, result2!]);
  }
  const start = () => repo.start(ids.user, ids.app);
  const finalizer = new ExamFinalizationRepository();
  const evaluation = new ExamRepository();
  const grade = (value = 18.25, adminId = ids.admin) => evaluation.gradeEssay(ids.app, value, adminId);
  const detail = () => evaluation.getApplicationDetail(ids.app);
  const stored = () => observer.entranceExamScore.findUniqueOrThrow({ where: { applicationId: ids.app } });
  async function finalize(response: string | null = "Exact finalized\nresponse  ", expired = false) {
    await start();
    if (response !== null) await answers.saveDraft(ids.app, { questionId: ids.essay, essayAnswer: response, expectedRevision: 0 }, ids.user);
    if (expired) {
      const actualStartedAt = new Date(Date.now() - 121 * 60_000);
      await observer.entranceExamApplication.update({ where: { id: ids.app }, data: { actualStartedAt, deadlineAt: new Date(actualStartedAt.getTime() + 120 * 60_000) } });
      await finalizer.expire(ids.app);
    } else await finalizer.submit(ids.app, { acknowledgeIncomplete: true }, ids.user);
  }
  it("additive migration preserves B6 finalized/PENDING, legacy TAKEN, historical PASSED grades, B5 answers and exact old columns", async () => {
    const historical = await observer.entranceExamScore.findUniqueOrThrow({ where: { applicationId: ids.completed } });
    expect(historical).toMatchObject({ status: "PASSED", gradedById: ids.admin, essayEvaluatedAt: null });
    expect(Number(historical.essayScore)).toBe(18.25); expect(Number(historical.totalScore)).toBe(80);
    expect((await observer.applicantAnswer.findFirstOrThrow({ where: { applicationId: ids.legacy } })).essayAnswer).toBe("Preserve legacy evidence");
  });
  it.each([0, 18.25, 25.5])("B6-finalized evaluation accepts %s without total/result changes", async value => {
    await finalize(); const before = await observer.applicantAnswer.findMany({ where: { applicationId: ids.app } });
    expect(await grade(value)).toMatchObject({ status: "COMPLETED", essayScore: value, maximumScore: 25.5, evaluator: { id: ids.admin } });
    expect(await observer.entranceExamApplication.findUniqueOrThrow({ where: { id: ids.app } })).toMatchObject({ status: "TAKEN" });
    expect(await stored()).toMatchObject({ status: "PENDING", totalScore: null, gradedById: ids.admin, essayEvaluatedAt: expect.any(Date) });
    expect(await observer.applicantAnswer.findMany({ where: { applicationId: ids.app } })).toEqual(before);
  });
  it.each([26, -1, NaN, Infinity, null, "18", "", 1e-31]) ("invalid score %# rejects without evaluation", async value => {
    await finalize(); await expect(grade(value as number)).rejects.toMatchObject({ statusCode: 400 });
    expect(await stored()).toMatchObject({ essayScore: null, gradedById: null, essayEvaluatedAt: null });
  });
  it("missing captured maximum rejects even after Program maximum mutation", async () => {
    await finalize(); const app = await observer.entranceExamApplication.findUniqueOrThrow({ where: { id: ids.app } });
    await observer.entranceExamApplication.update({ where: { id: ids.app }, data: { executionConfiguration: { ...(app.executionConfiguration as object), essayMaximumScore: null } } });
    await observer.program.update({ where: { id: ids.program }, data: { examEssayTotal: 1000 } });
    await expect(grade()).rejects.toMatchObject({ statusCode: 409 }); expect((await detail())?.essayEvaluation.status).toBe("STAFF_REVIEW");
  });
  it("Program and current configuration changes cannot alter captured maximum", async () => {
    await finalize(); await observer.program.update({ where: { id: ids.program }, data: { examEssayTotal: 1 } });
    await observer.systemSetting.update({ where: { settingKey: EXAM_CONFIGURATION_KEY }, data: { settingValue: JSON.stringify({ ...config, essayMaximumScore: 1000 }) } });
    expect(await grade(25.5)).toMatchObject({ essayScore: 25.5, maximumScore: 25.5 });
  });
  it("mutable essay prompt/type edits do not change exact frozen Admin review", async () => {
    await finalize(); const before = (await detail())!.essayEvaluation;
    await observer.examQuestion.update({ where: { id: ids.essay }, data: { questionText: "Later mutable prompt", type: "MULTIPLE_CHOICE" } });
    try { expect((await detail())!.essayEvaluation).toEqual(before); expect(await grade()).toHaveProperty("question.questionText", "Synthetic essay"); }
    finally { await observer.examQuestion.update({ where: { id: ids.essay }, data: { type: "ESSAY" } }); }
  });
  it.each([null, "", "  \n"]) ("missing/blank essay %# remains truthful, never auto-scored", async response => {
    await finalize(response); const dto = (await detail())!.essayEvaluation;
    expect(dto).toMatchObject({ responseText: response, responseState: response === null ? "MISSING" : "BLANK", essayScore: null, status: "PENDING" });
    expect(await grade(0)).toHaveProperty("essayScore", 0);
  });
  async function invalidRevision(essayCount: number) {
    const extra = randomUUID();
    await observer.examQuestion.create({ data: { id: extra, questionText: "Synthetic extra essay", type: "ESSAY" } });
    const frozen = { ...question, id: ids.essay, questionText: "Synthetic essay", type: "ESSAY", options: [], stimulusType: "NONE", stimulusMediaId: null, questionTextEmphasis: null };
    return observer.examContentRevision.create({ data: { publishedById: ids.admin, publishedAt: new Date(Date.now() + 1000), questions: { create: [
      { questionId: ids.q, position: 0, content: question as unknown as Prisma.InputJsonValue },
      ...Array.from({ length: essayCount }, (_, i) => ({ questionId: i ? extra : ids.essay, position: i + 1, content: { ...frozen, id: i ? extra : ids.essay } as unknown as Prisma.InputJsonValue })),
    ] } } });
  }
  it.each([0, 2])("historical composition %s fails both new B4 start and existing finalized B7 review without revision rewrite", async count => {
    const invalid = await invalidRevision(count); const before = await observer.examRevisionQuestion.findMany({ where: { revisionId: invalid.id } });
    await expect(start()).rejects.toMatchObject({ statusCode: 409 });
    expect((await observer.entranceExamApplication.findUniqueOrThrow({ where: { id: ids.app } })).actualStartedAt).toBeNull();
    // Test-only historical authority, not an application repair operation.
    const now = new Date(), started = new Date(now.getTime() - 60000);
    await observer.entranceExamApplication.update({ where: { id: ids.app }, data: { status: "TAKEN", actualStartedAt: started, deadlineAt: new Date(started.getTime() + 120 * 60000), contentRevisionId: invalid.id,
      executionConfiguration: { ...config, timezone: "Asia/Manila", passingThresholdUnit: null }, finalizedAt: now, finalizationReason: "APPLICANT_SUBMITTED", finalizationReceiptId: randomUUID(), finalizationAnsweredCount: 0, finalizationQuestionCount: count + 1 } });
    await observer.entranceExamScore.create({ data: { applicationId: ids.app, status: "PENDING", multipleChoiceScore: 0 } });
    await expect(grade()).rejects.toMatchObject({ statusCode: 409 }); expect((await detail())!.essayEvaluation.status).toBe("STAFF_REVIEW");
    expect(await observer.examRevisionQuestion.findMany({ where: { revisionId: invalid.id } })).toEqual(before);
  });
  it("B2 saves arbitrary selection but publishes only exactly one essay, retaining historical revisions", async () => {
    const sets = new ExamQuestionSetRepository(); const historical = await observer.examRevisionQuestion.findMany();
    await sets.replaceSelection({ questionIds: [ids.q] });
    await expect(sets.publish({ questionIds: [ids.q] }, ids.admin)).rejects.toMatchObject({ statusCode: 409 });
    const extra = await observer.examQuestion.create({ data: { questionText: "Second synthetic essay", type: "ESSAY" } });
    await sets.replaceSelection({ questionIds: [ids.essay, extra.id] });
    await expect(sets.publish({ questionIds: [ids.essay, extra.id] }, ids.admin)).rejects.toMatchObject({ statusCode: 409 });
    await sets.replaceSelection({ questionIds: [ids.q, ids.essay] });
    const published = await sets.publish({ questionIds: [ids.q, ids.essay] }, ids.admin);
    expect(published.questionCount).toBe(2);
    expect(await observer.examRevisionQuestion.findMany({ where: { revisionId: ids.revision } })).toEqual(historical.filter(q => q.revisionId === ids.revision));
  });
  it("two real concurrent ADMIN evaluations have one winner and one 409 after InnoDB lock wait", async () => {
    await finalize(); const [first, second] = await contend(() => grade(18, ids.admin), () => grade(20, ids.admin2), "entrance_exam_applications");
    expect(first).toHaveProperty("value.essayScore", 18); expect(second).toHaveProperty("error.statusCode", 409);
    expect(await stored()).toMatchObject({ essayScore: new Prisma.Decimal(18), gradedById: ids.admin, essayEvaluatedAt: expect.any(Date) });
  }, 15000);
  it("same/other ADMIN and changed-score repeats reject, original evidence survives fresh connection", async () => {
    await finalize(); await grade(); const original = await stored();
    for (const [value, adminId] of [[18.25, ids.admin], [18.25, ids.admin2], [20, ids.admin2]] as const) await expect(grade(value, adminId)).rejects.toMatchObject({ statusCode: 409 });
    expect(await workers[1].entranceExamScore.findUniqueOrThrow({ where: { applicationId: ids.app } })).toEqual(original);
  });
  it("failure after real evaluation write rolls back score/evaluator/time together", async () => {
    await finalize(); const original = await stored();
    gateway.$transaction.mockImplementationOnce((fn, options) => workers[0].$transaction(tx => fn(new Proxy(tx, { get(target, property) {
      if (property !== "entranceExamScore") return Reflect.get(target, property);
      return new Proxy(target.entranceExamScore, { get(model, operation) { if (operation !== "update") return Reflect.get(model, operation); return async (args: any) => { await model.update(args); throw new Error("B7 injected after actual evaluation write"); }; } });
    } })), options));
    await expect(grade()).rejects.toThrow("B7 injected"); expect(await stored()).toEqual(original);
  });
  it("TIME_EXPIRED finalization is reviewable; result endpoint and email remain unavailable after evaluation", async () => {
    await finalize("Timeout response", true); expect(await grade()).toMatchObject({ status: "COMPLETED", responseText: "Timeout response" });
    await expect(new ExamService().getExamResult(ids.user)).rejects.toMatchObject({ statusCode: 409 });
    await expect(new ExamService().confirmResultAndEmail(ids.app)).rejects.toMatchObject({ statusCode: 409 });
  });
  it("legacy TAKEN/PASSED records never gain B7 completion evidence or grade actions", async () => {
    for (const id of [ids.legacy, ids.completed, ids.failed]) {
      const before = await observer.entranceExamScore.findUniqueOrThrow({ where: { applicationId: id } });
      await expect(evaluation.gradeEssay(id, 0, ids.admin)).rejects.toMatchObject({ statusCode: 409 });
      expect((await evaluation.getApplicationDetail(id))!.essayEvaluation.status).toBe("LEGACY");
      expect(await observer.entranceExamScore.findUniqueOrThrow({ where: { applicationId: id } })).toEqual(before);
    }
  });
});
