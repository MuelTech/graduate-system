/**
 * FIX-4 — canonical academic numeric rounding.
 *
 * Official institutional averages are persisted and snapshotted at exactly two
 * decimal places. Binary floating-point `toFixed` is not sufficient for exact
 * midpoint values such as 1.225, so all academic means are computed with
 * Prisma's decimal.js implementation and rounded once, half-up, at the end.
 */
import { Prisma } from "@prisma/client";

export const ACADEMIC_DECIMAL_PLACES = 2;

const ACADEMIC_ROUNDING = Prisma.Decimal.ROUND_HALF_UP;

function toFiniteDecimal(value: unknown): Prisma.Decimal | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  if (typeof value === "number" && !Number.isFinite(value)) return null;

  try {
    const decimal = new Prisma.Decimal(String(value));
    return decimal.isFinite() ? decimal : null;
  } catch {
    return null;
  }
}

/** Round a single academic value to two decimal places, half-up. */
export function roundAcademicValue(value: unknown): number | null {
  const decimal = toFiniteDecimal(value);
  if (!decimal) return null;
  return Number(
    decimal
      .toDecimalPlaces(ACADEMIC_DECIMAL_PLACES, ACADEMIC_ROUNDING)
      .toString(),
  );
}

/**
 * Arithmetic mean of academic values, rounded once to two decimal places.
 * Returns null if any input is missing/non-finite so callers can fail closed
 * instead of silently substituting zero.
 */
export function meanAcademicValues(values: readonly unknown[]): number | null {
  if (values.length === 0) return null;

  let sum = new Prisma.Decimal(0);
  for (const value of values) {
    const decimal = toFiniteDecimal(value);
    if (!decimal) return null;
    sum = sum.plus(decimal);
  }

  return Number(
    sum
      .dividedBy(values.length)
      .toDecimalPlaces(ACADEMIC_DECIMAL_PLACES, ACADEMIC_ROUNDING)
      .toString(),
  );
}
