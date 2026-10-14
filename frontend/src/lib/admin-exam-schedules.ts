/**
 * UIUX-2H — Admin Entrance Exam Schedules presentation helpers (pure, no I/O).
 *
 * Entrance-exam date/time are WALL-CLOCK scheduling data, not arbitrary
 * timezone instants. Prisma stores `ExamSlot.examDate` as `@db.Date` and
 * `ExamSlot.examTime` as `@db.Time(0)`. The project's MariaDB driver adapter
 * (`@prisma/adapter-mariadb`) serializes both using their UTC components:
 *
 *   examDate -> "YYYY-MM-DDT00:00:00.000Z"        (e.g. 2026-10-15T00:00:00.000Z)
 *   examTime -> "1970-01-01THH:mm:00.000Z"        (e.g. 1970-01-01T09:00:00.000Z)
 *
 * This is confirmed by the backend adapter source (formatDate/formatTime read
 * getUTC* parts) and by the accepted exam detail test fixtures. These helpers
 * therefore read, format, edit, and submit date/time using the UTC components,
 * so the displayed wall-clock never shifts with the browser timezone.
 *
 * They create no academic state, eligibility, or mutation authority; the
 * backend remains authoritative. One shared schedule comparison feeds both the
 * Upcoming/Past filter and the Availability projection.
 */

const pad = (value: number) => String(value).padStart(2, "0");

interface WallClockParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
}

function parseParts(value: string | null | undefined): WallClockParts | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    hour: date.getUTCHours(),
    minute: date.getUTCMinutes(),
  };
}

/** `YYYY-MM-DD` value for an `<input type="date">`, from wall-clock parts. */
export function toDateInputValue(examDate: string | null | undefined): string {
  const parts = parseParts(examDate);
  if (!parts) return "";
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

/** `HH:mm` value for an `<input type="time">`, from wall-clock parts. */
export function toTimeInputValue(examTime: string | null | undefined): string {
  const parts = parseParts(examTime);
  if (!parts) return "";
  return `${pad(parts.hour)}:${pad(parts.minute)}`;
}

/** Stable human date label (e.g. "October 15, 2026"); never timezone-shifted. */
export function formatScheduleDate(examDate: string | null | undefined): string {
  const parts = parseParts(examDate);
  if (!parts) return "Date unavailable";
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).toLocaleDateString(
    undefined,
    { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" },
  );
}

/** Stable human time label (e.g. "9:00 AM"); never timezone-shifted. */
export function formatScheduleTime(examTime: string | null | undefined): string {
  const parts = parseParts(examTime);
  if (!parts) return "Time unavailable";
  return new Date(Date.UTC(1970, 0, 1, parts.hour, parts.minute)).toLocaleTimeString(
    undefined,
    { hour: "numeric", minute: "2-digit", timeZone: "UTC" },
  );
}

/* ------------------------------------------------------------- time compare */

/**
 * Reconstruct the schedule instant in a single pure wall-clock frame (UTC
 * parts). Returns null when the date/time cannot be interpreted.
 */
export function scheduleWallClockMs(
  examDate: string | null | undefined,
  examTime: string | null | undefined,
): number | null {
  const date = parseParts(examDate);
  const time = parseParts(examTime);
  if (!date || !time) return null;
  return Date.UTC(
    date.year,
    date.month - 1,
    date.day,
    time.hour,
    time.minute,
    0,
    0,
  );
}

/** Current wall-clock in the same frame (browser local clock). */
function nowWallClockMs(now: Date): number {
  return Date.UTC(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    now.getHours(),
    now.getMinutes(),
    0,
    0,
  );
}

/** True when the schedule wall-clock is before the current wall-clock. */
export function isPastExamSchedule(
  examDate: string | null | undefined,
  examTime: string | null | undefined,
  now: Date = new Date(),
): boolean {
  const scheduled = scheduleWallClockMs(examDate, examTime);
  if (scheduled === null) return false;
  return scheduled < nowWallClockMs(now);
}

/* ---------------------------------------------------------------- capacity */

export interface ExamCapacity {
  booked: number;
  maximum: number;
  available: number;
  isFull: boolean;
  percent: number;
  hasCapacity: boolean;
}

/** Capacity projection with guards against zero/negative/malformed values. */
export function resolveExamCapacity(
  slotsTaken: number,
  maxSlots: number,
): ExamCapacity {
  const booked =
    Number.isFinite(slotsTaken) && slotsTaken > 0 ? Math.trunc(slotsTaken) : 0;
  const maximum =
    Number.isFinite(maxSlots) && maxSlots > 0 ? Math.trunc(maxSlots) : 0;
  const hasCapacity = maximum > 0;
  const isFull = !hasCapacity || booked >= maximum;
  const available = hasCapacity ? Math.max(0, maximum - booked) : 0;
  const percent = hasCapacity
    ? Math.min(100, Math.round((booked / maximum) * 100))
    : 0;
  return { booked, maximum, available, isFull, percent, hasCapacity };
}

/* ------------------------------------------------------------ availability */

export type ExamScheduleAvailability = "OPEN" | "FULL" | "CLOSED" | "PAST";

export const EXAM_AVAILABILITY_LABEL: Record<
  ExamScheduleAvailability,
  string
> = {
  OPEN: "Open",
  FULL: "Full",
  CLOSED: "Closed",
  PAST: "Past",
};

type ScheduleSlotView = Pick<
  { examDate: string; examTime: string; isActive: boolean; slotsTaken: number; maxSlots: number },
  "examDate" | "examTime" | "isActive" | "slotsTaken" | "maxSlots"
>;

/**
 * User-facing availability. Past takes precedence over Open/Full; `isActive` is
 * never conflated with temporal state.
 */
export function resolveExamScheduleAvailability(
  slot: ScheduleSlotView,
  now: Date = new Date(),
): ExamScheduleAvailability {
  if (isPastExamSchedule(slot.examDate, slot.examTime, now)) return "PAST";
  if (!slot.isActive) return "CLOSED";
  return resolveExamCapacity(slot.slotsTaken, slot.maxSlots).isFull
    ? "FULL"
    : "OPEN";
}

/* ----------------------------------------------------------------- filters */

export type ExamTemporalFilter = "upcoming" | "past" | "all";
export type ExamAvailabilityFilter = "all" | "open" | "full" | "closed";

export function matchesTemporalFilter(
  slot: ScheduleSlotView,
  filter: ExamTemporalFilter,
  now: Date = new Date(),
): boolean {
  if (filter === "all") return true;
  const past = isPastExamSchedule(slot.examDate, slot.examTime, now);
  return filter === "past" ? past : !past;
}

export function matchesAvailabilityFilter(
  slot: ScheduleSlotView,
  filter: ExamAvailabilityFilter,
  now: Date = new Date(),
): boolean {
  if (filter === "all") return true;
  const availability = resolveExamScheduleAvailability(slot, now);
  switch (filter) {
    case "open":
      return availability === "OPEN";
    case "full":
      return availability === "FULL";
    case "closed":
      return availability === "CLOSED";
    default:
      return true;
  }
}

/* ----------------------------------------------------------------- payload */

/**
 * Submit payload matching the backend's wall-clock contract. The backend runs
 * `new Date(examDate)` and `new Date(examTime)`; the adapter then stores the
 * UTC date/time-of-day, so the admin's typed wall-clock round-trips exactly.
 */
export function toSchedulePayload(
  examDate: string,
  examTime: string,
): { examDate: string; examTime: string } {
  return {
    examDate,
    examTime: `1970-01-01T${examTime}:00.000Z`,
  };
}

/* -------------------------------------------------------------- validation */

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^\d{2}:\d{2}$/;

export interface ExamScheduleFormInput {
  programId: string;
  examDate: string;
  examTime: string;
  capacity: string;
}

export interface ExamScheduleFormErrors {
  programId?: string;
  examDate?: string;
  examTime?: string;
  capacity?: string;
}

export function validateExamScheduleForm(
  input: ExamScheduleFormInput,
  options: { bookedCount?: number } = {},
): ExamScheduleFormErrors {
  const errors: ExamScheduleFormErrors = {};
  const bookedCount = options.bookedCount ?? 0;

  if (!input.programId) errors.programId = "Select a program.";

  if (!input.examDate) errors.examDate = "Enter the exam date.";
  else if (!DATE_PATTERN.test(input.examDate))
    errors.examDate = "Enter a valid date.";

  if (!input.examTime) errors.examTime = "Enter the start time.";
  else if (!TIME_PATTERN.test(input.examTime))
    errors.examTime = "Enter a valid time.";

  const capacity = Number(input.capacity);
  if (!input.capacity.trim()) {
    errors.capacity = "Enter the capacity.";
  } else if (!Number.isInteger(capacity) || capacity <= 0) {
    errors.capacity = "Capacity must be a whole number greater than zero.";
  } else if (bookedCount > 0 && capacity < bookedCount) {
    errors.capacity = `Capacity can't be less than the ${bookedCount} booked applicant${
      bookedCount === 1 ? "" : "s"
    }.`;
  }

  return errors;
}

export function hasFormErrors(errors: ExamScheduleFormErrors): boolean {
  return Object.keys(errors).length > 0;
}

/* -------------------------------------------------------------- pagination */

/** Windowed page numbers (mirrors the accepted Admin list pagination). */
export function paginationWindow(
  current: number,
  totalPages: number,
  size = 5,
): number[] {
  if (totalPages <= size)
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  if (current <= 3) return Array.from({ length: size }, (_, index) => index + 1);
  if (current >= totalPages - 2)
    return Array.from({ length: size }, (_, index) => totalPages - size + 1 + index);
  return Array.from({ length: size }, (_, index) => current - 2 + index);
}
