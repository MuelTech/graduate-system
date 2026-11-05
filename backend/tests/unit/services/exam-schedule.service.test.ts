import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const db = vi.hoisted(() => ({
  $transaction: vi.fn(), $queryRaw: vi.fn(), student: { findUnique: vi.fn() }, program: { findUnique: vi.fn() },
  examSlot: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  entranceExamApplication: { count: vi.fn(), findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
}));
vi.mock("../../../src/config/database", () => ({ default: db }));
vi.mock("../../../src/services/email.service", () => ({ EmailService: {} }));
import { ExamService } from "../../../src/services/exam.service";
const service = new ExamService();
const ids = { program: "11111111-1111-4111-8111-111111111111", slot: "22222222-2222-4222-8222-222222222222", other: "33333333-3333-4333-8333-333333333333", student: "44444444-4444-4444-8444-444444444444" };
const input = { programId: ids.program, examDate: "2026-11-15", examTime: "1970-01-01T16:00:00.000Z", maxSlots: 2 };
const slot = (data = {}) => ({ id: ids.slot, programId: ids.program, examDate: new Date("2026-11-15T00:00:00Z"), examTime: new Date(input.examTime), slotsTaken: 0, maxSlots: 2, isActive: true, _count: { examApplications: 0 }, ...data });

beforeEach(() => {
  vi.resetAllMocks(); vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-15T02:00:00Z"));
  db.$transaction.mockImplementation(callback => callback(db));
  db.$queryRaw.mockImplementation(strings => Promise.resolve([{ id: strings.join("").includes("FROM students") ? ids.student : ids.slot }]));
  db.student.findUnique.mockResolvedValue({ id: ids.student, userId: "jwt-user", alignmentStatus: "ALIGNED", programId: ids.program });
  db.program.findUnique.mockResolvedValue({ id: ids.program });
  db.examSlot.findUnique.mockResolvedValue(slot()); db.examSlot.findMany.mockResolvedValue([slot()]);
  db.examSlot.updateMany.mockResolvedValue({ count: 1 }); db.examSlot.update.mockResolvedValue(slot());
  db.entranceExamApplication.findMany.mockResolvedValue([]); db.entranceExamApplication.count.mockResolvedValue(0);
  db.entranceExamApplication.create.mockImplementation(({ data }) => Promise.resolve({ id: "created", ...data }));
});
afterEach(() => vi.useRealTimers());

describe("B3 Admin same-day assignment", () => {
  const registered = (data = {}) => ({ id: ids.student, userId: "jwt-user", admissionStatus: "APPLICANT",
    pinnacleApplicantId: "SYNTHETIC-1", alignmentStatus: "ALIGNED", programId: ids.program,
    user: { role: "APPLICANT", firstName: "Test", lastName: "Applicant", email: "test@example.invalid" },
    program: { id: ids.program, programName: "Test Program" }, ...data });
  beforeEach(() => db.student.findUnique.mockResolvedValue(registered()));

  it.each(["1970-01-01T09:00:00Z", "1970-01-01T10:00:00Z", "1970-01-01T16:00:00Z"])("admits same-day wall clock %s, preserving appointment", async examTime => {
    db.examSlot.findUnique.mockResolvedValue(slot({ examTime: new Date(examTime) }));
    expect(await service.assignApplicant(ids.student, ids.slot)).toMatchObject({ studentId: ids.student, programId: ids.program,
      slotId: ids.slot, status: "PENDING", examDate: new Date("2026-11-15T00:00:00Z"), examTime: new Date(examTime) });
    expect(db.$transaction.mock.calls[0][1]).toEqual({ isolationLevel: "ReadCommitted" });
    expect(db.$queryRaw.mock.calls.map(([strings, value]) => [strings.join("?"), value])).toEqual([
      [expect.stringMatching(/FROM students WHERE student_id = \? FOR UPDATE/), ids.student],
      [expect.stringMatching(/FROM exam_slots WHERE slot_id = \? FOR UPDATE/), ids.slot],
    ]);
    expect(db.student.findUnique.mock.calls[0][0]).toMatchObject({ where: { id: ids.student }, include: { user: { select: { role: true } } } });
    expect(db.examSlot.updateMany.mock.calls[0][0]).toMatchObject({ where: { id: ids.slot, slotsTaken: 0, maxSlots: 2, isActive: true, AND: { slotsTaken: { lt: 2 } } } });
    expect(db.examSlot.update).not.toHaveBeenCalled();
  });
  it.each(["ALIGNED", "CLEARED"])("allows eligible alignment %s", async alignmentStatus => {
    db.student.findUnique.mockResolvedValue(registered({ alignmentStatus }));
    await expect(service.assignApplicant(ids.student, ids.slot)).resolves.toHaveProperty("id");
  });
  it.each(["PENDING", "APPROVED", "TAKEN", "PASSED", "FAILED", "APPEALED", "MISSED", "DISQUALIFIED"])("blocks any %s even behind a newer FAILED", async status => {
    db.entranceExamApplication.findMany.mockResolvedValue([{ status: "FAILED" }, { status }]);
    await expect(service.assignApplicant(ids.student, ids.slot)).rejects.toMatchObject({ statusCode: 409 });
    expect(db.examSlot.updateMany).not.toHaveBeenCalled();
  });
  it.each(["CANCELLED", "RESCHEDULED"])("allows nonblocking %s history", async status => {
    db.entranceExamApplication.findMany.mockResolvedValue([{ status }]);
    await expect(service.assignApplicant(ids.student, ids.slot)).resolves.toHaveProperty("id");
  });
  it.each([
    { alignmentStatus: "PENDING_WAIVER" }, { alignmentStatus: "UNKNOWN" }, { alignmentStatus: null },
    { admissionStatus: "ENROLLED" }, { user: { role: "STUDENT" } }, { pinnacleApplicantId: null }, { pinnacleApplicantId: " " },
  ])("rejects an ineligible/unregistered selected Student %#", async change => {
    db.student.findUnique.mockResolvedValue(registered(change));
    await expect(service.assignApplicant(ids.student, ids.slot)).rejects.toMatchObject({ statusCode: 409 });
    expect(db.examSlot.updateMany).not.toHaveBeenCalled();
    expect((await service.getAssignmentOptions(ids.student))).toMatchObject({ eligible: false, reason: expect.any(String), slots: [] });
  });
  it.each([
    { examDate: new Date("2026-11-14T00:00:00Z") }, { examDate: new Date("2026-11-16T00:00:00Z") },
    { isActive: false }, { programId: ids.other }, { slotsTaken: 1 }, { maxSlots: 0 },
    { examTime: new Date("1970-01-01T25:00:00Z") }, { examTime: new Date("1970-01-01T09:00:01Z") },
    { examDate: new Date("2026-11-15T01:00:00Z") },
  ])("fails closed for unsafe slot %#", async change => {
    db.examSlot.findUnique.mockResolvedValue(slot(change));
    await expect(service.assignApplicant(ids.student, ids.slot)).rejects.toMatchObject({ statusCode: 409 });
    expect(db.examSlot.updateMany).not.toHaveBeenCalled(); expect(db.entranceExamApplication.create).not.toHaveBeenCalled();
  });
  it("rejects full consistent capacity", async () => {
    db.examSlot.findUnique.mockResolvedValue(slot({ slotsTaken: 2 })); db.entranceExamApplication.count.mockResolvedValue(2);
    await expect(service.assignApplicant(ids.student, ids.slot)).rejects.toMatchObject({ statusCode: 409 });
    expect(db.examSlot.updateMany).not.toHaveBeenCalled();
  });
  it("rechecks Manila date immediately before reservation across midnight", async () => {
    db.entranceExamApplication.findMany.mockImplementation(async () => {
      if (db.$queryRaw.mock.calls.length === 2) vi.setSystemTime(new Date("2026-11-15T16:00:00Z"));
      return [];
    });
    await expect(service.assignApplicant(ids.student, ids.slot)).rejects.toMatchObject({ statusCode: 409 });
    expect(db.examSlot.updateMany).not.toHaveBeenCalled();
  });
  it("uses Manila's date when UTC is still the prior day", async () => {
    vi.setSystemTime(new Date("2026-11-14T16:01:00Z"));
    db.examSlot.findUnique.mockResolvedValue(slot({ examTime: new Date("1970-01-01T00:00:00Z") }));
    await expect(service.assignApplicant(ids.student, ids.slot)).resolves.toHaveProperty("id");
    await expect(service.scheduleExam("jwt-user", ids.slot)).rejects.toMatchObject({ statusCode: 409 });
  });
  it("validates both UUIDs before starting a transaction", async () => {
    for (const value of [null, [], "bad", "", 123]) {
      await expect(service.assignApplicant(value, ids.slot)).rejects.toMatchObject({ statusCode: 400 });
      await expect(service.assignApplicant(ids.student, value)).rejects.toMatchObject({ statusCode: 400 });
      await expect(service.getAssignmentOptions(value)).rejects.toMatchObject({ statusCode: 400 });
    }
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  it("rejects missing Applicant/slot and a lost reservation", async () => {
    db.$queryRaw.mockResolvedValueOnce([]);
    await expect(service.assignApplicant(ids.student, ids.slot)).rejects.toMatchObject({ statusCode: 404 });
    db.$queryRaw.mockResolvedValueOnce([{ id: ids.student }]).mockResolvedValueOnce([]);
    await expect(service.assignApplicant(ids.student, ids.slot)).rejects.toMatchObject({ statusCode: 404 });
    db.examSlot.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.assignApplicant(ids.student, ids.slot)).rejects.toMatchObject({ statusCode: 409 });
    expect(db.entranceExamApplication.create).not.toHaveBeenCalled();
  });
  it("options expose authoritative identity and only eligible same-day slots, including past time", async () => {
    db.examSlot.findMany.mockResolvedValue([slot(), slot({ id: ids.other, examTime: new Date("1970-01-01T09:00:00Z") }),
      slot({ isActive: false }), slot({ programId: ids.other }), slot({ examDate: new Date("2026-11-16T00:00:00Z") }),
      slot({ slotsTaken: 1 }), slot({ slotsTaken: 2, _count: { examApplications: 2 } }), slot({ examTime: new Date(NaN) })]);
    const options = await service.getAssignmentOptions(ids.student);
    expect(options).toMatchObject({ eligible: true, reason: null, date: "2026-11-15", timeZone: "Asia/Manila",
      applicant: { id: ids.student, pinnacleApplicantId: "SYNTHETIC-1", program: { id: ids.program }, alignmentStatus: "ALIGNED" } });
    expect(options.slots).toHaveLength(2);
    expect(options.slots[1]).toEqual({ id: ids.other, examDate: "2026-11-15T00:00:00.000Z", examTime: "1970-01-01T09:00:00.000Z", slotsTaken: 0, maxSlots: 2, remainingSeats: 2 });
    expect(options.applicant).not.toHaveProperty("user");
    expect(db.examSlot.updateMany).not.toHaveBeenCalled();
  });
});

describe("B3 available schedules", () => {
  it.each(["ALIGNED", "CLEARED"])("uses authenticated Student Program with %s", async alignmentStatus => {
    db.student.findUnique.mockResolvedValue({ id: ids.student, programId: ids.program, alignmentStatus });
    expect(await service.getAvailableSlots("jwt-user", ids.program)).toEqual([expect.objectContaining({ id: ids.slot })]);
    expect(db.student.findUnique.mock.calls[0][0].where).toEqual({ userId: "jwt-user" });
    expect(db.examSlot.findMany.mock.calls[0][0]).toMatchObject({ where: { programId: ids.program, isActive: true }, orderBy: [{ examDate: "asc" }, { examTime: "asc" }, { id: "asc" }] });
    expect(db.examSlot.findMany.mock.calls[0][0].where.examDate).toBeUndefined();
  });
  it("allows omitted query Program but refuses a foreign one", async () => {
    expect(await service.getAvailableSlots("jwt-user")).toHaveLength(1);
    db.examSlot.findMany.mockClear();
    await expect(service.getAvailableSlots("jwt-user", ids.other)).rejects.toMatchObject({ statusCode: 403 });
    expect(db.examSlot.findMany).not.toHaveBeenCalled();
  });
  it("rejects missing Student and nonscalar query Program", async () => {
    await expect(service.getAvailableSlots("jwt-user", [ids.program])).rejects.toMatchObject({ statusCode: 400 });
    db.student.findUnique.mockResolvedValue(null);
    await expect(service.getAvailableSlots("jwt-user")).rejects.toMatchObject({ statusCode: 404 });
  });
  it.each(["PENDING_WAIVER", "UNKNOWN", "", null])("rejects alignment %s", async alignmentStatus => {
    db.student.findUnique.mockResolvedValue({ id: ids.student, programId: ids.program, alignmentStatus });
    await expect(service.getAvailableSlots("jwt-user")).rejects.toMatchObject({ statusCode: 403 });
  });
  it("excludes past/inactive/full/invalid/drift/foreign rows, retains same-day future", async () => {
    const rows = [slot(), slot({ isActive: false }), slot({ examTime: new Date("1970-01-01T09:00:00Z") }),
      slot({ maxSlots: 1, slotsTaken: 1, _count: { examApplications: 1 } }), slot({ maxSlots: 0 }),
      slot({ maxSlots: -1 }), slot({ maxSlots: 1.5 }), slot({ maxSlots: NaN }),
      slot({ slotsTaken: 1 }), slot({ examDate: new Date(NaN) }), slot({ programId: ids.other }),
      slot({ examTime: new Date("1970-01-01T10:00:00Z") }), slot({ examDate: new Date("2026-11-14T00:00:00Z") })];
    db.examSlot.findMany.mockResolvedValue(rows);
    expect(await service.getAvailableSlots("jwt-user")).toEqual([expect.objectContaining({ id: ids.slot })]);
    expect((await service.getAvailableSlots("jwt-user"))[0]).not.toHaveProperty("_count");
  });
});

describe("B3 booking admission", () => {
  it("locks Student then exact slot, rereads state and atomically requests reservation/application", async () => {
    expect(await service.scheduleExam("jwt-user", ids.slot)).toMatchObject({ studentId: ids.student, programId: ids.program, slotId: ids.slot, status: "PENDING", examDate: new Date("2026-11-15T00:00:00Z"), examTime: new Date(input.examTime) });
    expect(db.$transaction.mock.calls[0][1]).toEqual({ isolationLevel: "ReadCommitted" });
    expect(db.$queryRaw.mock.calls.map(([strings, value]) => [strings.join("?"), value])).toEqual([
      [expect.stringMatching(/FROM students WHERE user_id = \? FOR UPDATE/), "jwt-user"],
      [expect.stringMatching(/FROM exam_slots WHERE slot_id = \? FOR UPDATE/), ids.slot],
    ]);
    expect(db.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(db.student.findUnique.mock.invocationCallOrder[0]);
    expect(db.$queryRaw.mock.invocationCallOrder[1]).toBeLessThan(db.examSlot.findUnique.mock.invocationCallOrder[0]);
    expect(db.$queryRaw.mock.invocationCallOrder[1]).toBeLessThan(db.entranceExamApplication.findMany.mock.invocationCallOrder[0]);
    expect(db.examSlot.updateMany.mock.calls[0][0]).toMatchObject({ where: { id: ids.slot, slotsTaken: 0, maxSlots: 2, isActive: true, AND: { slotsTaken: { lt: 2 } } }, data: { slotsTaken: { increment: 1 } } });
    expect(db.examSlot.updateMany.mock.invocationCallOrder[0]).toBeLessThan(db.entranceExamApplication.create.mock.invocationCallOrder[0]);
  });
  it.each(["ALIGNED", "CLEARED"])("accepts %s with same-day future start", async alignmentStatus => {
    db.student.findUnique.mockResolvedValue({ id: ids.student, programId: ids.program, alignmentStatus });
    await expect(service.scheduleExam("jwt-user", ids.slot)).resolves.toHaveProperty("id");
  });
  it.each(["PENDING", "APPROVED", "TAKEN", "PASSED", "FAILED", "APPEALED", "MISSED", "DISQUALIFIED"])("preserves blocking status %s", async status => {
    db.entranceExamApplication.findMany.mockResolvedValue([{ id: "previous", status }]);
    await expect(service.scheduleExam("jwt-user", ids.slot)).rejects.toMatchObject({ statusCode: 409 });
    expect(db.examSlot.updateMany).not.toHaveBeenCalled(); expect(db.entranceExamApplication.create).not.toHaveBeenCalled();
  });
  it.each(["CANCELLED", "RESCHEDULED"])("allows nonblocking %s without a retake policy", async status => {
    db.entranceExamApplication.findMany.mockResolvedValue([{ id: "history", status }]);
    await expect(service.scheduleExam("jwt-user", ids.slot)).resolves.toHaveProperty("id");
  });
  it.each(["PENDING_WAIVER", "UNKNOWN", null])("rejects alignment %s before locking slot", async alignmentStatus => {
    db.student.findUnique.mockResolvedValue({ id: ids.student, programId: ids.program, alignmentStatus });
    await expect(service.scheduleExam("jwt-user", ids.slot)).rejects.toMatchObject({ statusCode: 403 });
    expect(db.$queryRaw).toHaveBeenCalledTimes(1); expect(db.examSlot.updateMany).not.toHaveBeenCalled();
  });
  it.each([
    [{ programId: ids.other }, 403], [{ isActive: false }, 409],
    [{ examTime: new Date("1970-01-01T09:00:00Z") }, 409], [{ examDate: new Date("2026-11-14T00:00:00Z") }, 409],
    [{ maxSlots: 0 }, 409], [{ maxSlots: -1 }, 409], [{ maxSlots: 1.5 }, 409], [{ slotsTaken: 1 }, 409],
  ])("rejects unsafe slot %# without writes", async (data, statusCode) => {
    db.examSlot.findUnique.mockResolvedValue(slot(data));
    await expect(service.scheduleExam("jwt-user", ids.slot)).rejects.toMatchObject({ statusCode });
    expect(db.examSlot.updateMany).not.toHaveBeenCalled(); expect(db.entranceExamApplication.create).not.toHaveBeenCalled();
  });
  it("rejects a full but consistent slot", async () => {
    db.examSlot.findUnique.mockResolvedValue(slot({ slotsTaken: 2 })); db.entranceExamApplication.count.mockResolvedValue(2);
    await expect(service.scheduleExam("jwt-user", ids.slot)).rejects.toMatchObject({ statusCode: 409, message: expect.stringContaining("fully booked") });
  });
  it("rejects nonexistent Student or slot using locking/current results", async () => {
    db.$queryRaw.mockResolvedValueOnce([]);
    await expect(service.scheduleExam("jwt-user", ids.slot)).rejects.toMatchObject({ statusCode: 404 });
    db.$queryRaw.mockResolvedValueOnce([{ id: ids.student }]).mockResolvedValueOnce([]);
    await expect(service.scheduleExam("jwt-user", ids.slot)).rejects.toMatchObject({ statusCode: 404 });
  });
  it("refuses application creation if conditional reservation affects no row", async () => {
    db.examSlot.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.scheduleExam("jwt-user", ids.slot)).rejects.toMatchObject({ statusCode: 409 });
    expect(db.entranceExamApplication.create).not.toHaveBeenCalled();
  });
  it("rechecks clock if current application reads cross the start boundary", async () => {
    db.entranceExamApplication.findMany.mockImplementation(async () => { vi.setSystemTime(new Date("2026-11-15T08:00:00Z")); return []; });
    await expect(service.scheduleExam("jwt-user", ids.slot)).rejects.toMatchObject({ statusCode: 409 });
    expect(db.examSlot.updateMany).not.toHaveBeenCalled();
  });
});

describe("B3 Admin schedule mutations", () => {
  it("validates Program and future combined start before creation", async () => {
    await service.createSlot(input);
    expect(db.examSlot.create).toHaveBeenCalledWith({ data: { programId: ids.program, examDate: new Date("2026-11-15T00:00:00Z"), examTime: new Date(input.examTime), maxSlots: 2, isActive: true } });
    db.program.findUnique.mockResolvedValue(null);
    await expect(service.createSlot(input)).rejects.toMatchObject({ statusCode: 404 });
    db.program.findUnique.mockResolvedValue({ id: ids.program });
    await expect(service.createSlot({ ...input, examTime: "1970-01-01T09:00:00.000Z" })).rejects.toMatchObject({ statusCode: 409 });
  });
  it.each([{ programId: ids.other }, { examDate: "2026-11-16" }, { examTime: "1970-01-01T17:00:00.000Z" }])("blocks booked identity edit %#", async change => {
    db.examSlot.findUnique.mockResolvedValue(slot({ slotsTaken: 1 })); db.entranceExamApplication.count.mockResolvedValue(1);
    await expect(service.updateSlot(ids.slot, { ...input, ...change })).rejects.toMatchObject({ statusCode: 409 });
    expect(db.examSlot.update).not.toHaveBeenCalled();
  });
  it("blocks capacity below actual assignments and permits capacity-only update", async () => {
    db.examSlot.findUnique.mockResolvedValue(slot({ slotsTaken: 2 })); db.entranceExamApplication.count.mockResolvedValue(2);
    await expect(service.updateSlot(ids.slot, { ...input, maxSlots: 1 })).rejects.toMatchObject({ statusCode: 409 });
    await service.updateSlot(ids.slot, { ...input, maxSlots: 3 });
    expect(db.examSlot.update).toHaveBeenCalledWith({ where: { id: ids.slot }, data: expect.objectContaining({ maxSlots: 3 }) });
  });
  it("allows valid unbooked identity edit but rejects nonexistent Program/past start", async () => {
    await service.updateSlot(ids.slot, { ...input, programId: ids.other, examDate: "2026-11-16" });
    db.program.findUnique.mockResolvedValue(null);
    await expect(service.updateSlot(ids.slot, input)).rejects.toMatchObject({ statusCode: 404 });
    db.program.findUnique.mockResolvedValue({ id: ids.program });
    await expect(service.updateSlot(ids.slot, { ...input, examDate: "2026-11-14" })).rejects.toMatchObject({ statusCode: 409 });
  });
  it.each([0, -1])("allows an unassigned slot's invalid maximum %s to be replaced by validated capacity without rewriting counters", async maxSlots => {
    db.examSlot.findUnique.mockResolvedValue(slot({ maxSlots }));
    await service.updateSlot(ids.slot, input);
    expect(db.examSlot.update.mock.calls[0][0].data).toMatchObject({ maxSlots: 2 });
    expect(db.examSlot.update.mock.calls[0][0].data).not.toHaveProperty("slotsTaken");
  });
  it("fails closed on counter drift for update and close/reopen", async () => {
    db.entranceExamApplication.count.mockResolvedValue(1);
    await expect(service.updateSlot(ids.slot, input)).rejects.toMatchObject({ statusCode: 409, message: expect.stringContaining("reconciliation") });
    await expect(service.toggleSlotStatus(ids.slot, false)).rejects.toMatchObject({ statusCode: 409 });
    expect(db.examSlot.update).not.toHaveBeenCalled();
  });
  it.each([false, true])("only mutates booking flag %s, preserving assignments", async isActive => {
    await service.toggleSlotStatus(ids.slot, isActive);
    expect(db.examSlot.update).toHaveBeenCalledWith({ where: { id: ids.slot }, data: { isActive } });
    expect(db.entranceExamApplication.updateMany).not.toHaveBeenCalled();
    db.examSlot.findUnique.mockResolvedValue(slot({ examDate: new Date("2026-11-14T00:00:00Z") }));
    await expect(service.toggleSlotStatus(ids.slot, isActive)).rejects.toMatchObject({ statusCode: 409 });
  });
  it("rejects client counters/status fields in full update and nonboolean status", async () => {
    for (const extra of [{ slotsTaken: 0 }, { isActive: true }]) await expect(service.updateSlot(ids.slot, { ...input, ...extra })).rejects.toMatchObject({ statusCode: 400 });
    await expect(service.toggleSlotStatus(ids.slot, "false")).rejects.toMatchObject({ statusCode: 400 });
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});

describe("B9 retired implicit appeal mutation", () => {
  it("requires exact application, reason and dedicated decision routes without writes", async () => {
    await expect(service.appealMissedExam("jwt-user")).rejects.toMatchObject({ statusCode: 409 });
    await expect(service.approveAppeal(ids.student)).rejects.toMatchObject({ statusCode: 409 });
    await expect(service.rejectAppeal(ids.student)).rejects.toMatchObject({ statusCode: 409 });
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(db.entranceExamApplication.updateMany).not.toHaveBeenCalled();
  });
});
