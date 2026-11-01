// Explicit opt-in: EXAM_B0A_DB_TEST=1 npm test -- tests/integration/exam-answer-contention.test.ts
// Uses only new UUID-scoped synthetic records; never imports/resets the real bank.
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PrismaClient, Prisma } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { parse } from "dotenv";

const gateway = vi.hoisted(() => ({ $transaction: vi.fn() }));
vi.mock("../../src/config/database", () => ({ default: gateway }));
import { ExamEngineRepository } from "../../src/repositories/exam-engine.repository";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}

describe.skipIf(process.env.EXAM_B0A_DB_TEST !== "1")("B0A real InnoDB contention", () => {
  const ids = { user: randomUUID(), student: randomUUID(), program: randomUUID(), slot: randomUUID(), app: randomUUID(), q: randomUUID(), otherQ: randomUUID(), essay: randomUUID(), option: randomUUID(), foreignOption: randomUUID() };
  const repo = new ExamEngineRepository();
  let observer: PrismaClient;
  let workers: PrismaClient[];
  const finalAnswers = () => [{ questionId: ids.q, selectedOptionId: ids.option }, { questionId: ids.essay, essayAnswer: "Final essay" }];

  beforeAll(async () => {
    const env = existsSync(".env") ? parse(readFileSync(".env")) : {};
    const url = process.env.DATABASE_URL || env.DATABASE_URL;
    if (!url) throw new Error("Opt-in contention check requires DATABASE_URL or backend/.env.");
    function client() {
      return new PrismaClient({ adapter: new PrismaMariaDb(url.replace("mysql://", "mariadb://")) });
    }
    observer = client();
    workers = [client(), client()];
    await Promise.all([observer, ...workers].map(db => db.$connect()));
    const engines = await observer.$queryRaw<{ TABLE_NAME: string; ENGINE: string }[]>`
      SELECT TABLE_NAME, ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME IN ('entrance_exam_applications', 'applicant_answers', 'entrance_exam_scores')
    `;
    expect(engines).toHaveLength(3);
    expect(engines.every(row => row.ENGINE === "InnoDB")).toBe(true);
    await observer.program.create({ data: { id: ids.program, programName: "B0A isolated contention fixture", programType: "MASTERS" } });
    await observer.user.create({ data: { id: ids.user, email: `b0a-${ids.user}@example.invalid`, passwordHash: "unusable-test-fixture", firstName: "B0A", lastName: "Fixture", role: "APPLICANT" } });
    await observer.student.create({ data: { id: ids.student, userId: ids.user, programId: ids.program } });
    await observer.examSlot.create({ data: { id: ids.slot, programId: ids.program, examDate: new Date("2026-11-02T00:00:00Z"), examTime: new Date("1970-01-01T09:00:00Z"), maxSlots: 1 } });
    await observer.entranceExamApplication.create({ data: { id: ids.app, studentId: ids.student, programId: ids.program, slotId: ids.slot } });
    for (const [questionId, optionId] of [[ids.q, ids.option], [ids.otherQ, ids.foreignOption]]) {
      await observer.examQuestion.create({ data: { id: questionId, questionText: "Synthetic choice", type: "MULTIPLE_CHOICE", options: { create: { id: optionId, optionText: "Synthetic correct option", isCorrect: true } } } });
    }
    await observer.examQuestion.create({ data: { id: ids.essay, questionText: "Synthetic essay", type: "ESSAY" } });
  }, 20_000);

  afterAll(async () => {
    if (!observer) return;
    try {
      // Exact generated identities only, including cleanup after a failed assertion/setup.
      await observer.entranceExamScore.deleteMany({ where: { applicationId: ids.app } });
      await observer.applicantAnswer.deleteMany({ where: { applicationId: ids.app } });
      await observer.entranceExamApplication.deleteMany({ where: { id: ids.app } });
      await observer.examQuestion.deleteMany({ where: { id: { in: [ids.q, ids.otherQ, ids.essay] } } });
      await observer.examSlot.deleteMany({ where: { id: ids.slot } });
      await observer.student.deleteMany({ where: { id: ids.student } });
      await observer.user.deleteMany({ where: { id: ids.user } });
      await observer.program.deleteMany({ where: { id: ids.program } });
      expect(await Promise.all([
        observer.examQuestion.count({ where: { id: { in: [ids.q, ids.otherQ, ids.essay] } } }),
        observer.examOption.count({ where: { id: { in: [ids.option, ids.foreignOption] } } }),
        observer.entranceExamApplication.count({ where: { id: ids.app } }),
        observer.applicantAnswer.count({ where: { applicationId: ids.app } }),
        observer.entranceExamScore.count({ where: { applicationId: ids.app } }),
        observer.examSlot.count({ where: { id: ids.slot } }),
        observer.student.count({ where: { id: ids.student } }),
        observer.user.count({ where: { id: ids.user } }),
        observer.program.count({ where: { id: ids.program } }),
      ])).toEqual(Array(9).fill(0));
    } finally {
      await Promise.all([observer, ...workers].map(db => db.$disconnect()));
    }
  }, 20_000);

  beforeEach(async () => {
    gateway.$transaction.mockReset();
    gateway.$transaction.mockImplementation(callback => workers[0].$transaction(callback));
    await observer.applicantAnswer.deleteMany({ where: { applicationId: ids.app } });
    await observer.entranceExamScore.deleteMany({ where: { applicationId: ids.app } });
    await observer.entranceExamApplication.update({ where: { id: ids.app }, data: { status: "PENDING" } });
  });

  async function assertFinal(essay = "Final essay") {
    expect((await observer.entranceExamApplication.findUniqueOrThrow({ where: { id: ids.app } })).status).toBe("TAKEN");
    const score = await observer.entranceExamScore.findUniqueOrThrow({ where: { applicationId: ids.app } });
    expect(Number(score.multipleChoiceScore)).toBe(1);
    expect(await observer.entranceExamScore.count({ where: { applicationId: ids.app } })).toBe(1);
    const rows = await observer.applicantAnswer.findMany({ where: { applicationId: ids.app } });
    expect(rows).toHaveLength(2);
    expect(rows.find(row => row.questionId === ids.q)?.selectedOptionId).toBe(ids.option);
    expect(rows.find(row => row.questionId === ids.essay)?.essayAnswer).toBe(essay);
  }

  async function contend(first: () => Promise<unknown>, second: () => Promise<unknown>) {
    const acquired = deferred();
    const attempted = deferred();
    const release = deferred();
    const connections: number[] = [];
    let invocation = 0;
    let secondAcquired = false;
    gateway.$transaction.mockImplementation((callback: (tx: Prisma.TransactionClient) => Promise<unknown>) => {
      const index = invocation++;
      return workers[index].$transaction(async tx => {
        const [connection] = await tx.$queryRaw<{ id: bigint }[]>`SELECT CONNECTION_ID() AS id`;
        connections[index] = Number(connection.id);
        return callback(new Proxy(tx, {
          get(target, property) {
            if (property !== "$queryRaw") return Reflect.get(target, property);
            return async (...args: Parameters<typeof tx.$queryRaw>) => {
              if (index === 1) attempted.resolve();
              const rows = await target.$queryRaw(...args);
              if (index === 1) secondAcquired = true;
              if (index === 0) { acquired.resolve(); await release.promise; }
              return rows;
            };
          },
        }));
      }, { timeout: 10_000 });
    });
    const firstResult = first().then(value => ({ value }), error => ({ error }));
    let secondResult: Promise<{ value: unknown } | { error: unknown }> | undefined;
    let observedWait = false;
    try {
      await Promise.race([acquired.promise, delay(4000).then(() => { throw new Error("First transaction did not acquire its lock."); })]);
      secondResult = second().then(value => ({ value }), error => ({ error }));
      await Promise.race([attempted.promise, delay(4000).then(() => { throw new Error("Second independent transaction did not attempt the lock."); })]);
      expect(connections[0]).not.toBe(connections[1]);
      for (let attempt = 0; attempt < 60; attempt++) {
        // SHOW reads current server execution, avoiding MariaDB's cached
        // information_schema.INNODB_TRX/LOCK_WAITS snapshots between cases.
        const processes = await observer.$queryRaw<{ Id: bigint; Info: string | null }[]>`SHOW FULL PROCESSLIST`;
        const waiting = processes.find(row => Number(row.Id) === connections[1]);
        if (waiting?.Info?.includes("FOR UPDATE") && !secondAcquired) {
          await delay(100);
          expect(secondAcquired).toBe(false);
          observedWait = true;
          break;
        }
        await delay(50);
      }
    } finally {
      release.resolve();
    }
    const results = await Promise.all([firstResult, secondResult]);
    expect(observedWait, "Independent worker must execute FOR UPDATE and remain blocked until the first worker releases its lock").toBe(true);
    return results;
  }

  it("submit vs submit: one winner, waiting finalizer rejects and cannot replace score/answers", async () => {
    const [winner, loser] = await contend(() => repo.submitAnswers(ids.app, finalAnswers()), () => repo.submitAnswers(ids.app, [{ questionId: ids.essay, essayAnswer: "Losing final" }]));
    expect(winner).toEqual({ value: { success: true, mcqScore: 1 } });
    expect(loser).toMatchObject({ error: { statusCode: 409 } });
    await assertFinal();
  }, 15_000);

  it("autosave first: draft commits, waiting submit rereads eligibility and finalizes", async () => {
    const [draft, final] = await contend(() => repo.autoSaveAnswer(ids.app, ids.essay, "Earlier draft"), () => repo.submitAnswers(ids.app, finalAnswers()));
    expect(draft).toHaveProperty("value");
    expect(final).toEqual({ value: { success: true, mcqScore: 1 } });
    await assertFinal();
  }, 15_000);

  it("submit first: waiting and later autosaves reject without overwriting final essay", async () => {
    const [final, draft] = await contend(() => repo.submitAnswers(ids.app, finalAnswers()), () => repo.autoSaveAnswer(ids.app, ids.essay, "Waiting stale draft"));
    expect(final).toHaveProperty("value");
    expect(draft).toMatchObject({ error: { statusCode: 409 } });
    gateway.$transaction.mockImplementation(callback => workers[0].$transaction(callback));
    await expect(repo.autoSaveAnswer(ids.app, ids.essay, "Later stale draft")).rejects.toMatchObject({ statusCode: 409 });
    await assertFinal();
  }, 15_000);

  it("invalid/foreign payload rolls back with no partial finalization and preserves prior draft", async () => {
    await repo.autoSaveAnswer(ids.app, ids.essay, "Existing draft");
    await expect(repo.submitAnswers(ids.app, [...finalAnswers(), { questionId: ids.otherQ, selectedOptionId: ids.option }])).rejects.toMatchObject({ statusCode: 400 });
    expect((await observer.entranceExamApplication.findUniqueOrThrow({ where: { id: ids.app } })).status).toBe("PENDING");
    expect(await observer.entranceExamScore.count({ where: { applicationId: ids.app } })).toBe(0);
    const answers = await observer.applicantAnswer.findMany({ where: { applicationId: ids.app } });
    expect(answers).toHaveLength(1);
    expect(answers[0].essayAnswer).toBe("Existing draft");
    expect(answers[0].selectedOptionId).toBeNull();
  });

  it("failure after answer/status writes rolls the entire final transaction back", async () => {
    gateway.$transaction.mockImplementation(callback => workers[0].$transaction(async tx => callback(new Proxy(tx, {
      get(target, property) {
        if (property === "entranceExamScore") return { upsert: async () => { throw new Error("Injected score write failure"); } };
        return Reflect.get(target, property);
      },
    }))));
    await expect(repo.submitAnswers(ids.app, finalAnswers())).rejects.toThrow("Injected score write failure");
    expect((await observer.entranceExamApplication.findUniqueOrThrow({ where: { id: ids.app } })).status).toBe("PENDING");
    expect(await observer.applicantAnswer.count({ where: { applicationId: ids.app } })).toBe(0);
    expect(await observer.entranceExamScore.count({ where: { applicationId: ids.app } })).toBe(0);
  });
});
