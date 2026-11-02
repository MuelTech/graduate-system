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
import { ExamEngineRepository } from "../../src/repositories/exam-engine.repository";
import { manilaCalendarDate } from "../../src/services/exam-schedule-time";
import { EXAM_CONFIGURATION_KEY } from "../../src/services/exam-configuration.rules";
import { setQuestion } from "../fixtures/exam-question-set";

function deferred() { let resolve!: () => void; const promise = new Promise<void>(done => { resolve = done; }); return { resolve, promise }; }
describe.skipIf(process.env.EXAM_B4_DB_TEST !== "1")("B4 real MariaDB execution/migration authority", () => {
  const database = `exam_b4_test_${randomUUID().replaceAll("-", "")}`;
  const migration = "20261103000000_exam_execution_authority";
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
    if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) throw new Error("B4 requires a LOCAL disposable test database.");
    source = await mysql.createConnection(url.toString()); original = await snapshot(source);
    const adminUrl = new URL(url); adminUrl.pathname = "/";
    admin = await mysql.createConnection({ uri: adminUrl.toString(), multipleStatements: true });
    if (!/^exam_b4_test_[0-9a-f]{32}$/.test(database)) throw new Error("Invalid test database identity");
    await admin.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`); created = true;
    await admin.query(`USE \`${database}\``); url.pathname = `/${database}`;
    folder = mkdtempSync(path.join(tmpdir(), "exam-b4-"));
    const migrations = path.join(folder, "migrations");
    for (const item of readdirSync("prisma/migrations")) if (item !== migration) cpSync(path.resolve("prisma/migrations", item), path.join(migrations, item), { recursive: true });
    prismaConfig = path.join(folder, "prisma.config.ts");
    writeFileSync(prismaConfig, `export default ${JSON.stringify({ schema: path.resolve("prisma/schema.prisma"), migrations: { path: migrations }, datasource: { url: url.toString() } })}`);
    migrate(); // Entire committed pre-B4 migration chain on empty isolated database.
    await admin.execute("INSERT INTO programs (program_id, program_name, program_type) VALUES (?, 'B4 synthetic', 'MASTERS')", [ids.program]);
    for (const [id, role] of [[ids.user, "APPLICANT"], [ids.admin, "ADMIN"]]) await admin.execute("INSERT INTO users (user_id,email,password_hash,first_name,last_name,role,updated_at) VALUES (?,?, 'unusable', 'B4', 'Fixture', ?, NOW(3))", [id, `${id}@example.invalid`, role]);
    await admin.execute("INSERT INTO students (student_id,user_id,program_id,pinnacle_applicant_id,alignment_status) VALUES (?,?,?,'B4-SYNTHETIC','ALIGNED')", [ids.student, ids.user, ids.program]);
    await admin.execute("INSERT INTO exam_slots (slot_id,program_id,exam_date,exam_time,max_slots,slots_taken) VALUES (?,?,?,'00:00:00',3,3)", [ids.slot, ids.program, manilaCalendarDate()]);
    for (const [id, status] of [[ids.app, "PENDING"], [ids.legacy, "PENDING"], [ids.completed, "TAKEN"]]) await admin.execute("INSERT INTO entrance_exam_applications (application_id,student_id,program_id,slot_id,exam_date,exam_time,status) VALUES (?,?,?,?,?,'00:00:00',?)", [id, ids.student, ids.program, ids.slot, manilaCalendarDate(), status]);
    await admin.execute("INSERT INTO exam_questions (question_id,question_text,type) VALUES (?, 'Synthetic legacy essay', 'ESSAY')", [ids.essay]);
    await admin.execute("INSERT INTO applicant_answers (answer_id,application_id,question_id,essay_answer) VALUES (?,?,?, 'Preserve legacy evidence')", [randomUUID(), ids.legacy, ids.essay]);
    // Snapshot every preexisting column, including legacy answer and terminal record.
    before = await snapshot(admin);
    cpSync(path.resolve("prisma/migrations", migration), path.join(migrations, migration), { recursive: true });
    const output = migrate(); expect(output).toContain(migration);
    const afterRows = await admin.query(`SELECT actual_started_at, deadline_at, content_revision_id, execution_configuration, start_authorized_by_id, start_authorized_at FROM entrance_exam_applications`);
    expect((afterRows[0] as any[]).every(row => Object.values(row).every(value => value === null))).toBe(true);
    // Compare full pre-B4 rows by projecting only original application columns.
    const [newRows] = await admin.query("SELECT application_id,student_id,program_id,slot_id,exam_date,exam_time,status,created_at FROM entrance_exam_applications ORDER BY application_id");
    const applicationSnapshot = JSON.stringify(newRows);
    expect(applicationSnapshot).toContain(ids.legacy); expect(applicationSnapshot).toContain(ids.completed);
    const [columns] = await admin.query("SHOW COLUMNS FROM entrance_exam_applications");
    const added = ["start_authorized_by_id", "start_authorized_at", "actual_started_at", "deadline_at", "execution_configuration", "content_revision_id"];
    // Projection wrapper recreates the exact original SELECT * for hash comparison.
    const projected = new Proxy(admin, { get(target, property) {
      if (property !== "query") return Reflect.get(target, property);
      return (sql: string) => target.query(sql === "SELECT * FROM `entrance_exam_applications`" ? `SELECT ${(columns as any[]).filter(c => !added.includes(c.Field)).map(c => `\`${c.Field}\``).join(",")} FROM entrance_exam_applications` : sql);
    } });
    expect(await snapshot(projected)).toBe(before);
    const status = execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "status", "--config", prismaConfig], { encoding: "utf8", stdio: "pipe" });
    expect(status).toContain("up to date"); expect(migrate()).toContain("No pending migrations");
    const client = () => new PrismaClient({ adapter: new PrismaMariaDb(url.toString().replace("mysql://", "mariadb://")) });
    observer = client(); workers = [client(), client()]; await Promise.all([observer, ...workers].map(db => db.$connect()));
    const engine = await observer.$queryRaw<any[]>`SELECT VERSION() AS version, @@tx_isolation AS isolation_level`;
    console.log("B4 real MariaDB", JSON.stringify(engine), "full pre-B4 chain + B4 deploy/status/redeploy; old-column SHA-256 preserved", before);
    const [indexes] = await admin.query("SHOW INDEX FROM entrance_exam_applications"); expect((indexes as any[]).map(i => i.Key_name)).toContain("entrance_exam_applications_content_revision_id_idx");
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
        if (!/^exam_b4_test_[0-9a-f]{32}$/.test(database)) throw new Error("Unsafe test cleanup identity");
        await admin.query(`DROP DATABASE \`${database}\``);
        const [remaining] = await admin.query("SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?", [database]); expect(remaining).toHaveLength(0);
        console.log("B4 cleanup: exact disposable database removed, zero synthetic records remain; configured canonical snapshot unchanged", original);
      }
    } finally {
      if (admin) await admin.end(); if (source) await source.end();
      if (folder && path.dirname(folder) === path.resolve(tmpdir()) && path.basename(folder).startsWith("exam-b4-")) rmSync(folder, { recursive: true, force: true });
    }
  }, 20_000);
  beforeEach(async () => {
    gateway.$transaction.mockReset(); gateway.$transaction.mockImplementation((fn, options) => workers[0].$transaction(fn, options));
    await observer.applicantAnswer.deleteMany({ where: { applicationId: ids.app } }); await observer.entranceExamScore.deleteMany({ where: { applicationId: ids.app } });
    await observer.entranceExamApplication.update({ where: { id: ids.app }, data: { status: "PENDING", actualStartedAt: null, deadlineAt: null, contentRevisionId: null, executionConfiguration: Prisma.DbNull, startAuthorizedAt: null, startAuthorizedById: null, examDate: today(), examTime: new Date("1970-01-01T00:00:00Z") } });
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
    expect(observed, "real independent database lock wait required").toBe(true); console.log(`B4 observed ${table} lock wait: ${connections.join(" / ")}`);
    gateway.$transaction.mockImplementation((fn, options) => workers[0].$transaction(fn, options));
    return Promise.all([result1, result2!]);
  }
  it("migration preserves legacy evidence and leaves historical start/config/content unknown", async () => {
    const rows = await observer.entranceExamApplication.findMany({ where: { id: { in: [ids.legacy, ids.completed] } } }); expect(rows).toHaveLength(2);
    for (const row of rows) expect(row).toMatchObject({ actualStartedAt: null, deadlineAt: null, executionConfiguration: null, contentRevisionId: null });
    expect((await repo.read(ids.user, ids.legacy)).state).toBe("LEGACY_UNBOUND"); await expect(repo.start(ids.user, ids.legacy)).rejects.toThrow();
    expect((await repo.read(ids.user, ids.completed)).state).toBe("LEGACY_UNBOUND");
  });
  it("concurrent Starts produce one exact execution and identical immutable binding", async () => {
    const [a, b] = await contend(start, start); expect(a).toHaveProperty("value"); expect(b).toHaveProperty("value"); expect(a.value.actualStartedAt).toBe(b.value.actualStartedAt); expect(a.value.deadlineAt).toBe(b.value.deadlineAt); expect(a.value.contentRevisionId).toBe(b.value.contentRevisionId);
    expect(await observer.entranceExamApplication.count({ where: { id: ids.app, actualStartedAt: { not: null } } })).toBe(1);
  }, 15_000);
  it("Admin authorization winning an early-start race does not start time; waiting Applicant then starts", async () => {
    await earlySlot(); const [auth, started] = await contend(() => repo.authorize(ids.admin, ids.app), start);
    expect(auth.value.actualStartedAt).toBeNull(); expect(started.value.actualStartedAt).toBeTruthy(); expect(started.value.authorization.authorizedAt).toBe(auth.value.authorization.authorizedAt);
  }, 15_000);
  it("early Applicant winning the race safely rejects; subsequent authorization and retry succeed", async () => {
    await earlySlot(); const [rejected, auth] = await contend(start, () => repo.authorize(ids.admin, ids.app)); expect(rejected).toHaveProperty("error.statusCode", 409); expect(auth.value.actualStartedAt).toBeNull(); expect((await start()).state).toBe("ACTIVE");
  }, 15_000);
  it("independent connections and a new process retain actual start/deadline/config/content after changes", async () => {
    const first = await start(); const row = await workers[1].entranceExamApplication.findUniqueOrThrow({ where: { id: ids.app } });
    expect(row.deadlineAt!.getTime() - row.actualStartedAt!.getTime()).toBe(120 * 60_000);
    await observer.systemSetting.update({ where: { settingKey: EXAM_CONFIGURATION_KEY }, data: { settingValue: JSON.stringify({ ...config, examDurationMinutes: 1 }) } });
    const revised = { ...question, questionText: "Future synthetic publication", questionTextEmphasis: null };
    await observer.examContentRevision.create({ data: { publishedById: ids.admin, questions: { create: { questionId: ids.q, position: 0, content: revised as unknown as Prisma.InputJsonValue } } } });
    expect((await new ExamExecutionRepository().start(ids.user, ids.app)).deadlineAt).toBe(first.deadlineAt);
    expect((await repo.questions(ids.user, ids.app))[0].questionText).toBe(question.questionText);
    expect((await observer.entranceExamApplication.findUniqueOrThrow({ where: { id: ids.app } })).executionConfiguration).toMatchObject(config);
    const child = execFileSync(process.execPath, ["-e", `const {PrismaClient}=require('@prisma/client'); const {PrismaMariaDb}=require('@prisma/adapter-mariadb'); const db=new PrismaClient({adapter:new PrismaMariaDb(process.env.B4_TEST_URL)}); db.entranceExamApplication.findUniqueOrThrow({where:{id:process.env.B4_TEST_APP}}).then(r=>console.log(JSON.stringify({start:r.actualStartedAt,deadline:r.deadlineAt,revision:r.contentRevisionId}))).finally(()=>db.$disconnect());`], { encoding: "utf8", env: { ...process.env, B4_TEST_URL: url.toString().replace("mysql://", "mariadb://"), B4_TEST_APP: ids.app } });
    expect(JSON.parse(child.trim())).toEqual({ start: first.actualStartedAt, deadline: first.deadlineAt, revision: first.contentRevisionId });
  });
  it("failure after real binding update rolls back all execution authority", async () => {
    gateway.$transaction.mockImplementation((fn, options) => workers[0].$transaction(tx => fn(new Proxy(tx, { get(target, key) {
      if (key !== "entranceExamApplication") return Reflect.get(target, key);
      return new Proxy(target.entranceExamApplication, { get(model, operation) { if (operation !== "update") return Reflect.get(model, operation); return async (args: any) => { await model.update(args); throw new Error("Injected failure after real execution binding"); }; } });
    } })), options));
    await expect(start()).rejects.toThrow("Injected failure"); expect(await observer.entranceExamApplication.findUniqueOrThrow({ where: { id: ids.app } })).toMatchObject({ actualStartedAt: null, deadlineAt: null, executionConfiguration: null, contentRevisionId: null });
  });
  it("private media follows frozen revision membership even when source attachments are absent", async () => {
    await start(); expect(await repo.media(ids.user, ids.app, ids.media)).toBe(ids.revision); await expect(repo.media(ids.user, ids.app, randomUUID())).rejects.toThrow(); await expect(repo.media(ids.admin, ids.app, ids.media)).rejects.toThrow();
    await observer.entranceExamApplication.update({ where: { id: ids.app }, data: { deadlineAt: new Date(Date.now() - 1) } }); await expect(repo.media(ids.user, ids.app, ids.media)).rejects.toThrow();
  });
  it("B0A competing final submissions retain one terminal result and immutable answers", async () => {
    await start(); const payload = [{ questionId: ids.q, selectedOptionId: question.options[0].id }, { questionId: ids.essay, essayAnswer: "Final answer" }];
    const [winner, loser] = await contend(() => answers.submitAnswers(ids.app, payload), () => answers.submitAnswers(ids.app, payload), "entrance_exam_applications");
    expect(winner).toHaveProperty("value.success", true); expect(loser).toHaveProperty("error.statusCode", 409); expect(await observer.entranceExamScore.count({ where: { applicationId: ids.app } })).toBe(1);
    await expect(answers.autoSaveAnswer(ids.app, ids.essay, "Late overwrite", 0, ids.user)).rejects.toThrow(); expect((await observer.applicantAnswer.findUniqueOrThrow({ where: { applicationId_questionId: { applicationId: ids.app, questionId: ids.essay } } })).essayAnswer).toBe("Final answer");
  }, 15_000);
  it("frozen content/key survive source edits; answer writes reject unrelated members and preserve B0A scoring", async () => {
    await start();
    await observer.examQuestion.update({ where: { id: ids.q }, data: { questionText: "Edited synthetic source" } });
    await observer.examOption.update({ where: { id: question.options[0].id }, data: { isCorrect: false, optionText: "Changed source option" } });
    const received = await repo.questions(ids.user, ids.app); expect(received[0].questionText).toBe(question.questionText);
    await expect(answers.submitAnswers(ids.app, [{ questionId: ids.q, selectedOptionId: randomUUID() }])).rejects.toThrow();
    await expect(answers.autoSaveAnswer(ids.app, randomUUID(), "Unrelated", 0, ids.user)).rejects.toMatchObject({ statusCode: 400 });
    expect(await answers.submitAnswers(ids.app, [{ questionId: ids.q, selectedOptionId: question.options[0].id }])).toMatchObject({ mcqScore: 1 });
  });
  it("runs the five existing B0A real-DB regressions with authoritative synthetic B4 bindings", () => {
    const output = execFileSync(process.execPath, ["node_modules/vitest/vitest.mjs", "run", "tests/integration/exam-answer-contention.test.ts", "--reporter=verbose"], { encoding: "utf8", stdio: "pipe", env: { ...process.env, DATABASE_URL: url.toString(), EXAM_B0A_DB_TEST: "1" } });
    expect(output).toMatch(/5 passed/); console.log("B4 nested B0A real-DB regression: 5 passed, fixtures cleaned inside disposable database.");
  }, 30_000);
  it("runs the four existing B2 migration/integrity regressions in their own disposable database", () => {
    const output = execFileSync(process.execPath, ["node_modules/vitest/vitest.mjs", "run", "tests/integration/exam-question-set.test.ts", "--reporter=verbose"], { encoding: "utf8", stdio: "pipe", env: { ...process.env, DATABASE_URL: url.toString(), EXAM_B2_DB_TEST: "1" } });
    expect(output).toMatch(/4 passed/); console.log("B4 nested B2 migration/integrity regression: 4 passed, separate disposable database removed.");
  }, 60_000);
});
