// Opt-in LOCAL disposable database. Actual committed migration chain; never db push.
import { randomUUID, createHash } from "node:crypto";
import {
  readFileSync,
  mkdtempSync,
  writeFileSync,
  readdirSync,
  cpSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import mysql, { type Connection } from "mysql2/promise";
import { parse } from "dotenv";
import { PrismaClient, Prisma } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
const gateway = vi.hoisted(() => ({
  $transaction: vi.fn(),
  systemSetting: { findUnique: vi.fn(), upsert: vi.fn() },
  student: { findMany: vi.fn(), count: vi.fn(), findUnique: vi.fn() },
  examResultDecision: { findMany: vi.fn() },
  entranceExamApplication: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
  },
  examQuestion: { count: vi.fn() },
}));
vi.mock("../../src/config/database", () => ({ default: gateway }));
vi.mock("../../src/services/email.service", () => ({
  EmailService: { sendTemplateEmail: vi.fn() },
}));
import { ExamAmendmentRepository } from "../../src/repositories/exam-amendment.repository";
import { CorRepository } from "../../src/repositories/cor.repository";
import { AdminApplicantRepository } from "../../src/repositories/admin-applicant.repository";
import {
  hasAuthoritativePassedExam,
  deriveAdmissionStage,
} from "../../src/services/admin-applicant-list.rules";
import { ExamRepository } from "../../src/repositories/exam.repository";
import { ExamService } from "../../src/services/exam.service";
import { ApplicantService } from "../../src/services/applicant.service";
import { ExamExecutionRepository } from "../../src/repositories/exam-execution.repository";
import { ExamFinalizationRepository } from "../../src/repositories/exam-finalization.repository";
import { ExamEngineRepository } from "../../src/repositories/exam-engine.repository";
import { manilaCalendarDate } from "../../src/services/exam-schedule-time";
import { ExamConfigurationService } from "../../src/services/exam-configuration.service";
import { EXAM_CONFIGURATION_KEY } from "../../src/services/exam-configuration.rules";
import { setQuestion } from "../fixtures/exam-question-set";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { resolve, promise };
}
describe.skipIf(process.env.EXAM_B9_DB_TEST !== "1")(
  "B9 real MariaDB execution/migration authority",
  () => {
    const database = `exam_b9_test_${randomUUID().replaceAll("-", "")}`;
    const migration = "20261105010000_exam_amendments_reconsideration";
    const ids = Object.fromEntries(
      [
        "user",
        "admin",
        "admin2",
        "student",
        "program",
        "slot",
        "app",
        "clean",
        "legacy",
        "completed",
        "failed",
        "q",
        "essay",
        "revision",
        "preRevision",
        "media",
        "historyUser",
        "historyStudent",
        "otherUser",
        "otherStudent",
        "otherApp",
        "targetA",
        "targetB",
        "prePassed",
        "preFailed",
      ].map((key) => [key, randomUUID()]),
    );
    const repo = new ExamExecutionRepository(),
      answers = new ExamEngineRepository();
    const config = {
      examDurationMinutes: 120,
      mcqPointsPerCorrectItem: 2,
      essayMaximumScore: 25.5,
      passingThreshold: 75,
    };

    const tables = [
      "exam_questions",
      "exam_options",
      "exam_media",
      "exam_content_imports",
      "applicant_answers",
      "exam_slots",
      "entrance_exam_applications",
      "exam_content_revisions",
      "exam_revision_questions",
      "exam_revision_options",
      "exam_revision_media",
      "exam_question_selection",
      "entrance_exam_scores",
      "system_settings",
    ];
    let source: Connection,
      admin: Connection,
      observer: PrismaClient,
      workers: PrismaClient[] = [];
    let original: string,
      before: string,
      created = false,
      folder: string,
      prismaConfig: string,
      url: URL;
    let question: ReturnType<typeof setQuestion>;
    const today = () => new Date(`${manilaCalendarDate()}T00:00:00Z`);
    async function snapshot(connection: Connection, selected = tables) {
      const data = await Promise.all(
        selected.map(async (table) => {
          const [rows] = await connection.query(`SELECT * FROM \`${table}\``);
          return JSON.parse(JSON.stringify(rows)).sort(
            (a: unknown, b: unknown) =>
              JSON.stringify(a).localeCompare(JSON.stringify(b)),
          );
        }),
      );
      return createHash("sha256").update(JSON.stringify(data)).digest("hex");
    }
    function migrate() {
      return execFileSync(
        process.execPath,
        [
          "node_modules/prisma/build/index.js",
          "migrate",
          "deploy",
          "--config",
          prismaConfig,
        ],
        { encoding: "utf8", stdio: "pipe" },
      );
    }
    beforeAll(async () => {
      const env = parse(readFileSync(".env"));
      url = new URL(process.env.DATABASE_URL || env.DATABASE_URL);
      if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
        throw new Error("B9 requires a LOCAL disposable test database.");
      source = await mysql.createConnection(url.toString());
      original = await snapshot(source);
      const adminUrl = new URL(url);
      adminUrl.pathname = "/";
      admin = await mysql.createConnection({
        uri: adminUrl.toString(),
        multipleStatements: true,
      });
      if (!/^exam_b9_test_[0-9a-f]{32}$/.test(database))
        throw new Error("Invalid test database identity");
      await admin.query(
        `CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
      );
      created = true;
      await admin.query(`USE \`${database}\``);
      url.pathname = `/${database}`;
      folder = mkdtempSync(path.join(tmpdir(), "exam-b9-"));
      const migrations = path.join(folder, "migrations");
      for (const item of readdirSync("prisma/migrations"))
        if (item < migration || item === "migration_lock.toml")
          cpSync(
            path.resolve("prisma/migrations", item),
            path.join(migrations, item),
            { recursive: true },
          );
      prismaConfig = path.join(folder, "prisma.config.ts");
      writeFileSync(
        prismaConfig,
        `export default ${JSON.stringify({ schema: path.resolve("prisma/schema.prisma"), migrations: { path: migrations }, datasource: { url: url.toString() } })}`,
      );
      migrate(); // Entire committed pre-B9 migration chain on empty isolated database.
      await admin.execute(
        "INSERT INTO programs (program_id, program_name, program_type) VALUES (?, 'B9 synthetic', 'MASTERS')",
        [ids.program],
      );
      for (const [id, role] of [
        [ids.user, "APPLICANT"],
        [ids.admin, "ADMIN"],
        [ids.admin2, "ADMIN"],
        [ids.historyUser, "APPLICANT"],
        [ids.otherUser, "APPLICANT"],
      ])
        await admin.execute(
          "INSERT INTO users (user_id,email,password_hash,first_name,last_name,role,updated_at) VALUES (?,?, 'unusable', 'B9', 'Fixture', ?, NOW(3))",
          [id, `${id}@example.invalid`, role],
        );
      await admin.execute(
        "INSERT INTO students (student_id,user_id,program_id,pinnacle_applicant_id,alignment_status) VALUES (?,?,?,'B9-SYNTHETIC','ALIGNED')",
        [ids.student, ids.user, ids.program],
      );
      for (const [id, userId, pin] of [
        [ids.historyStudent, ids.historyUser, "B9-HISTORY"],
        [ids.otherStudent, ids.otherUser, "B9-OTHER"],
      ])
        await admin.execute(
          "INSERT INTO students (student_id,user_id,program_id,pinnacle_applicant_id,alignment_status) VALUES (?,?,?,?,'ALIGNED')",
          [id, userId, ids.program, pin],
        );
      await admin.execute(
        "INSERT INTO exam_slots (slot_id,program_id,exam_date,exam_time,max_slots,slots_taken) VALUES (?,?,?,'00:00:00',5,5)",
        [ids.slot, ids.program, manilaCalendarDate()],
      );
      for (const [id, status] of [
        [ids.app, "TAKEN"],
        [ids.clean, "PENDING"],
        [ids.legacy, "TAKEN"],
        [ids.completed, "PASSED"],
        [ids.failed, "FAILED"],
      ])
        await admin.execute(
          "INSERT INTO entrance_exam_applications (application_id,student_id,program_id,slot_id,exam_date,exam_time,status) VALUES (?,?,?,?,?,'00:00:00',?)",
          [
            id,
            id === ids.app ? ids.student : ids.historyStudent,
            ids.program,
            ids.slot,
            manilaCalendarDate(),
            status,
          ],
        );
      await admin.execute(
        "INSERT INTO exam_questions (question_id,question_text,type) VALUES (?, 'Synthetic legacy essay', 'ESSAY')",
        [ids.essay],
      );
      await admin.execute(
        "INSERT INTO applicant_answers (answer_id,application_id,question_id,essay_answer,draft_revision) VALUES (?,?,?, 'Preserve legacy evidence',3)",
        [randomUUID(), ids.legacy, ids.essay],
      );
      await admin.execute(
        "INSERT INTO exam_content_revisions (id,published_by_id) VALUES (?,?)",
        [ids.preRevision, ids.admin],
      );
      const preContent = {
        ...setQuestion(ids.essay),
        type: "ESSAY",
        options: [],
      };
      await admin.execute(
        "INSERT INTO exam_revision_questions (revision_id,question_id,position,content) VALUES (?,?,0,?)",
        [ids.preRevision, ids.essay, JSON.stringify(preContent)],
      );
      await admin.execute(
        "UPDATE entrance_exam_applications SET actual_started_at=DATE_SUB(NOW(3), INTERVAL 60 MINUTE), deadline_at=DATE_ADD(NOW(3), INTERVAL 60 MINUTE), execution_configuration=?, content_revision_id=? WHERE application_id=?",
        [
          JSON.stringify({
            ...config,
            passingThreshold: null,
            timezone: "Asia/Manila",
            passingThresholdUnit: null,
          }),
          ids.preRevision,
          ids.app,
        ],
      );
      await admin.execute(
        "INSERT INTO entrance_exam_scores (score_id,application_id,status,multiple_choice_score) VALUES (?,?,'PENDING',0)",
        [randomUUID(), ids.completed],
      );
      await admin.execute(
        "UPDATE entrance_exam_applications SET finalized_at=DATE_ADD(actual_started_at, INTERVAL 10 MINUTE),finalization_reason='APPLICANT_SUBMITTED',finalization_receipt_id=?,finalization_answered_count=0,finalization_question_count=1 WHERE application_id=?",
        [randomUUID(), ids.app],
      );
      await admin.execute(
        "INSERT INTO entrance_exam_scores (score_id,application_id,status,multiple_choice_score) VALUES (?,?,'PENDING',0)",
        [randomUUID(), ids.app],
      );
      await admin.execute(
        "INSERT INTO entrance_exam_scores (score_id,application_id,status,multiple_choice_score) VALUES (?,?,'PENDING',0)",
        [randomUUID(), ids.legacy],
      );
      await admin.execute(
        "UPDATE entrance_exam_scores SET status='PASSED',essay_score=18.25,total_score=80,graded_by=? WHERE application_id=?",
        [ids.admin, ids.completed],
      );
      await admin.execute(
        "INSERT INTO entrance_exam_scores (score_id,application_id,status,multiple_choice_score,essay_score,total_score,graded_by) VALUES (?,?,'FAILED',1,0,1,?)",
        [randomUUID(), ids.failed, ids.admin2],
      );
      // Snapshot every original column: B6 evidence, B5 answers and legacy grades.
      await admin.execute(
        "UPDATE entrance_exam_applications SET created_at='2020-01-01' WHERE application_id IN (?,?,?)",
        [ids.legacy, ids.completed, ids.failed],
      );
      await admin.execute(
        "UPDATE entrance_exam_applications SET status='TAKEN',actual_started_at=DATE_SUB(NOW(3),INTERVAL 60 MINUTE),deadline_at=DATE_ADD(NOW(3),INTERVAL 60 MINUTE),execution_configuration=?,content_revision_id=?,finalized_at=DATE_SUB(NOW(3),INTERVAL 50 MINUTE),finalization_reason='APPLICANT_SUBMITTED',finalization_receipt_id=?,finalization_answered_count=0,finalization_question_count=1 WHERE application_id=?",
        [
          JSON.stringify({
            ...config,
            passingThreshold: null,
            timezone: "Asia/Manila",
            passingThresholdUnit: null,
          }),
          ids.preRevision,
          randomUUID(),
          ids.clean,
        ],
      );
      await admin.execute(
        "INSERT INTO entrance_exam_scores (score_id,application_id,status,multiple_choice_score,essay_score,graded_by,essay_evaluated_at) VALUES (?,?,'PENDING',0,12.25,?,DATE_SUB(NOW(3),INTERVAL 40 MINUTE))",
        [randomUUID(), ids.clean, ids.admin],
      );
      await admin.execute(
        "UPDATE exam_content_revisions SET published_at='2020-01-01' WHERE id=?",
        [ids.preRevision],
      );
      await admin.execute(
        "UPDATE entrance_exam_applications SET created_at='2020-01-01' WHERE application_id=?",
        [ids.clean],
      );
      await admin.execute(
        "INSERT INTO system_settings (setting_id,setting_key,setting_value,setting_type,updated_at) VALUES (?,?,?,'JSON',NOW(3))",
        [
          randomUUID(),
          EXAM_CONFIGURATION_KEY,
          JSON.stringify({ ...config, passingThreshold: null }),
        ],
      );
      for (const [id, result, essay] of [
        [ids.prePassed, "PASSED", 25.5],
        [ids.preFailed, "FAILED", 0],
      ] as const) {
        const receipt = randomUUID(),
          scoreId = randomUUID(),
          started = new Date(Date.now() - 3600000),
          finalized = new Date(Date.now() - 3000000),
          evaluated = new Date(Date.now() - 2400000),
          scored = new Date(Date.now() - 1800000);
        const basis = {
          version: 1,
          applicationId: id,
          contentRevisionId: ids.preRevision,
          finalizationReceiptId: receipt,
          mcqQuestionCount: 0,
          mcqCorrectCount: 0,
          mcqPointsPerCorrectItem: "2",
          mcqEarnedPoints: "0",
          mcqMaximumPoints: "0",
          essayScore: String(essay),
          essayMaximum: "25.5",
          finalEarnedPoints: String(essay),
          maximumPossiblePoints: "25.5",
          passingThreshold: "75",
          passingThresholdUnit: "PERCENT",
          result,
        };
        await admin.execute(
          "INSERT INTO entrance_exam_applications (application_id,student_id,program_id,slot_id,exam_date,exam_time,status,actual_started_at,deadline_at,execution_configuration,content_revision_id,finalized_at,finalization_reason,finalization_receipt_id,finalization_answered_count,finalization_question_count,created_at) VALUES (?,?,?,?,?,'00:00:00',?,?,?,?,?,?,'APPLICANT_SUBMITTED',?,0,1,'2020-01-01')",
          [
            id,
            ids.historyStudent,
            ids.program,
            ids.slot,
            manilaCalendarDate(),
            result,
            started,
            new Date(started.getTime() + 7200000),
            JSON.stringify({
              ...config,
              timezone: "Asia/Manila",
              passingThresholdUnit: "PERCENT",
            }),
            ids.preRevision,
            finalized,
            receipt,
          ],
        );
        await admin.execute(
          "INSERT INTO entrance_exam_scores (score_id,application_id,status,multiple_choice_score,essay_score,total_score,graded_by,essay_evaluated_at,scored_at,scoring_basis) VALUES (?,?,?,0,?,?,?,?,?,?)",
          [
            scoreId,
            id,
            result,
            essay,
            essay,
            ids.admin,
            evaluated,
            scored,
            JSON.stringify(basis),
          ],
        );
      }
      await admin.execute(
        "UPDATE exam_slots SET slots_taken=7,max_slots=7 WHERE slot_id=?",
        [ids.slot],
      );
      for (const [status, offset] of [
        ["PENDING", 2],
        ["PENDING", -1],
        ["APPEALED", -1],
      ] as const) {
        const slotId = randomUUID(),
          appId = randomUUID(),
          date = new Date(`${manilaCalendarDate()}T00:00:00Z`);
        date.setUTCDate(date.getUTCDate() + offset);
        await admin.execute(
          "INSERT INTO exam_slots (slot_id,program_id,exam_date,exam_time,max_slots,slots_taken) VALUES (?,?,?,'09:00:00',1,1)",
          [slotId, ids.program, date.toISOString().slice(0, 10)],
        );
        await admin.execute(
          "INSERT INTO entrance_exam_applications (application_id,student_id,program_id,slot_id,exam_date,exam_time,status) VALUES (?,?,?,?,?,'09:00:00',?)",
          [
            appId,
            ids.historyStudent,
            ids.program,
            slotId,
            date.toISOString().slice(0, 10),
            status,
          ],
        );
      }
      before = await snapshot(admin);
      const foreignKeySql =
        "SELECT CONSTRAINT_NAME,COLUMN_NAME,REFERENCED_TABLE_NAME,REFERENCED_COLUMN_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('entrance_exam_applications','applicant_answers','entrance_exam_scores') AND REFERENCED_TABLE_NAME IS NOT NULL ORDER BY TABLE_NAME,CONSTRAINT_NAME,ORDINAL_POSITION";
      const [foreignKeysBefore] = await admin.query(foreignKeySql);
      for (const item of readdirSync("prisma/migrations"))
        if (item === migration)
          cpSync(
            path.resolve("prisma/migrations", item),
            path.join(migrations, item),
            { recursive: true },
          );
      const output = migrate();
      expect(output).toContain(migration);
      const [columns] = await admin.query(
        "SHOW COLUMNS FROM entrance_exam_applications",
      );
      expect(
        (columns as any[]).find((c) => c.Field === "seat_released_at").Null,
      ).toBe("YES");
      expect(
        (
          (
            await admin.query(
              "SELECT seat_released_at FROM entrance_exam_applications",
            )
          )[0] as any[]
        ).every((row) => row.seat_released_at === null),
      ).toBe(true);
      for (const table of ["exam_schedule_amendments", "exam_result_decisions"])
        expect((await admin.query(`SELECT * FROM ${table}`))[0]).toEqual([]);
      expect((await admin.query(foreignKeySql))[0]).toEqual(foreignKeysBefore);
      const projected = new Proxy(admin, {
        get(target, property) {
          if (property !== "query") return Reflect.get(target, property);
          return (sql: string) =>
            target.query(
              sql === "SELECT * FROM `entrance_exam_applications`"
                ? `SELECT ${(columns as any[])
                    .filter((c) => c.Field !== "seat_released_at")
                    .map((c) => `\`${c.Field}\``)
                    .join(",")} FROM entrance_exam_applications`
                : sql,
            );
        },
      });
      expect(await snapshot(projected)).toBe(before);
      const [historicalConfig] = await admin.execute(
        "SELECT setting_value FROM system_settings WHERE setting_key=?",
        [EXAM_CONFIGURATION_KEY],
      );
      expect(
        JSON.parse((historicalConfig as any[])[0].setting_value)
          .passingThreshold,
      ).toBeNull();
      // Rehearse B9 original columns before installing successor migrations.
      for (const item of readdirSync("prisma/migrations"))
        if (item > migration && item !== "migration_lock.toml")
          cpSync(
            path.resolve("prisma/migrations", item),
            path.join(migrations, item),
            { recursive: true },
          );
      migrate();
      const status = execFileSync(
        process.execPath,
        [
          "node_modules/prisma/build/index.js",
          "migrate",
          "status",
          "--config",
          prismaConfig,
        ],
        { encoding: "utf8", stdio: "pipe" },
      );
      expect(status).toContain("up to date");
      expect(migrate()).toContain("No pending migrations");
      const client = () =>
        new PrismaClient({
          adapter: new PrismaMariaDb(
            url.toString().replace("mysql://", "mariadb://"),
          ),
        });
      observer = client();
      workers = [client(), client()];
      await Promise.all([observer, ...workers].map((db) => db.$connect()));
      const engine = await observer.$queryRaw<
        any[]
      >`SELECT VERSION() AS version, @@tx_isolation AS isolation_level`;
      console.log(
        "B9 real MariaDB",
        JSON.stringify(engine),
        "full pre-B9 chain + B9 deploy/status/redeploy; old-column SHA-256 preserved",
        before,
      );

      question = setQuestion(ids.q);
      question.stimulusType = "IMAGE";
      question.stimulusMediaId = ids.media;
      await observer.examMedia.create({
        data: {
          id: ids.media,
          storageKey: `${database}/synthetic`,
          storageProvider: "local",
          verifiedMimeType: "image/png",
          sizeBytes: 1,
          checksum: "a".repeat(64),
        },
      });
      await observer.examQuestion.create({
        data: {
          id: ids.q,
          questionText: question.questionText,
          options: {
            create: question.options.map((o) => ({
              id: o.id,
              optionText: o.optionText,
              isCorrect: o.isCorrect,
              label: o.label,
              order: o.order,
            })),
          },
        },
      });
      await observer.examContentRevision.create({
        data: {
          id: ids.revision,
          publishedAt: new Date("2026-01-01T00:00:00Z"),
          publishedById: ids.admin,
          questions: {
            create: [
              {
                questionId: ids.q,
                position: 0,
                content: question as unknown as Prisma.InputJsonValue,
                options: {
                  create: question.options.map((o) => ({ optionId: o.id })),
                },
              },
              {
                questionId: ids.essay,
                position: 1,
                content: {
                  ...question,
                  id: ids.essay,
                  questionText: "Synthetic essay",
                  type: "ESSAY",
                  options: [],
                  stimulusType: "NONE",
                  stimulusMediaId: null,
                  questionTextEmphasis: null,
                } as unknown as Prisma.InputJsonValue,
              },
            ],
          },
          media: { create: { mediaId: ids.media } },
        },
      });
      const future = today();
      future.setUTCDate(future.getUTCDate() + 2);
      for (const id of [ids.targetA, ids.targetB])
        await observer.examSlot.create({
          data: {
            id,
            programId: ids.program,
            examDate: future,
            examTime: new Date("1970-01-01T09:00:00Z"),
            maxSlots: 1,
          },
        });
    }, 60_000);
    afterAll(async () => {
      try {
        if (source && original)
          expect(
            await snapshot(source),
            "configured canonical data must remain untouched",
          ).toBe(original);
        await Promise.all(
          [observer, ...workers].filter(Boolean).map((db) => db.$disconnect()),
        );
        if (admin && created) {
          if (!/^exam_b9_test_[0-9a-f]{32}$/.test(database))
            throw new Error("Unsafe test cleanup identity");
          await admin.query(`DROP DATABASE \`${database}\``);
          const [remaining] = await admin.query(
            "SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?",
            [database],
          );
          expect(remaining).toHaveLength(0);
          console.log(
            "B9 cleanup: exact disposable database removed, zero synthetic records remain; configured canonical snapshot unchanged",
            original,
          );
        }
      } finally {
        if (admin) await admin.end();
        if (source) await source.end();
        if (
          folder &&
          path.dirname(folder) === path.resolve(tmpdir()) &&
          path.basename(folder).startsWith("exam-b9-")
        )
          rmSync(folder, { recursive: true, force: true });
      }
    }, 20_000);
    beforeEach(async () => {
      await observer.corRecord.deleteMany({
        where: { studentId: ids.student },
      });
      await observer.corUpload.deleteMany({
        where: { studentId: ids.student },
      });
      await observer.user.update({
        where: { id: ids.user },
        data: {
          role: "APPLICANT",
          isActive: true,
          firstName: "B9",
          lastName: "Fixture",
        },
      });
      await observer.student.update({
        where: { id: ids.student },
        data: {
          admissionStatus: "APPLICANT",
          studentNumber: null,
          enrollmentDate: null,
        },
      });
      const targetDate = today();
      targetDate.setUTCDate(targetDate.getUTCDate() + 2);

      gateway.student.findMany.mockImplementation((args) =>
        observer.student.findMany(args),
      );
      gateway.student.findUnique.mockImplementation((args) =>
        observer.student.findUnique(args),
      );
      gateway.student.count.mockImplementation((args) =>
        observer.student.count(args),
      );
      gateway.examResultDecision.findMany.mockImplementation((args) =>
        observer.examResultDecision.findMany(args),
      );
      await observer.examScheduleAmendment.deleteMany({});
      await observer.examResultDecision.deleteMany({});
      await observer.applicantAnswer.deleteMany({
        where: {
          application: { studentId: { in: [ids.student, ids.otherStudent] } },
        },
      });
      await observer.entranceExamScore.deleteMany({
        where: {
          application: { studentId: { in: [ids.student, ids.otherStudent] } },
        },
      });
      await observer.entranceExamApplication.deleteMany({
        where: {
          studentId: { in: [ids.student, ids.otherStudent] },
          id: { not: ids.app },
        },
      });
      await observer.examSlot.updateMany({
        where: { id: { in: [ids.targetA, ids.targetB] } },
        data: {
          slotsTaken: 0,
          maxSlots: 1,
          isActive: true,
          programId: ids.program,
          examDate: targetDate,
          examTime: new Date("1970-01-01T09:00:00Z"),
        },
      });
      await observer.examSlot.update({
        where: { id: ids.slot },
        data: { slotsTaken: 7, maxSlots: 7 },
      });

      gateway.systemSetting.findUnique.mockImplementation((args) =>
        observer.systemSetting.findUnique(args),
      );
      gateway.systemSetting.upsert.mockImplementation((args) =>
        observer.systemSetting.upsert(args),
      );
      gateway.entranceExamApplication.findMany.mockImplementation((args) =>
        observer.entranceExamApplication.findMany(args),
      );
      gateway.entranceExamApplication.findFirst.mockImplementation((args) =>
        observer.entranceExamApplication.findFirst(args),
      );
      gateway.entranceExamApplication.findUnique.mockImplementation((args) =>
        observer.entranceExamApplication.findUnique(args),
      );
      gateway.examQuestion.count.mockImplementation((args) =>
        observer.examQuestion.count(args),
      );
      await observer.examOption.updateMany({
        where: { questionId: ids.q },
        data: { isCorrect: false },
      });
      await observer.examOption.update({
        where: { id: question.options.find((o) => o.isCorrect)!.id },
        data: { isCorrect: true },
      });
      await observer.examQuestionSelection.deleteMany({});
      gateway.$transaction.mockReset();
      gateway.$transaction.mockImplementation((fn, options) =>
        workers[0].$transaction(fn, options),
      );
      await observer.applicantAnswer.deleteMany({
        where: { applicationId: ids.app },
      });
      await observer.entranceExamScore.deleteMany({
        where: { applicationId: ids.app },
      });
      await observer.entranceExamApplication.update({
        where: { id: ids.app },
        data: {
          status: "PENDING",
          seatReleasedAt: null,
          createdAt: new Date(),
          finalizedAt: null,
          finalizationReason: null,
          finalizationReceiptId: null,
          finalizationAnsweredCount: null,
          finalizationQuestionCount: null,
          actualStartedAt: null,
          deadlineAt: null,
          contentRevisionId: null,
          executionConfiguration: Prisma.DbNull,
          startAuthorizedAt: null,
          startAuthorizedById: null,
          examDate: today(),
          examTime: new Date("1970-01-01T00:00:00Z"),
        },
      });
      await observer.examSlot.update({
        where: { id: ids.slot },
        data: { examDate: today(), examTime: new Date("1970-01-01T00:00:00Z") },
      });
      await observer.systemSetting.upsert({
        where: { settingKey: EXAM_CONFIGURATION_KEY },
        create: {
          settingKey: EXAM_CONFIGURATION_KEY,
          settingType: "JSON",
          settingValue: JSON.stringify(config),
        },
        update: { settingValue: JSON.stringify(config) },
      });
      await observer.program.update({
        where: { id: ids.program },
        data: { examEssayTotal: 30 },
      });
      await observer.examQuestion.update({
        where: { id: ids.essay },
        data: { questionText: "Synthetic legacy essay" },
      });
      // Test-only cleanup of synthetic future publications, respecting B2 RESTRICT.
      await observer.examRevisionOption.deleteMany({
        where: { revisionId: { notIn: [ids.revision, ids.preRevision] } },
      });
      await observer.examRevisionQuestion.deleteMany({
        where: { revisionId: { notIn: [ids.revision, ids.preRevision] } },
      });
      await observer.examRevisionMedia.deleteMany({
        where: { revisionId: { notIn: [ids.revision, ids.preRevision] } },
      });
      await observer.examContentRevision.deleteMany({
        where: { id: { notIn: [ids.revision, ids.preRevision] } },
      });
    });
    async function contend(
      first: () => Promise<unknown>,
      second: () => Promise<unknown>,
      table = "students",
      whileBlocked?: () => void,
      lockId?: string,
    ) {
      const acquired = deferred(),
        attempted = deferred(),
        release = deferred();
      let invocation = 0,
        secondAcquired = false,
        observed = false;
      const connections: number[] = [];
      gateway.$transaction.mockImplementation((fn, options) => {
        const index = invocation++;
        return workers[index].$transaction(
          async (tx) => {
            const [connection] = await tx.$queryRaw<
              { id: bigint }[]
            >`SELECT CONNECTION_ID() AS id`;
            connections[index] = Number(connection.id);
            await tx.entranceExamApplication.count(); // Expose accidental stale REPEATABLE READ snapshot authorization.
            return fn(
              new Proxy(tx, {
                get(target, property) {
                  if (property !== "$queryRaw")
                    return Reflect.get(target, property);
                  return async (...args: Parameters<typeof tx.$queryRaw>) => {
                    const matching =
                      String(args[0]).includes(`FROM ${table}`) &&
                      (!lockId || args.slice(1).includes(lockId));
                    if (matching && index === 1) attempted.resolve();
                    const result = await target.$queryRaw(...args);
                    if (matching && index === 0) {
                      acquired.resolve();
                      await release.promise;
                    }
                    if (matching && index === 1) secondAcquired = true;
                    return result;
                  };
                },
              }),
            );
          },
          { ...options, timeout: 12_000 },
        );
      });
      const result1 = first().then(
        (value) => ({ value }),
        (error) => ({ error }),
      );
      let result2: Promise<any> | undefined;
      try {
        await Promise.race([
          acquired.promise,
          delay(4000).then(() => {
            throw new Error("First lock not acquired");
          }),
        ]);
        result2 = second().then(
          (value) => ({ value }),
          (error) => ({ error }),
        );
        await Promise.race([
          attempted.promise,
          delay(4000).then(() => {
            throw new Error("Second lock not attempted");
          }),
        ]);
        expect(connections[0]).not.toBe(connections[1]);
        for (let step = 0; step < 60; step++) {
          const rows = await observer.$queryRaw<
            { Id: bigint; Info: string | null }[]
          >`SHOW FULL PROCESSLIST`;
          if (
            rows.some(
              (row) =>
                Number(row.Id) === connections[1] &&
                row.Info?.includes(`FROM ${table}`) &&
                row.Info.includes("FOR UPDATE"),
            ) &&
            !secondAcquired
          ) {
            await delay(100);
            expect(secondAcquired).toBe(false);
            observed = true;
            break;
          }
          await delay(40);
        }
        if (observed) whileBlocked?.();
      } finally {
        release.resolve();
        await result1;
        if (result2) await result2;
      }
      expect(observed, "real independent database lock wait required").toBe(
        true,
      );
      console.log(`B9 observed ${table} lock wait: ${connections.join(" / ")}`);
      gateway.$transaction.mockImplementation((fn, options) =>
        workers[0].$transaction(fn, options),
      );
      return Promise.all([result1, result2!]);
    }
    const start = () => repo.start(ids.user, ids.app);
    const finalizer = new ExamFinalizationRepository();
    const evaluation = new ExamRepository();
    const grade = (value = 18.25, adminId = ids.admin) =>
      evaluation.gradeEssay(ids.app, value, adminId);
    const detail = () => evaluation.getApplicationDetail(ids.app);
    const stored = () =>
      observer.entranceExamScore.findUniqueOrThrow({
        where: { applicationId: ids.app },
      });
    const reconcile = () => evaluation.finalizeResult(ids.app, ids.admin);
    async function scenario(
      options: {
        points?: number;
        maximum?: number;
        threshold?: number;
        choice?: "correct" | "wrong" | "missing" | "clear";
        essay?: number;
      } = {},
    ) {
      await observer.systemSetting.update({
        where: { settingKey: EXAM_CONFIGURATION_KEY },
        data: {
          settingValue: JSON.stringify({
            ...config,
            mcqPointsPerCorrectItem: options.points ?? 2,
            essayMaximumScore: options.maximum ?? 25.5,
            passingThreshold: options.threshold ?? 75,
          }),
        },
      });
      await start();
      if (options.choice && options.choice !== "missing")
        await answers.saveDraft(
          ids.app,
          {
            questionId: ids.q,
            selectedOptionId:
              options.choice === "clear"
                ? null
                : question.options.find(
                    (o) => o.isCorrect === (options.choice === "correct"),
                  )!.id,
            expectedRevision: 0,
          },
          ids.user,
        );
      await answers.saveDraft(
        ids.app,
        {
          questionId: ids.essay,
          essayAnswer: "Exact B9 response",
          expectedRevision: 0,
        },
        ids.user,
      );
      await finalizer.submit(
        ids.app,
        { acknowledgeIncomplete: true },
        ids.user,
      );
      if (options.essay !== undefined)
        await observer.entranceExamScore.update({
          where: { applicationId: ids.app },
          data: {
            essayScore: options.essay,
            gradedById: ids.admin,
            essayEvaluatedAt: new Date(),
          },
        });
    }

    const amendments = new ExamAmendmentRepository();
    const action = async (
      kind: Parameters<typeof amendments.amend>[1],
      body: unknown = { reason: "Owner-authorized B9 fixture reason" },
      actorId = ids.admin,
    ) => amendments.amend(ids.app, kind, body, actorId);
    const app = () =>
      observer.entranceExamApplication.findUniqueOrThrow({
        where: { id: ids.app },
        include: { score: true, resultDecision: true, scheduleAmendment: true },
      });
    async function past() {
      const date = today();
      date.setUTCDate(date.getUTCDate() - 1);
      await observer.examSlot.update({
        where: { id: ids.slot },
        data: { examDate: date },
      });
      await observer.entranceExamApplication.update({
        where: { id: ids.app },
        data: { examDate: date },
      });
    }
    const file = () =>
      action(
        "MISSED_APPEAL",
        { reason: "Missed a prior Manila date" },
        ids.user,
      );
    const approve = (targetSlotId = ids.targetA) =>
      action("APPROVE_APPEAL", {
        reason: "Approved replacement appointment",
        targetSlotId,
      });
    const cancel = () => action("ADMIN_CANCELLATION");
    const reschedule = (targetSlotId = ids.targetA) =>
      action("ADMIN_RESCHEDULE", {
        reason: "Direct replacement appointment",
        targetSlotId,
      });
    async function counters() {
      for (const id of [ids.slot, ids.targetA, ids.targetB]) {
        const slot = await observer.examSlot.findUniqueOrThrow({
          where: { id },
        });
        expect(slot.slotsTaken).toBe(
          await observer.entranceExamApplication.count({
            where: { slotId: id, seatReleasedAt: null },
          }),
        );
        expect(slot.slotsTaken).toBeGreaterThanOrEqual(0);
        expect(slot.slotsTaken).toBeLessThanOrEqual(slot.maxSlots);
      }
    }

    it("B9 additive migration preserves original appointments, counters, B5-B8 evidence and statuses without decisions or released seats", async () => {
      expect(
        (
          await observer.entranceExamApplication.findUniqueOrThrow({
            where: { id: ids.preFailed },
            include: { score: true },
          })
        ).score,
      ).toMatchObject({
        status: "FAILED",
        scoredAt: expect.any(Date),
        scoringBasis: expect.any(Object),
      });
      expect(
        (
          await observer.entranceExamApplication.findUniqueOrThrow({
            where: { id: ids.prePassed },
            include: { score: true },
          })
        ).score?.status,
      ).toBe("PASSED");
      expect(await observer.examScheduleAmendment.count()).toBe(0);
      expect(await observer.examResultDecision.count()).toBe(0);
      await counters();
    });
    it("same-day late arrival cannot appeal and can still use normal B4 Start", async () => {
      await expect(file()).rejects.toMatchObject({ statusCode: 409 });
      expect((await start()).state).toBe("ACTIVE");
      expect((await app()).seatReleasedAt).toBeNull();
      await counters();
    });
    it("an earlier Manila date can appeal exactly once, preserving appointment and releasing exactly one seat", async () => {
      await past();
      const before = await app();
      expect(
        await new ExamService().getApplicantStatus(ids.user),
      ).toMatchObject({ applicationId: ids.app, canAppealMissedExam: true });
      expect(await file()).toMatchObject({
        status: "APPEALED",
        replacementApplicationId: null,
      });
      const after = await app();
      expect(after).toMatchObject({
        slotId: before.slotId,
        examDate: before.examDate,
        examTime: before.examTime,
        status: "APPEALED",
        seatReleasedAt: expect.any(Date),
      });
      expect(after.scheduleAmendment).toMatchObject({
        type: "MISSED_APPEAL",
        status: "PENDING",
        requestedById: ids.user,
        reason: "Missed a prior Manila date",
      });
      await expect(file()).rejects.toMatchObject({ statusCode: 409 });
      await counters();
    });
    it("exact ownership and nonempty bounded reason are enforced before mutation", async () => {
      await past();
      await expect(
        action("MISSED_APPEAL", { reason: "other" }, ids.otherUser),
      ).rejects.toMatchObject({ statusCode: 404 });
      for (const reason of ["", "   ", null, 1, "x".repeat(2001)])
        await expect(
          action("MISSED_APPEAL", { reason }, ids.user),
        ).rejects.toMatchObject({ statusCode: 400 });
      expect((await app()).status).toBe("PENDING");
      await counters();
    });
    it.each([
      "actualStartedAt",
      "deadlineAt",
      "contentRevisionId",
      "executionConfiguration",
      "finalizedAt",
      "finalizationReason",
      "finalizationReceiptId",
      "finalizationAnsweredCount",
      "finalizationQuestionCount",
    ])(
      "partial or started %s rejects every schedule mutation",
      async (field) => {
        await past();
        const value = field.endsWith("Count")
          ? 0
          : field === "contentRevisionId"
            ? ids.revision
            : field === "executionConfiguration"
              ? { incomplete: true }
              : field === "finalizationReason"
                ? "APPLICANT_SUBMITTED"
                : field === "finalizationReceiptId"
                  ? randomUUID()
                  : new Date();
        await observer.entranceExamApplication.update({
          where: { id: ids.app },
          data: { [field]: value },
        });
        await expect(file()).rejects.toMatchObject({ statusCode: 409 });
        await expect(cancel()).rejects.toMatchObject({ statusCode: 409 });
        await expect(reschedule()).rejects.toMatchObject({ statusCode: 409 });
        await counters();
      },
    );
    it.each(["answer", "score"])(
      "%s-bearing never-started legacy record rejects amendments",
      async (kind) => {
        await past();
        if (kind === "answer")
          await observer.applicantAnswer.create({
            data: {
              applicationId: ids.app,
              questionId: ids.essay,
              essayAnswer: "Legacy response",
            },
          });
        else
          await observer.entranceExamScore.create({
            data: {
              applicationId: ids.app,
              status: "PENDING",
              multipleChoiceScore: 0,
            },
          });
        await expect(file()).rejects.toMatchObject({ statusCode: 409 });
        await expect(cancel()).rejects.toMatchObject({ statusCode: 409 });
        await counters();
      },
    );
    it("prior complete Start Now authorization alone does not prevent a later-date missed appeal", async () => {
      await past();
      await observer.entranceExamApplication.update({
        where: { id: ids.app },
        data: {
          startAuthorizedAt: new Date(Date.now() - 86400000),
          startAuthorizedById: ids.admin,
        },
      });
      expect(await file()).toHaveProperty("status", "APPEALED");
      await counters();
    });
    it("appeal approval creates one replacement, links history and never rewrites original date/time/slot", async () => {
      await past();
      await file();
      const original = await app();
      const result = await approve();
      expect(result).toMatchObject({
        status: "RESCHEDULED",
        replacementApplicationId: expect.any(String),
      });
      expect(await app()).toMatchObject({
        slotId: original.slotId,
        examDate: original.examDate,
        examTime: original.examTime,
        seatReleasedAt: original.seatReleasedAt,
        status: "RESCHEDULED",
      });
      const replacement =
        await observer.entranceExamApplication.findUniqueOrThrow({
          where: { id: result.replacementApplicationId! },
        });
      expect(replacement).toMatchObject({
        studentId: ids.student,
        programId: ids.program,
        slotId: ids.targetA,
        status: "PENDING",
        seatReleasedAt: null,
        actualStartedAt: null,
        contentRevisionId: null,
      });
      expect((await app()).scheduleAmendment).toMatchObject({
        status: "APPROVED",
        replacementApplicationId: replacement.id,
        decidedById: ids.admin,
        decisionReason: "Approved replacement appointment",
      });
      expect(
        await new ExamService().getApplicantStatus(ids.user),
      ).toMatchObject({
        applicationId: replacement.id,
        examStatus: "pending",
        canAppealMissedExam: false,
        canBookExam: false,
      });
      await expect(approve()).rejects.toMatchObject({ statusCode: 409 });
      await counters();
    });
    it.each(["inactive", "full", "wrong-program", "past", "drift"])(
      "approval rejects %s target without changing pending appeal",
      async (kind) => {
        await past();
        await file();
        if (kind === "inactive")
          await observer.examSlot.update({
            where: { id: ids.targetA },
            data: { isActive: false },
          });
        if (kind === "full") {
          const target = await observer.examSlot.findUniqueOrThrow({
            where: { id: ids.targetA },
          });
          await observer.entranceExamApplication.create({
            data: {
              studentId: ids.otherStudent,
              programId: ids.program,
              slotId: target.id,
              examDate: target.examDate,
              examTime: target.examTime,
            },
          });
          await observer.examSlot.update({
            where: { id: ids.targetA },
            data: { slotsTaken: 1 },
          });
        }
        if (kind === "wrong-program") {
          const program = await observer.program.create({
            data: {
              programName: `B9 foreign ${randomUUID()}`,
              programType: "MASTERS",
            },
          });
          await observer.examSlot.update({
            where: { id: ids.targetA },
            data: { programId: program.id },
          });
        }
        if (kind === "past")
          await observer.examSlot.update({
            where: { id: ids.targetA },
            data: {
              examDate: today(),
              examTime: new Date("1970-01-01T00:00:00Z"),
            },
          });
        if (kind === "drift")
          await observer.examSlot.update({
            where: { id: ids.targetA },
            data: { slotsTaken: 1 },
          });
        const before = await app();
        await expect(approve()).rejects.toMatchObject({ statusCode: 409 });
        expect(await app()).toEqual(before);
      },
    );
    it("approval requires reason and target, and direct changes cannot bypass a pending appeal", async () => {
      await past();
      await file();
      for (const input of [
        { reason: "approved" },
        { targetSlotId: ids.targetA },
        { reason: "", targetSlotId: ids.targetA },
      ])
        await expect(action("APPROVE_APPEAL", input)).rejects.toMatchObject({
          statusCode: 400,
        });
      await expect(cancel()).rejects.toMatchObject({ statusCode: 409 });
      await expect(reschedule()).rejects.toMatchObject({ statusCode: 409 });
      await counters();
    });
    it("rejection records MISSED, creates no replacement and blocks every ordinary booking path", async () => {
      await past();
      await file();
      expect(await action("REJECT_APPEAL")).toHaveProperty("status", "MISSED");
      expect((await app()).scheduleAmendment).toMatchObject({
        status: "REJECTED",
        replacementApplicationId: null,
        decidedById: ids.admin,
      });
      await expect(
        new ExamService().scheduleExam(ids.user, ids.targetA),
      ).rejects.toMatchObject({ statusCode: 409 });
      await expect(
        new ExamService().assignApplicant(ids.student, ids.targetA),
      ).rejects.toMatchObject({ statusCode: 409 });
      await counters();
    });
    it("direct cancellation is explicit nonblocking history and capacity can be booked again", async () => {
      const original = await app();
      expect(await cancel()).toMatchObject({
        status: "CANCELLED",
        replacementApplicationId: null,
      });
      const closed = await app();
      expect(closed).toMatchObject({
        slotId: original.slotId,
        examDate: original.examDate,
        examTime: original.examTime,
        seatReleasedAt: expect.any(Date),
      });
      expect(
        await new ExamService().getApplicantStatus(ids.user),
      ).toMatchObject({ applicationId: null, canBookExam: true });
      expect(
        await new ExamService().scheduleExam(ids.user, ids.targetA),
      ).toMatchObject({ slotId: ids.targetA, status: "PENDING" });
      await expect(cancel()).rejects.toMatchObject({ statusCode: 409 });
      await counters();
    });
    it("direct reschedule preserves history and RESCHEDULED does not block its valid replacement", async () => {
      const original = await app();
      const result = await reschedule();
      expect(result.status).toBe("RESCHEDULED");
      expect(await app()).toMatchObject({
        slotId: original.slotId,
        examDate: original.examDate,
        examTime: original.examTime,
      });
      expect(
        await observer.entranceExamApplication.count({
          where: { studentId: ids.student, status: "PENDING" },
        }),
      ).toBe(1);
      expect(
        await new ExamService().getApplicantStatus(ids.user),
      ).toHaveProperty("applicationId", result.replacementApplicationId);
      await counters();
    });
    it("two Admin approvals serialize into exactly one replacement", async () => {
      await past();
      await file();
      const [first, second] = await contend(approve, approve, "students");
      expect(first).toHaveProperty("value.status", "RESCHEDULED");
      expect(second).toHaveProperty("error.statusCode", 409);
      expect(
        await observer.entranceExamApplication.count({
          where: { studentId: ids.student, status: "PENDING" },
        }),
      ).toBe(1);
      await counters();
    }, 15000);
    it.each(["start-first", "cancel-first"])(
      "cancellation/start contention %s has one valid winner",
      async (order) => {
        const [first, second] = await contend(
          order === "start-first" ? start : cancel,
          order === "start-first" ? cancel : start,
          "students",
        );
        expect(first).toHaveProperty("value");
        expect(second).toHaveProperty("error.statusCode", 409);
        const current = await app();
        expect(current.status).toBe(
          order === "start-first" ? "PENDING" : "CANCELLED",
        );
        expect(Boolean(current.actualStartedAt)).toBe(order === "start-first");
        await counters();
      },
      15000,
    );
    it.each(["same-day-start", "prior-date-appeal"])(
      "appeal/start contention %s honors both date rules and one mutation",
      async (order) => {
        if (order === "prior-date-appeal") await past();
        const [first, second] = await contend(
          order === "same-day-start" ? start : file,
          order === "same-day-start" ? file : start,
          "students",
        );
        expect(first).toHaveProperty("value");
        expect(second).toHaveProperty("error.statusCode", 409);
        await counters();
      },
      15000,
    );
    it("reschedule and Applicant booking share the Student lock without double reservation", async () => {
      const [first, second] = await contend(
        reschedule,
        () => new ExamService().scheduleExam(ids.user, ids.targetB),
        "students",
      );
      expect(first).toHaveProperty("value.status", "RESCHEDULED");
      expect(second).toHaveProperty("error.statusCode", 409);
      await counters();
    }, 15000);
    it("two-target-slot contention uses sorted slots and cannot oversubscribe either target", async () => {
      const old = await app();
      await observer.entranceExamApplication.create({
        data: {
          id: ids.otherApp,
          studentId: ids.otherStudent,
          programId: ids.program,
          slotId: ids.slot,
          examDate: old.examDate,
          examTime: old.examTime,
        },
      });
      await observer.examSlot.update({
        where: { id: ids.slot },
        data: { maxSlots: 8, slotsTaken: 8 },
      });
      const other = () =>
        amendments.amend(
          ids.otherApp,
          "ADMIN_RESCHEDULE",
          { reason: "Other Applicant replacement", targetSlotId: ids.targetB },
          ids.admin2,
        );
      const [first, second] = await contend(
        reschedule,
        other,
        "exam_slots",
        undefined,
        ids.slot,
      );
      expect(first).toHaveProperty("value.status", "RESCHEDULED");
      expect(second).toHaveProperty("value.status", "RESCHEDULED");
      await counters();
    }, 15000);
    it("two Students competing for the final replacement seat release only the winner's old seat", async () => {
      const otherDate = today();
      otherDate.setUTCDate(otherDate.getUTCDate() + 2);
      const otherTime = new Date("1970-01-01T09:00:00Z");
      await observer.examSlot.update({
        where: { id: ids.targetB },
        data: { slotsTaken: 1 },
      });
      await observer.entranceExamApplication.create({
        data: {
          id: ids.otherApp,
          studentId: ids.otherStudent,
          programId: ids.program,
          slotId: ids.targetB,
          examDate: otherDate,
          examTime: otherTime,
        },
      });
      const other = () =>
        amendments.amend(
          ids.otherApp,
          "ADMIN_RESCHEDULE",
          { reason: "Competing last seat", targetSlotId: ids.targetA },
          ids.admin2,
        );
      const [first, second] = await contend(
        reschedule,
        other,
        "exam_slots",
        undefined,
        ids.targetA,
      );
      expect(first).toHaveProperty("value.status", "RESCHEDULED");
      expect(second).toHaveProperty("error.statusCode", 409);
      expect(
        await observer.entranceExamApplication.findUniqueOrThrow({
          where: { id: ids.otherApp },
        }),
      ).toMatchObject({
        status: "PENDING",
        seatReleasedAt: null,
        slotId: ids.targetB,
      });
      await counters();
    }, 15000);
    it("a failure after amendment/audit writes rolls back both counters, history and new application", async () => {
      const before = await app(),
        auditCount = await observer.auditLog.count();
      gateway.$transaction.mockImplementationOnce((fn, options) =>
        workers[0].$transaction(
          (tx) =>
            fn(
              new Proxy(tx, {
                get(target, property) {
                  if (property !== "auditLog")
                    return Reflect.get(target, property);
                  return new Proxy(target.auditLog, {
                    get(model, operation) {
                      if (operation !== "create")
                        return Reflect.get(model, operation);
                      return async (args: any) => {
                        await model.create(args);
                        throw new Error("B9 amendment rollback injected");
                      };
                    },
                  });
                },
              }),
            ),
          options,
        ),
      );
      await expect(reschedule()).rejects.toThrow("B9 amendment rollback");
      expect(await app()).toEqual(before);
      expect(await observer.auditLog.count()).toBe(auditCount);
      expect(await observer.examScheduleAmendment.count()).toBe(0);
      expect(
        await observer.entranceExamApplication.count({
          where: { studentId: ids.student },
        }),
      ).toBe(1);
      await counters();
    });
    const reconsider = () =>
      amendments.reconsider(
        ids.app,
        { reason: "Institutional reconsideration justification" },
        ids.admin,
      );
    async function failed() {
      await scenario({ choice: "wrong", essay: 0 });
      await reconcile();
    }
    it("only valid B8 computed FAILED can receive one separate immutable decision", async () => {
      await failed();
      const before = await app();
      expect(
        (await new ExamService().getApplicationDetail(ids.app))
          .canReconsiderResult,
      ).toBe(true);
      const beforeAnswers = await observer.applicantAnswer.findMany({
        where: { applicationId: ids.app },
        orderBy: { id: "asc" },
      });
      expect(await reconsider()).toMatchObject({
        computedStatus: "failed",
        effectiveStatus: "passed_reconsidered",
      });
      const after = await app();
      expect({ ...after, resultDecision: null }).toEqual(before);
      expect(
        await observer.applicantAnswer.findMany({
          where: { applicationId: ids.app },
          orderBy: { id: "asc" },
        }),
      ).toEqual(beforeAnswers);
      expect(after).toMatchObject({
        status: "FAILED",
        score: { status: "FAILED" },
        resultDecision: {
          decision: "PASSED_RECONSIDERED",
          decidedById: ids.admin,
          decidedAt: expect.any(Date),
        },
      });
      await expect(reconsider()).rejects.toMatchObject({ statusCode: 409 });
    });
    it.each(["PASSED", "PENDING", "LEGACY", "CORRUPT"])(
      "reconsideration rejects %s evidence",
      async (kind) => {
        if (kind === "PASSED") {
          await scenario({ choice: "correct", essay: 25.5 });
          await reconcile();
        } else if (kind === "PENDING") await scenario();
        else if (kind === "LEGACY") {
          await observer.entranceExamApplication.update({
            where: { id: ids.app },
            data: { status: "FAILED" },
          });
          await observer.entranceExamScore.create({
            data: {
              applicationId: ids.app,
              status: "FAILED",
              multipleChoiceScore: 0,
            },
          });
        } else {
          await failed();
          await observer.entranceExamScore.update({
            where: { applicationId: ids.app },
            data: { scoringBasis: Prisma.DbNull },
          });
        }
        await expect(reconsider()).rejects.toMatchObject({ statusCode: 409 });
        expect(await observer.examResultDecision.count()).toBe(0);
      },
    );
    it("reason, active Admin and exact role are required for reconsideration", async () => {
      await failed();
      expect(() =>
        amendments.reconsider(ids.app, { reason: "   " }, ids.admin),
      ).toThrow(/reason/);
      await expect(
        amendments.reconsider(ids.app, { reason: "No authority" }, ids.user),
      ).rejects.toMatchObject({ statusCode: 403 });
      await observer.user.update({
        where: { id: ids.admin2 },
        data: { isActive: false },
      });
      try {
        await expect(
          amendments.reconsider(ids.app, { reason: "Inactive" }, ids.admin2),
        ).rejects.toMatchObject({ statusCode: 403 });
      } finally {
        await observer.user.update({
          where: { id: ids.admin2 },
          data: { isActive: true },
        });
      }
    });
    it("two concurrent Admin reconsiderations create one decision after a real InnoDB wait", async () => {
      await failed();
      const before = await stored();
      const [first, second] = await contend(
        reconsider,
        () =>
          amendments.reconsider(
            ids.app,
            { reason: "Second Admin" },
            ids.admin2,
          ),
        "entrance_exam_applications",
      );
      expect(first).toHaveProperty(
        "value.effectiveStatus",
        "passed_reconsidered",
      );
      expect(second).toHaveProperty("error.statusCode", 409);
      expect(await observer.examResultDecision.count()).toBe(1);
      expect(await stored()).toEqual(before);
    }, 15000);
    it("Applicant/Admin projections preserve computed failure and separate the effective pass without leaking justification", async () => {
      await failed();
      await reconsider();
      const applicant = await new ExamService().getExamResult(ids.user),
        admin = await new ExamService().getApplicationDetail(ids.app);
      expect(applicant).toMatchObject({
        status: "failed",
        computedStatus: "failed",
        effectiveStatus: "passed_reconsidered",
        totalScore: "0",
        institutionalDecision: { decision: "PASSED_RECONSIDERED" },
      });
      expect(JSON.stringify(applicant)).not.toMatch(
        /Institutional reconsideration justification|decidedById|scoringBasis|isCorrect/,
      );
      const profile = await new ApplicantService().getProfile(ids.user);
      expect(profile.currentStep).toBe(2);
      expect(JSON.stringify(profile)).not.toMatch(/Institutional reconsideration justification|scoringBasis|isCorrect/);
      expect(admin).toMatchObject({
        status: "FAILED",
        effectiveStatus: "passed_reconsidered",
        canReconsiderResult: false,
        resultEmailEligible: false,
        reconsideration: {
          reason: "Institutional reconsideration justification",
        },
        result: { status: "failed", totalScore: "0" },
      });
    });
    it("valid reconsideration satisfies COR preliminary and transactional promotion gates without changing FAILED", async () => {
      await failed();
      expect(await new CorRepository().checkPassedExam(ids.student)).toBeNull();
      await reconsider();
      expect(
        await new CorRepository().checkPassedExam(ids.student),
      ).toHaveProperty("status", "FAILED");
      const upload = await observer.corUpload.create({
        data: {
          studentId: ids.student,
          filePath: "synthetic-b9-no-file",
          uploadedAt: new Date(),
        },
      });
      await new CorRepository().verifyAndPromote(
        upload.id,
        ids.student,
        ids.user,
        {
          studentNumber: `B9-${randomUUID()}`,
          firstName: "B9",
          lastName: "Promoted",
          email: `${ids.user}@example.invalid`,
          programId: ids.program,
          verificationMethod: "ADMIN_MANUAL",
        },
        ids.admin,
      );
      expect(
        await observer.student.findUniqueOrThrow({
          where: { id: ids.student },
        }),
      ).toHaveProperty("admissionStatus", "ENROLLED");
      expect((await app()).status).toBe("FAILED");
    });
    it.each(["basis", "score-link", "decision-time"])(
      "corrupt reconsidered %s never grants a downstream pass",
      async (field) => {
        await failed();
        await reconsider();
        if (field === "basis")
          await observer.entranceExamScore.update({
            where: { applicationId: ids.app },
            data: { scoringBasis: Prisma.DbNull },
          });
        else
          await observer.examResultDecision.update({
            where: { applicationId: ids.app },
            data:
              field === "score-link"
                ? {
                    scoreId: (
                      await observer.entranceExamScore.findUniqueOrThrow({
                        where: { applicationId: ids.preFailed },
                      })
                    ).id,
                  }
                : { decidedAt: new Date("2000-01-01T00:00:00Z") },
          });
        expect(
          await new CorRepository().checkPassedExam(ids.student),
        ).toBeNull();
        expect(
          await new AdminApplicantRepository().effectivePassIds(),
        ).not.toContain(ids.app);
        await expect(
          new ExamService().getExamResult(ids.user),
        ).rejects.toMatchObject({ statusCode: 409 });
        await expect(
          new ExamService().scheduleExam(ids.user, ids.targetA),
        ).rejects.toMatchObject({ statusCode: 409 });
      },
    );
    it("Admin Applicant list/filter/count/detail share the effective COR-stage authority", async () => {
      await failed();
      const repository = new AdminApplicantRepository(),
        filters = { stage: "COR", search: ids.user };
      expect(await repository.countApplicants(filters)).toBe(0);
      await reconsider();
      expect(await repository.countApplicants(filters)).toBe(1);
      expect(await repository.findApplicants(filters)).toContainEqual(
        expect.objectContaining({
          id: ids.student,
          examStatus: "FAILED",
          hasPassedExam: true,
          admissionStage: "COR",
        }),
      );
      const detail = await repository.findStudentById(ids.student);
      expect(hasAuthoritativePassedExam(detail!.examApplications)).toBe(true);
      expect(
        deriveAdmissionStage({
          alignmentStatus: detail!.alignmentStatus,
          hasPassedExam: hasAuthoritativePassedExam(detail!.examApplications),
        }),
      ).toBe("COR");
      expect(
        await repository.countApplicants({ ...filters, stage: "EXAM" }),
      ).toBe(0);
    });
    it("computed FAILED and reconsidered pass both block self-booking and Admin assignment", async () => {
      await failed();
      for (const decided of [false, true]) {
        if (decided) await reconsider();
        await expect(
          new ExamService().scheduleExam(ids.user, ids.targetA),
        ).rejects.toMatchObject({ statusCode: 409 });
        await expect(
          new ExamService().assignApplicant(ids.student, ids.targetA),
        ).rejects.toMatchObject({ statusCode: 409 });
      }
    });
    it("queued original email evidence stays unchanged and generic B8 email rejects after reconsideration", async () => {
      await failed();
      let jobs = 0;
      await evaluation.queueResultEmail(ids.app, async () => {
        jobs++;
      });
      const before = await stored();
      await reconsider();
      await expect(
        evaluation.queueResultEmail(ids.app, async () => {
          jobs++;
        }),
      ).rejects.toMatchObject({
        statusCode: 409,
        message: expect.stringContaining("reconsideration"),
      });
      expect(await stored()).toEqual(before);
      expect(jobs).toBe(1);
    });
    it("decision and AuditLog roll back together after actual writes", async () => {
      await failed();
      const before = await app(),
        auditCount = await observer.auditLog.count();
      gateway.$transaction.mockImplementationOnce((fn, options) =>
        workers[0].$transaction(
          (tx) =>
            fn(
              new Proxy(tx, {
                get(target, property) {
                  if (property !== "auditLog")
                    return Reflect.get(target, property);
                  return new Proxy(target.auditLog, {
                    get(model, operation) {
                      if (operation !== "create")
                        return Reflect.get(model, operation);
                      return async (args: any) => {
                        await model.create(args);
                        throw new Error("B9 decision rollback injected");
                      };
                    },
                  });
                },
              }),
            ),
          options,
        ),
      );
      await expect(reconsider()).rejects.toThrow("B9 decision rollback");
      expect(await app()).toEqual(before);
      expect(await observer.auditLog.count()).toBe(auditCount);
      expect(await observer.examResultDecision.count()).toBe(0);
    });
  },
);
