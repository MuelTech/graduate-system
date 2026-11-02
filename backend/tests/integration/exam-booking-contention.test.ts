// EXAM_B3_DB_TEST=1: exact UUID-scoped synthetic local records and independent
// connections. No Question Bank writes, migrations, resets or historical repair.
import { randomUUID, createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import { parse } from "dotenv";
import { Prisma, PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const gateway = vi.hoisted(() => ({ $transaction: vi.fn(), student: { findUnique: vi.fn() }, program: { findUnique: vi.fn() }, examSlot: { create: vi.fn(), findMany: vi.fn() } }));
vi.mock("../../src/config/database", () => ({ default: gateway }));
vi.mock("../../src/services/email.service", () => ({ EmailService: {} }));
import { ExamService } from "../../src/services/exam.service";

function deferred() { let resolve!: () => void; const promise = new Promise<void>(r => { resolve = r; }); return { promise, resolve }; }

describe.skipIf(process.env.EXAM_B3_DB_TEST !== "1")("B3 real MariaDB booking admission", () => {
  const ids = { program: randomUUID(), otherProgram: randomUUID(), users: [randomUUID(), randomUUID(), randomUUID()], students: [randomUUID(), randomUUID(), randomUUID()], slots: [randomUUID(), randomUUID(), randomUUID()] };
  const service = new ExamService();
  let observer: PrismaClient; let workers: PrismaClient[] = []; let initial: string;
  const date = new Date("2099-11-15T00:00:00Z"), time = new Date("1970-01-01T16:00:00Z");
  const body = { programId: ids.program, examDate: "2099-11-15", examTime: time.toISOString(), maxSlots: 2 };
  const booking = (user = 0, slot = 0) => service.scheduleExam(ids.users[user], ids.slots[slot]);

  async function snapshot() {
    const rows = await Promise.all([
      observer.examQuestion.findMany({ orderBy: { id: "asc" } }), observer.examOption.findMany({ orderBy: { id: "asc" } }),
      observer.examMedia.findMany({ orderBy: { id: "asc" } }), observer.examContentImport.findMany({ orderBy: { id: "asc" } }),
      observer.applicantAnswer.findMany({ orderBy: { id: "asc" } }),
      observer.examSlot.findMany({ where: { id: { notIn: ids.slots }, programId: { notIn: [ids.program, ids.otherProgram] } }, orderBy: { id: "asc" } }),
      observer.entranceExamApplication.findMany({ where: { studentId: { notIn: ids.students } }, orderBy: { id: "asc" } }),
    ]);
    return createHash("sha256").update(JSON.stringify(rows)).digest("hex");
  }

  beforeAll(async () => {
    const env = parse(readFileSync(".env")); const url = new URL(process.env.DATABASE_URL || env.DATABASE_URL);
    if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) throw new Error("B3 fixtures require the supported local database.");
    const client = () => new PrismaClient({ adapter: new PrismaMariaDb(url.toString().replace("mysql://", "mariadb://")) });
    observer = client(); workers = [client(), client()];
    await Promise.all([observer, ...workers].map(db => db.$connect()));
    const engines = await observer.$queryRaw<{ ENGINE: string }[]>`SELECT ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('students','exam_slots','entrance_exam_applications')`;
    expect(engines).toHaveLength(3); expect(engines.every(e => e.ENGINE === "InnoDB")).toBe(true);
    const drift = await observer.$queryRaw<unknown[]>`SELECT s.slot_id FROM exam_slots s LEFT JOIN entrance_exam_applications a ON a.slot_id = s.slot_id GROUP BY s.slot_id, s.slots_taken HAVING s.slots_taken <> COUNT(a.application_id)`;
    expect(drift, "STOP: existing seat counters require owner reconciliation").toHaveLength(0);
    const duplicates = await observer.$queryRaw<unknown[]>`SELECT student_id FROM entrance_exam_applications WHERE status IN ('PENDING','APPROVED','TAKEN','PASSED','APPEALED','DISQUALIFIED') GROUP BY student_id HAVING COUNT(*) > 1`;
    expect(duplicates, "STOP: existing blocking application duplicates require owner review").toHaveLength(0);
    initial = await snapshot();
    await observer.program.createMany({ data: [ids.program, ids.otherProgram].map((id, i) => ({ id, programName: `B3 synthetic ${id}`, programType: "MASTERS" as const })) });
    for (let i = 0; i < ids.users.length; i++) {
      await observer.user.create({ data: { id: ids.users[i], email: `b3-${ids.users[i]}@example.invalid`, passwordHash: "unusable-synthetic", firstName: "B3", lastName: "Fixture", role: "APPLICANT" } });
      await observer.student.create({ data: { id: ids.students[i], userId: ids.users[i], programId: ids.program, alignmentStatus: "ALIGNED" } });
    }
    await observer.examSlot.createMany({ data: ids.slots.map(id => ({ id, programId: ids.program, examDate: date, examTime: time, maxSlots: 2 })) });
    gateway.student.findUnique.mockImplementation(args => observer.student.findUnique(args));
    gateway.program.findUnique.mockImplementation(args => observer.program.findUnique(args));
    gateway.examSlot.create.mockImplementation(args => observer.examSlot.create(args));
    gateway.examSlot.findMany.mockImplementation(args => observer.examSlot.findMany(args));
    const version = await observer.$queryRaw<unknown[]>`SELECT VERSION() AS version, @@tx_isolation AS default_isolation`;
    console.log("B3 real DB engine", JSON.stringify(version));
  }, 20_000);

  afterAll(async () => {
    if (!observer) return;
    try {
      await observer.entranceExamApplication.deleteMany({ where: { studentId: { in: ids.students } } });
      await observer.examSlot.deleteMany({ where: { programId: { in: [ids.program, ids.otherProgram] } } });
      await observer.student.deleteMany({ where: { id: { in: ids.students } } });
      await observer.user.deleteMany({ where: { id: { in: ids.users } } });
      await observer.program.deleteMany({ where: { id: { in: [ids.program, ids.otherProgram] } } });
      expect(await Promise.all([
        observer.entranceExamApplication.count({ where: { studentId: { in: ids.students } } }),
        observer.examSlot.count({ where: { programId: { in: [ids.program, ids.otherProgram] } } }),
        observer.student.count({ where: { id: { in: ids.students } } }), observer.user.count({ where: { id: { in: ids.users } } }),
        observer.program.count({ where: { id: { in: [ids.program, ids.otherProgram] } } }),
      ])).toEqual([0, 0, 0, 0, 0]);
      if (initial) expect(await snapshot(), "canonical bank and preexisting schedule/application rows unchanged").toBe(initial);
      console.log("B3 cleanup: zero synthetic records; canonical bank and preexisting schedule/application SHA-256 snapshot unchanged.");
    } finally { await Promise.all([observer, ...workers].map(db => db.$disconnect())); }
  }, 20_000);

  beforeEach(async () => {
    gateway.$transaction.mockReset();
    gateway.$transaction.mockImplementation((callback, options) => workers[0].$transaction(callback, options));
    await observer.entranceExamApplication.deleteMany({ where: { studentId: { in: ids.students } } });
    await observer.examSlot.updateMany({ where: { id: { in: ids.slots } }, data: { slotsTaken: 0, maxSlots: 2, isActive: true, programId: ids.program, examDate: date, examTime: time } });
  });

  async function contend(table: "students" | "exam_slots", first: () => Promise<unknown>, second: () => Promise<unknown>) {
    const acquired = deferred(), attempted = deferred(), release = deferred();
    let invocation = 0, secondAcquired = false, observedWait = false;
    const connections: number[] = [];
    gateway.$transaction.mockImplementation((callback, options) => {
      const index = invocation++;
      return workers[index].$transaction(async tx => {
        const [connection] = await tx.$queryRaw<{ id: bigint }[]>`SELECT CONNECTION_ID() AS id`;
        connections[index] = Number(connection.id);
        // Intentionally read before the lock. With a stale REPEATABLE READ
        // snapshot, later capacity/application reads would authorize old state.
        await tx.entranceExamApplication.count({ where: { studentId: ids.students[0] } });
        expect(options.isolationLevel).toBe("ReadCommitted");
        return callback(new Proxy(tx, { get(target, key) {
          if (key !== "$queryRaw") return Reflect.get(target, key);
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
    const firstResult = first().then(value => ({ value }), error => ({ error }));
    let secondResult: Promise<{ value: unknown } | { error: unknown }> | undefined;
    try {
      await Promise.race([acquired.promise, delay(4000).then(() => { throw new Error("First worker did not acquire lock"); })]);
      secondResult = second().then(value => ({ value }), error => ({ error }));
      await Promise.race([attempted.promise, delay(4000).then(() => { throw new Error("Second worker did not attempt lock"); })]);
      expect(connections[0]).not.toBe(connections[1]);
      for (let step = 0; step < 50; step++) {
        const processes = await observer.$queryRaw<{ Id: bigint; Info: string | null }[]>`SHOW FULL PROCESSLIST`;
        const waiting = processes.find(p => Number(p.Id) === connections[1]);
        if (waiting?.Info?.includes(`FROM ${table}`) && waiting.Info.includes("FOR UPDATE") && !secondAcquired) {
          await delay(100); expect(secondAcquired).toBe(false); observedWait = true; break;
        }
        await delay(40);
      }
    } finally { release.resolve(); await firstResult; if (secondResult) await secondResult; }
    expect(observedWait, `Independent ${table} FOR UPDATE worker must remain blocked until commit`).toBe(true);
    console.log(`B3 observed ${table} lock wait on independent connections ${connections.join(" / ")}`);
    return Promise.all([firstResult, secondResult!]);
  }

  it("two Applicants contend for the final seat: one commits, one gets full conflict; counter never exceeds maximum", async () => {
    await observer.entranceExamApplication.create({ data: { studentId: ids.students[2], programId: ids.program, slotId: ids.slots[0], status: "FAILED" } });
    await observer.examSlot.update({ where: { id: ids.slots[0] }, data: { slotsTaken: 1 } });
    const [winner, loser] = await contend("exam_slots", () => booking(0), () => booking(1));
    expect(winner).toHaveProperty("value"); expect(loser).toMatchObject({ error: { statusCode: 409, message: "This slot is fully booked." } });
    const slot = await observer.examSlot.findUniqueOrThrow({ where: { id: ids.slots[0] } });
    expect(slot.slotsTaken).toBe(2); expect(slot.slotsTaken).toBeLessThanOrEqual(slot.maxSlots);
    expect(await observer.entranceExamApplication.count({ where: { slotId: slot.id } })).toBe(2);
  }, 15_000);

  it("one Student contends for two slots: waiting request sees committed PENDING and cannot create a duplicate", async () => {
    const [winner, loser] = await contend("students", () => booking(0, 0), () => booking(0, 1));
    expect(winner).toHaveProperty("value"); expect(loser).toMatchObject({ error: { statusCode: 409, message: expect.stringContaining("PENDING") } });
    expect(await observer.entranceExamApplication.count({ where: { studentId: ids.students[0] } })).toBe(1);
    expect((await observer.examSlot.findMany({ where: { id: { in: ids.slots } }, orderBy: { id: "asc" } })).map(s => s.slotsTaken).sort()).toEqual([0, 0, 1]);
  }, 15_000);

  it("failed application creation rolls back a real reservation and application write", async () => {
    let reservedInside = false;
    gateway.$transaction.mockImplementation((callback, options) => workers[0].$transaction(tx => callback(new Proxy(tx, { get(target, key) {
      if (key !== "entranceExamApplication") return Reflect.get(target, key);
      return new Proxy(target.entranceExamApplication, { get(model, operation) {
        if (operation !== "create") return Reflect.get(model, operation);
        return async (args: Prisma.EntranceExamApplicationCreateArgs) => {
          expect((await tx.examSlot.findUniqueOrThrow({ where: { id: ids.slots[0] } })).slotsTaken).toBe(1);
          reservedInside = true; await model.create(args); throw new Error("Injected application failure after real writes");
        };
      } });
    } })), options));
    await expect(booking()).rejects.toThrow("Injected application failure"); expect(reservedInside).toBe(true);
    expect((await observer.examSlot.findUniqueOrThrow({ where: { id: ids.slots[0] } })).slotsTaken).toBe(0);
    expect(await observer.entranceExamApplication.count({ where: { slotId: ids.slots[0] } })).toBe(0);
  });

  it("booked Program/date/time and capacity minimum are protected by real assignment state", async () => {
    await booking(0); await booking(1);
    for (const change of [{ programId: ids.otherProgram }, { examDate: "2099-11-16" }, { examTime: "1970-01-01T17:00:00.000Z" }, { maxSlots: 1 }]) {
      await expect(service.updateSlot(ids.slots[0], { ...body, ...change })).rejects.toMatchObject({ statusCode: 409 });
    }
    await service.updateSlot(ids.slots[0], { ...body, maxSlots: 3 });
    expect(await observer.examSlot.findUniqueOrThrow({ where: { id: ids.slots[0] } })).toMatchObject({ programId: ids.program, examDate: date, examTime: time, slotsTaken: 2, maxSlots: 3 });
    await observer.examSlot.update({ where: { id: ids.slots[1] }, data: { maxSlots: 0 } });
    await service.updateSlot(ids.slots[1], body);
    expect(await observer.examSlot.findUniqueOrThrow({ where: { id: ids.slots[1] } })).toMatchObject({ slotsTaken: 0, maxSlots: 2 });
  });

  it("Admin edit waiting behind booking rereads committed assignments and rejects identity change", async () => {
    const [winner, edit] = await contend("exam_slots", () => booking(), () => service.updateSlot(ids.slots[0], { ...body, examDate: "2099-11-16" }));
    expect(winner).toHaveProperty("value"); expect(edit).toMatchObject({ error: { statusCode: 409 } });
    expect((await observer.examSlot.findUniqueOrThrow({ where: { id: ids.slots[0] } })).examDate).toEqual(date);
  }, 15_000);

  it("close retains booked access/assignments; reopen admits eligible new booking", async () => {
    await booking(); await service.toggleSlotStatus(ids.slots[0], false);
    await expect(booking(1)).rejects.toMatchObject({ statusCode: 409 });
    expect((await service.getApplicantStatus(ids.users[0])).confirmedSlot?.id).toBe(ids.slots[0]);
    expect((await observer.examSlot.findUniqueOrThrow({ where: { id: ids.slots[0] } })).slotsTaken).toBe(1);
    await service.toggleSlotStatus(ids.slots[0], true); await booking(1);
    expect(await observer.entranceExamApplication.count({ where: { slotId: ids.slots[0] } })).toBe(2);
  });

  it("Admin create persists the exact wall-clock fields; same-day future availability and booking use Manila time", async () => {
    const created = await service.createSlot(body);
    expect(created).toMatchObject({ programId: ids.program, examDate: date, examTime: time, slotsTaken: 0, maxSlots: 2, isActive: true });
    const now = new Date();
    const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now).map(p => [p.type, p.value]));
    // At 23:59:00 or later no accepted minute-precision future start remains today.
    // This fixture moves to Manila midnight tomorrow only in that edge minute.
    const { scheduleStartInstant } = await import("../../src/services/exam-schedule-time");
    let today = new Date(`${parts.year}-${parts.month}-${parts.day}T00:00:00Z`);
    const late = new Date("1970-01-01T23:59:00Z");
    const isSameDay = scheduleStartInstant(today, late).getTime() > now.getTime();
    if (!isSameDay) today = new Date(today.getTime() + 86_400_000);
    await observer.examSlot.update({ where: { id: ids.slots[1] }, data: { examDate: today, examTime: late } });
    expect((await service.getAvailableSlots(ids.users[0])).map(s => s.id)).toContain(ids.slots[1]);
    await booking(0, 1);
    const app = await observer.entranceExamApplication.findFirstOrThrow({ where: { studentId: ids.students[0] } });
    expect(app).toMatchObject({ examDate: today, examTime: late, status: "PENDING" });
    console.log(`B3 real wall-clock create preserved 16:00; ${isSameDay ? "same-day" : "next-midnight boundary fallback"} future slot was available and booked.`);
  });

  it("counter drift fails closed for booking, update, status and available selection without repair", async () => {
    // Deliberate inconsistency only in this test's generated synthetic slot.
    await observer.examSlot.update({ where: { id: ids.slots[0] }, data: { slotsTaken: 1 } });
    for (const action of [() => booking(), () => service.updateSlot(ids.slots[0], body), () => service.toggleSlotStatus(ids.slots[0], false)]) await expect(action()).rejects.toMatchObject({ statusCode: 409 });
    expect((await service.getAvailableSlots(ids.users[0])).map(s => s.id)).not.toContain(ids.slots[0]);
    expect((await observer.examSlot.findUniqueOrThrow({ where: { id: ids.slots[0] } })).slotsTaken).toBe(1);
    expect(await observer.entranceExamApplication.count({ where: { slotId: ids.slots[0] } })).toBe(0);
  });

  it("FAILED remains nonblocking; APPEALED remains blocking without decrement or period identity", async () => {
    await observer.entranceExamApplication.create({ data: { studentId: ids.students[0], programId: ids.program, slotId: ids.slots[0], status: "FAILED" } });
    await observer.examSlot.update({ where: { id: ids.slots[0] }, data: { slotsTaken: 1 } });
    await booking(0, 1);
    await observer.entranceExamApplication.updateMany({ where: { studentId: ids.students[0], status: "PENDING" }, data: { status: "APPEALED" } });
    await expect(booking(0, 2)).rejects.toMatchObject({ statusCode: 409 });
    expect((await observer.examSlot.findUniqueOrThrow({ where: { id: ids.slots[0] } })).slotsTaken).toBe(1);
  });

  it("a delayed appeal cannot resurrect a concurrently changed FAILED application before new admission", async () => {
    await observer.examSlot.update({ where: { id: ids.slots[0] }, data: { examDate: new Date("2020-01-01T00:00:00Z"), slotsTaken: 1 } });
    const previous = await observer.entranceExamApplication.create({ data: { studentId: ids.students[0], programId: ids.program, slotId: ids.slots[0], status: "PENDING" } });
    gateway.$transaction.mockImplementation((callback, options) => workers[0].$transaction(tx => callback(new Proxy(tx, { get(target, key) {
      if (key !== "entranceExamApplication") return Reflect.get(target, key);
      return new Proxy(target.entranceExamApplication, { get(model, operation) {
        if (operation !== "findFirst") return Reflect.get(model, operation);
        return async (args: Prisma.EntranceExamApplicationFindFirstArgs) => {
          const found = await model.findFirst(args);
          await observer.entranceExamApplication.update({ where: { id: previous.id }, data: { status: "FAILED" } });
          return found;
        };
      } });
    } })), options));
    await expect(service.appealMissedExam(ids.users[0])).rejects.toMatchObject({ statusCode: 409 });
    expect((await observer.entranceExamApplication.findUniqueOrThrow({ where: { id: previous.id } })).status).toBe("FAILED");
    gateway.$transaction.mockImplementation((callback, options) => workers[0].$transaction(callback, options));
    await booking(0, 1);
    expect(await observer.entranceExamApplication.count({ where: { studentId: ids.students[0], status: { in: ["PENDING", "APPROVED", "TAKEN", "PASSED", "APPEALED", "DISQUALIFIED"] } } })).toBe(1);
  });
});
