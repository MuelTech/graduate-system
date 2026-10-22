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
