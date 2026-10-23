/**
 * Shared display formatting for official defense documents. These helpers only
 * format already-authoritative values; they never infer or recalculate academic
 * data. Date output uses UTC so persisted instants render deterministically.
 */
import { AppError } from "../utils/AppError";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export function formatOfficialFormDate(value: string | null | undefined): string {
  if (!value) {
    throw new AppError(
      "The defense date is missing from the official record.",
      422,
    );
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new AppError(
      "The defense date on the official record is invalid.",
      422,
    );
  }
  return `${parsed.getUTCDate()} ${MONTH_NAMES[parsed.getUTCMonth()]} ${parsed.getUTCFullYear()}`;
}

/**
 * Format a stored wall-clock time (MySQL TIME represented by Prisma as a Date
 * anchored at 1970-01-01 UTC). UTC components preserve the Admin-entered hour
 * and minute; no local-timezone or timezone-instant conversion is performed.
 */
export function formatOfficialFormTime(
  value: Date | string | null | undefined,
): string {
  if (!value) {
    throw new AppError(
      "The defense time is missing from the official record.",
      422,
    );
  }
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new AppError(
      "The defense time on the official record is invalid.",
      422,
    );
  }
  const hours24 = parsed.getUTCHours();
  const minutes = String(parsed.getUTCMinutes()).padStart(2, "0");
  const period = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${minutes} ${period}`;
}

/**
 * Asia/Manila presentation for a real application-submission instant. The
 * Philippines has a fixed UTC+8 offset and no daylight saving, so a fixed
 * offset keeps output deterministic regardless of the server timezone.
 */
const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;

function manilaParts(value: Date | string): {
  year: number;
  month: number;
  day: number;
  hours: number;
  minutes: number;
} {
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new AppError(
      "The application submission timestamp on the official record is invalid.",
      422,
    );
  }
  const shifted = new Date(parsed.getTime() + MANILA_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
    hours: shifted.getUTCHours(),
    minutes: shifted.getUTCMinutes(),
  };
}

export function formatOfficialApplicationDate(
  value: Date | string | null | undefined,
): string {
  if (!value) return "";
  const parts = manilaParts(value);
  return `${parts.day} ${MONTH_NAMES[parts.month]} ${parts.year}`;
}

export function formatOfficialApplicationDateTime(
  value: Date | string | null | undefined,
): string {
  if (!value) return "";
  const parts = manilaParts(value);
  const period = parts.hours >= 12 ? "PM" : "AM";
  const hours12 = parts.hours % 12 === 0 ? 12 : parts.hours % 12;
  return `${formatOfficialApplicationDate(value)}, ${hours12}:${String(
    parts.minutes,
  ).padStart(2, "0")} ${period}`;
}
