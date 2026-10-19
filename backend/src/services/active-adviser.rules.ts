import { AppError } from "../utils/AppError";

/**
 * ADV-1 — canonical active-Adviser resolution.
 *
 * The Student's active `AdviserAssignment` is the current Adviser authority.
 * `ThesisRecord.assignmentId` is legacy/compatibility linkage only.
 *
 * Invalid data must never be resolved by "latest wins": zero active rows mean
 * no Adviser, exactly one is authoritative, and more than one fails closed.
 */

export type ActiveAdviserAssignmentLike = {
  id: string;
  adviserId: string;
};

export type ActiveAdviserResolution<T extends ActiveAdviserAssignmentLike> =
  | { status: "NONE"; assignment: null }
  | { status: "ACTIVE"; assignment: T }
  | { status: "CONFLICT"; assignment: null; count: number };

/**
 * Resolve already-active AdviserAssignment rows. Callers must query with
 * `isActive: true`; this function intentionally does not re-filter so the
 * invariant lives in one place for both read models and mutations.
 */
export function resolveSingleActiveAdviser<
  T extends ActiveAdviserAssignmentLike,
>(rows: readonly T[] | null | undefined): ActiveAdviserResolution<T> {
  const active = rows ?? [];
  if (active.length === 0) {
    return { status: "NONE", assignment: null };
  }
  if (active.length > 1) {
    return { status: "CONFLICT", assignment: null, count: active.length };
  }
  return { status: "ACTIVE", assignment: active[0] };
}

/** Business-facing message used when invalid duplicate active advisers exist. */
export const MULTIPLE_ACTIVE_ADVISERS_MESSAGE =
  "More than one active adviser is recorded for this student. Correct the active adviser before scheduling.";

/**
 * Mutation-time variant: returns zero/one row, or throws a deterministic
 * conflict instead of silently choosing an arbitrary Adviser.
 */
export function requireSingleActiveAdviser<
  T extends ActiveAdviserAssignmentLike,
>(rows: readonly T[] | null | undefined): T | null {
  const resolution = resolveSingleActiveAdviser(rows);
  if (resolution.status === "CONFLICT") {
    throw new AppError(MULTIPLE_ACTIVE_ADVISERS_MESSAGE, 409);
  }
  return resolution.assignment;
}
