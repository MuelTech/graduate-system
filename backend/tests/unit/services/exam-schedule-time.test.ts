import { execFileSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseScheduleDate, parseScheduleTime, requireFutureSchedule, scheduleStartInstant } from "../../../src/services/exam-schedule-time";
import { validateBookingBody, validateBookingStatusBody, validateSlotBody } from "../../../src/services/exam-schedule.rules";

const programId = "11111111-1111-4111-8111-111111111111";
const valid = { programId, examDate: "2026-11-15", examTime: "1970-01-01T16:00:00.000Z", maxSlots: 5 };
const start = (date: string, time: string) => scheduleStartInstant(parseScheduleDate(date), parseScheduleTime(`1970-01-01T${time}:00.000Z`));

describe("B3 canonical Asia/Manila schedule time", () => {
  it.each([
    ["2026-11-15", "16:00", "2026-11-15T08:00:00.000Z"],
    ["2026-11-15", "00:00", "2026-11-14T16:00:00.000Z"],
    ["2028-02-29", "23:59", "2028-02-29T15:59:00.000Z"],
    ["2027-01-01", "00:00", "2026-12-31T16:00:00.000Z"],
  ])("converts %s %s without shifting stored components", (date, time, expected) => {
    expect(start(date, time).toISOString()).toBe(expected);
  });

  it.each([["2026-11-15", "16:00", true], ["2026-11-15", "09:00", false], ["2026-11-16", "09:00", true], ["2026-11-14", "16:00", false], ["2026-11-15", "10:00", false]])(
    "uses combined date/time at 10AM Manila: %s %s future=%s", (date, time, future) => {
      const action = () => requireFutureSchedule(parseScheduleDate(date), parseScheduleTime(`1970-01-01T${time}:00.000Z`), new Date("2026-11-15T02:00:00Z"));
      if (future) expect(action).not.toThrow(); else expect(action).toThrow(/future/);
    });

  it.each(["2026-02-29", "2026-04-31", "2026-13-01", "2026-00-01", "2026-11-00", "2026-11-32", "2026-1-01", "2026-11-15T00:00:00Z", "0999-12-31", "", null, 123])("rejects invalid date %s", value => {
    expect(() => parseScheduleDate(value)).toThrow();
  });
  it.each(["16:00", "1970-01-01T24:00:00.000Z", "1970-01-01T16:60:00.000Z", "1970-01-01T16:00:01.000Z", "1970-01-01T16:00:00.001Z", "2026-11-15T16:00:00.000Z", "1970-01-01T16:00:00+08:00", "", null])("rejects unsupported time %s", value => {
    expect(() => parseScheduleTime(value)).toThrow();
  });
  it("fails closed on malformed legacy dates", () => {
    expect(() => scheduleStartInstant(new Date(NaN), new Date(valid.examTime))).toThrow(/owner review/);
    expect(() => scheduleStartInstant(parseScheduleDate(valid.examDate), new Date("1970-01-02T16:00:00Z"))).toThrow();
  });

  it.each(["UTC", "Asia/Manila", "America/Los_Angeles"])("actual conversion and frontend comparison/formatting are host-independent in %s", TZ => {
    const script = `
      const fs = require('node:fs'), ts = require('typescript');
      require.extensions['.ts'] = (m, name) => m._compile(ts.transpileModule(fs.readFileSync(name, 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020}}).outputText, name);
      const backend = require('./src/services/exam-schedule-time.ts');
      const ui = require('../frontend/src/lib/admin-exam-schedules.ts');
      const date = '2026-11-15T00:00:00.000Z', time = '1970-01-01T16:00:00.000Z';
      console.log(JSON.stringify({instant: backend.scheduleStartInstant(new Date(date), new Date(time)).toISOString(),
        future: ui.isPastExamSchedule(date,time,new Date('2026-11-15T02:00:00Z')),
        past: ui.isPastExamSchedule(date,time,new Date('2026-11-15T09:00:00Z')),
        boundary: ui.isPastExamSchedule(date,time,new Date('2026-11-15T08:00:00Z')),
        midnight: ui.isPastExamSchedule(date,'1970-01-01T00:00:00.000Z',new Date('2026-11-14T16:00:00Z')),
        date: ui.toDateInputValue(date), time: ui.toTimeInputValue(time), label: ui.formatScheduleTime(time),
        payload: ui.toSchedulePayload('2026-11-15','16:00')}));`;
    const result = JSON.parse(execFileSync(process.execPath, ["-e", script], { cwd: path.resolve("."), env: { ...process.env, TZ }, encoding: "utf8" }));
    expect(result).toMatchObject({ instant: "2026-11-15T08:00:00.000Z", future: false, past: true, boundary: true, midnight: true, date: "2026-11-15", time: "16:00", payload: { examDate: "2026-11-15", examTime: valid.examTime } });
    expect(result.label).toMatch(/4:00\s*PM/i);
  });
});

describe("B3 bounded request validation", () => {
  it("retains UTC-component DATE/TIME storage and accepts positive integer capacity", () => {
    expect(validateSlotBody(valid)).toEqual({ ...valid, examDate: new Date("2026-11-15T00:00:00Z"), examTime: new Date(valid.examTime) });
  });
  it.each([0, -1, 1.5, NaN, Infinity, "5", null, 2_147_483_648])("rejects capacity %s", maxSlots => {
    expect(() => validateSlotBody({ ...valid, maxSlots })).toThrow(/maxSlots/);
  });
  it.each([null, [], {}, { ...valid, slotsTaken: 0 }, { ...valid, isActive: false }, { ...valid, studentId: programId }, { ...valid, programId: "bad" }])("rejects malformed or unbounded full slot input %#", input => {
    expect(() => validateSlotBody(input)).toThrow();
  });
  it("bounds booking authority to slotId and status to a real boolean", () => {
    expect(validateBookingBody({ slotId: programId })).toBe(programId);
    expect(validateBookingStatusBody({ isActive: false })).toBe(false);
    expect(validateBookingStatusBody({ isActive: true })).toBe(true);
    for (const input of [{ slotId: programId, studentId: programId }, {}, null, { slotId: [] }]) expect(() => validateBookingBody(input)).toThrow();
    for (const input of [{ isActive: "false" }, { isActive: 0 }, { isActive: null }, {}, { isActive: true, slotsTaken: 0 }]) expect(() => validateBookingStatusBody(input)).toThrow();
  });
});
