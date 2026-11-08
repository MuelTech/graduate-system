// Opt-in on a separately configured local server/port only. Never the ordinary app DB/server.
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import mysql, { type Connection } from "mysql2/promise";
import { Prisma, PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("../../src/config/database", () => ({ default: null }));
import { FacultyEssayAuthorization, ESSAY_ACTOR_SELECT } from "../../src/access/faculty-essay-authorization";
import { FacultyEssayEvaluationRepository } from "../../src/repositories/faculty-essay-evaluation.repository";
import { isolatedAdministratorDatabaseServer } from "../helpers/isolated-administrator-database";
import { setEssay, setQuestion } from "../fixtures/exam-question-set";

const enabled = process.env.FACULTY_12_DB_TEST === "1" && Boolean(process.env.FACULTY_12_DB_SERVER_URL);
describe.skipIf(!enabled)("FACULTY-12 isolated real MariaDB essay/access contention", () => {
  const schema = `faculty12_test_${randomUUID().replaceAll("-", "")}`;
  const ids = Object.fromEntries(["admin", "first", "second", "program", "student", "applicant", "app", "slot", "mcq", "essay", "revision"].map(key => [key, randomUUID()]));
  let admin: Connection | undefined, observer: PrismaClient | undefined, workers: PrismaClient[] = [];
  let created = false, folder: string | undefined;
  const repositories: FacultyEssayEvaluationRepository[] = [];
  function safeSchema() { if (!/^faculty12_test_[a-f0-9]{32}$/.test(schema)) throw new Error("Unsafe isolated schema."); }
  beforeAll(async () => {
    if (!process.env.DATABASE_URL || !process.env.FACULTY_12_DB_SERVER_URL) throw new Error("Explicit isolated server and application URL required.");
    const url = isolatedAdministratorDatabaseServer(process.env.FACULTY_12_DB_SERVER_URL, process.env.DATABASE_URL);
    url.pathname = "/"; url.search = ""; admin = await mysql.createConnection(url.toString()); safeSchema();
    await admin.query(`CREATE DATABASE \`${schema}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`); created = true;
    await admin.query(`USE \`${schema}\``); url.pathname = `/${schema}`;
    mkdirSync(path.resolve(".tmp"), { recursive: true }); folder = mkdtempSync(path.resolve(".tmp/faculty12-"));
    cpSync(path.resolve("prisma/migrations"), path.join(folder, "migrations"), { recursive: true });
    const config = path.join(folder, "prisma.config.ts");
    writeFileSync(config, `export default ${JSON.stringify({ schema: path.resolve("prisma/schema.prisma"), migrations: { path: path.join(folder, "migrations") }, datasource: { url: url.toString() } })}`);
    execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy", "--config", config], { stdio: "pipe", timeout: 45000 });
    const client = () => new PrismaClient({ adapter: new PrismaMariaDb(url.toString().replace("mysql://", "mariadb://")) });
    observer = client(); workers = [client(), client()]; await Promise.all([observer, ...workers].map(db => db.$connect()));
    for (const db of workers) repositories.push(new FacultyEssayEvaluationRepository(new FacultyEssayAuthorization(true,
      id => db.user.findUnique({ where: { id }, select: ESSAY_ACTOR_SELECT })), db));
    for (const [id, role] of [[ids.admin, "ADMIN"], [ids.first, "FACULTY"], [ids.second, "PANELIST"], [ids.applicant, "APPLICANT"]] as const) {
      await observer.user.create({ data: { id, email: `${id}@example.invalid`, firstName: "Synthetic", lastName: role, role, passwordHash: "unusable-test-only", mustChangePassword: false } });
    }
    for (const userId of [ids.first, ids.second]) await observer.panelist.create({ data: { userId, isAvailableAsAdviser: false } });
    await observer.program.create({ data: { id: ids.program, programName: "Isolated essay fixture", programType: "MASTERS" } });
    await observer.student.create({ data: { id: ids.student, userId: ids.applicant, programId: ids.program, pinnacleApplicantId: "SYNTHETIC", alignmentStatus: "ALIGNED" } });
    await observer.examSlot.create({ data: { id: ids.slot, programId: ids.program, examDate: new Date("2026-11-01"), examTime: new Date("1970-01-01T00:00:00Z"), maxSlots: 1 } });
    const mcq = setQuestion(ids.mcq), essay = setEssay(ids.essay);
    for (const question of [mcq, essay]) await observer.examQuestion.create({ data: {
      id: question.id, questionText: question.questionText, type: question.type,
      options: { create: question.options.map(option => ({ id: option.id, optionText: option.optionText, isCorrect: option.isCorrect, order: option.order, label: option.label })) },
    } });
    await observer.examContentRevision.create({ data: { id: ids.revision, publishedById: ids.admin,
      questions: { create: [mcq, essay].map((content, position) => ({ questionId: content.id, position, content: content as unknown as Prisma.InputJsonValue })) } } });
    await observer.entranceExamApplication.create({ data: { id: ids.app, studentId: ids.student, programId: ids.program, slotId: ids.slot,
      status: "TAKEN", actualStartedAt: new Date("2026-11-01T00:00:00Z"), deadlineAt: new Date("2026-11-01T02:00:00Z"),
      finalizedAt: new Date("2026-11-01T01:00:00Z"), finalizationReason: "APPLICANT_SUBMITTED", finalizationReceiptId: randomUUID(),
      finalizationAnsweredCount: 1, finalizationQuestionCount: 2, contentRevisionId: ids.revision,
      executionConfiguration: { examDurationMinutes: 120, mcqPointsPerCorrectItem: 2, essayMaximumScore: 25.5,
        passingThreshold: 75, passingThresholdUnit: "PERCENT", timezone: "Asia/Manila" },
      score: { create: { status: "PENDING", multipleChoiceScore: 0 } },
      answers: { create: { questionId: ids.essay, essayAnswer: "Exact finalized synthetic response" } },
    } });
  }, 60000);
  beforeEach(async () => {
    await observer!.user.updateMany({ where: { id: { in: [ids.first, ids.second] } }, data: { isActive: true, mustChangePassword: false } });
    await observer!.panelist.updateMany({ data: { isActive: true } });
    await observer!.accountCapabilityGrant.deleteMany();
    await observer!.accountCapabilityGrant.createMany({ data: [ids.first, ids.second].map(userId => ({ userId, capabilityKey: "essay.evaluate", createdById: ids.admin, updatedById: ids.admin })) });
    await observer!.entranceExamApplication.update({ where: { id: ids.app }, data: { status: "TAKEN" } });
    await observer!.entranceExamScore.update({ where: { applicationId: ids.app }, data: { status: "PENDING", multipleChoiceScore: 0,
      essayScore: null, gradedById: null, essayEvaluatedAt: null, totalScore: null, scoredAt: null, scoringBasis: Prisma.DbNull } });
  });
  afterAll(async () => {
    try {
      await Promise.all([observer, ...workers].filter((db): db is PrismaClient => Boolean(db)).map(db => db.$disconnect()));
      if (admin && created) {
        safeSchema(); await admin.query(`DROP DATABASE \`${schema}\``);
        const [remaining] = await admin.query("SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME=?", [schema]); expect(remaining).toHaveLength(0);
      }
    } finally {
      await admin?.end();
      if (folder) {
        const absolute = path.resolve(folder);
        if (path.dirname(absolute) !== path.resolve(".tmp") || !path.basename(absolute).startsWith("faculty12-")) throw new Error("Unsafe isolated cleanup path.");
        rmSync(absolute, { recursive: true, force: true });
      }
    }
  }, 60000);
  async function observeFenceWait() {
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      const [rows] = await admin!.query("SHOW FULL PROCESSLIST");
      const waiter = (rows as any[]).find(row => row.db === schema && typeof row.Info === "string" && /SELECT id FROM administrator_access_lock.*FOR UPDATE/i.test(row.Info));
      if (waiter) { console.log("FACULTY-12 observed real fence waiter connection", waiter.Id); return; }
      await new Promise(resolve => setTimeout(resolve, 25));
    }
    throw new Error("No real waiting grader observed; contention not proven.");
  }
  it.each(["grant", "User", "profile"])("revoking %s while the grader waits prevents commit", async target => {
    await admin!.beginTransaction();
    try {
      await admin!.query("SELECT id FROM administrator_access_lock WHERE id=1 FOR UPDATE");
      if (target === "grant") await admin!.execute("DELETE FROM account_capability_grants WHERE user_id=?", [ids.first]);
      if (target === "User") await admin!.execute("UPDATE users SET is_active=0 WHERE user_id=?", [ids.first]);
      if (target === "profile") await admin!.execute("UPDATE panelists SET is_active=0 WHERE user_id=?", [ids.first]);
      const result = repositories[0].grade(ids.app, 5, ids.first).then(value => ({ value }), error => ({ error }));
      await observeFenceWait(); await admin!.commit();
      expect(await result).toMatchObject({ error: { statusCode: 403 } });
      expect(await observer!.entranceExamScore.findUnique({ where: { applicationId: ids.app } })).toMatchObject({ essayScore: null, gradedById: null, essayEvaluatedAt: null, totalScore: null });
    } catch (error) { await admin!.rollback(); throw error; }
  });
  it("two authorized academic accounts yield one committed evaluation and one conflict", async () => {
    const results = await Promise.allSettled([repositories[0].grade(ids.app, 5, ids.first), repositories[1].grade(ids.app, 7, ids.second)]);
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(results.find(result => result.status === "rejected")).toMatchObject({ reason: { statusCode: 409 } });
    const score = await observer!.entranceExamScore.findUniqueOrThrow({ where: { applicationId: ids.app } });
    const before = { essayScore: score.essayScore!.toString(), grader: score.gradedById, time: score.essayEvaluatedAt!.toISOString() };
    expect([ids.first, ids.second]).toContain(before.grader); expect(score.scoredAt).not.toBeNull();
    await expect(repositories[1].grade(ids.app, 1, ids.second)).rejects.toMatchObject({ statusCode: 409 });
    const after = await observer!.entranceExamScore.findUniqueOrThrow({ where: { applicationId: ids.app } });
    expect({ essayScore: after.essayScore!.toString(), grader: after.gradedById, time: after.essayEvaluatedAt!.toISOString() }).toEqual(before);
  });
  it("a real result-write failure rolls back the actual evaluation and scoring writes", async () => {
    await admin!.query("CREATE TRIGGER faculty12_fail_score BEFORE UPDATE ON entrance_exam_applications FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='synthetic B8 write failure'");
    try {
      await expect(repositories[0].grade(ids.app, 5, ids.first)).rejects.toBeDefined();
      expect(await observer!.entranceExamScore.findUnique({ where: { applicationId: ids.app } })).toMatchObject({ essayScore: null, gradedById: null, essayEvaluatedAt: null, totalScore: null, scoredAt: null });
      expect((await observer!.entranceExamApplication.findUnique({ where: { id: ids.app } }))?.status).toBe("TAKEN");
    } finally { await admin!.query("DROP TRIGGER faculty12_fail_score"); }
  });
});
