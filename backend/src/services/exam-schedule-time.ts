import { AppError } from "../utils/AppError";

/** DATE/TIME storage contains wall-clock components, never an encoded instant. */
export const EXAM_SCHEDULE_TIMEZONE = "Asia/Manila";
const clock = new Intl.DateTimeFormat("en-GB", {
  timeZone: EXAM_SCHEDULE_TIMEZONE, calendar: "gregory", numberingSystem: "latn",
  year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
});

export function parseScheduleDate(value: unknown): Date {
  if (typeof value !== "string" || !/^[1-9]\d{3}-\d{2}-\d{2}$/.test(value)) {
    throw new AppError("examDate must be a date-only YYYY-MM-DD value in the database date range.", 400);
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new AppError("examDate must be a valid calendar date.", 400);
  }
  return date;
}

/** Exact accepted UIUX-2H payload; no local-time or offset-bearing alternatives. */
export function parseScheduleTime(value: unknown): Date {
  if (typeof value !== "string" || !/^1970-01-01T(?:[01]\d|2[0-3]):[0-5]\d:00\.000Z$/.test(value)) {
    throw new AppError("examTime must use the wall-clock payload 1970-01-01THH:mm:00.000Z.", 400);
  }
  return new Date(value);
}

/** Interpret stored UTC components in the institutional zone using Intl's zone data. */
export function scheduleStartInstant(examDate: Date, examTime: Date): Date {
  if (!(examDate instanceof Date) || !(examTime instanceof Date) ||
      !Number.isFinite(examDate.getTime()) || !Number.isFinite(examTime.getTime())) {
    throw new AppError("Schedule time cannot be interpreted safely; owner review is required.", 409);
  }
  // Revalidate storage rather than normalizing unsupported legacy values.
  let date: Date, time: Date;
  try {
    date = parseScheduleDate(examDate.toISOString().slice(0, 10));
    time = parseScheduleTime(examTime.toISOString());
    if (date.getTime() !== examDate.getTime()) throw new Error("Non-date storage value");
  } catch {
    throw new AppError("Schedule time cannot be interpreted safely; owner review is required.", 409);
  }
  const wall = date.getTime() + time.getTime();
  let instant = wall;
  for (let step = 0; step < 3; step++) {
    const parts = Object.fromEntries(clock.formatToParts(new Date(instant)).map(p => [p.type, p.value]));
    const projected = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day),
      Number(parts.hour), Number(parts.minute), Number(parts.second));
    if (projected === wall) return new Date(instant);
    instant += wall - projected;
  }
  throw new AppError("Schedule time cannot be interpreted safely; owner review is required.", 409);
}

export function requireFutureSchedule(examDate: Date, examTime: Date, now = new Date()): void {
  if (scheduleStartInstant(examDate, examTime).getTime() <= now.getTime()) {
    throw new AppError("The schedule start must still be in the future (Asia/Manila).", 409);
  }
}

export function manilaCalendarDate(now = new Date()): string {
  const parts = Object.fromEntries(clock.formatToParts(now).map(p => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/** Admin assignment alone admits earlier wall clocks, on today's Manila date. */
export function requireSameDaySchedule(examDate: Date, examTime: Date, now = new Date()): void {
  scheduleStartInstant(examDate, examTime); // Validate stored values without repair.
  if (examDate.toISOString().slice(0, 10) !== manilaCalendarDate(now)) {
    throw new AppError("Choose a schedule for today's date (Asia/Manila).", 409);
  }
}
