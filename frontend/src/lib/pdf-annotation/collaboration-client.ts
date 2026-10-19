/**
 * CDW-3 — framework-free collaboration client primitives.
 *
 * Pure helpers (no React) that back the production Student Document
 * collaboration: the shared React Query key/url for the exact attempt document,
 * role/state gating, polling policy, comment validation, safe error messages,
 * role labels, and a deterministic timestamp formatter.
 *
 * Keeping these out of components means they are unit-testable in Node and the
 * React layer stays a thin composition.
 */

/** Shared React Query root key. One logical source per (schedule, document). */
export const DEFENSE_ANNOTATIONS_QUERY_KEY = "defenseAnnotations" as const;

/** Modest polling cadence while collaboration is active (no Socket.IO yet). */
export const COLLAB_POLL_INTERVAL_MS = 15000 as const;

/** Mirrors the backend comment body limit. */
export const MAX_COMMENT_LENGTH = 5000 as const;

/** Roles that may create a manuscript annotation/highlight (backend authority). */
export const ANNOTATION_WRITE_ROLES = ["CHAIRMAN", "PANELIST"] as const;

/** Roles that may comment/reply on existing threads (backend authority). */
export const COMMENT_WRITE_ROLES = ["CHAIRMAN", "PANELIST", "RAPPORTEUR"] as const;

/** RAP statuses that lock the collaboration layer (report frozen/finalized). */
export const FROZEN_RAP_STATUSES = [
  "FOR_SIGNATURE",
  "PARTIALLY_SIGNED",
  "ALL_SIGNED",
  "DISTRIBUTED",
  "FINALIZED",
] as const;

/** Defense session statuses during which collaboration writes are open. */
export const COLLABORATION_ACTIVE_STATUSES = [
  "SCHEDULED",
  "IN_PROGRESS",
  "AWAITING_CONCLUSION",
] as const;

export function annotationsQueryKey(
  scheduleId: string,
  documentId: string,
): readonly [string, string, string] {
  return [DEFENSE_ANNOTATIONS_QUERY_KEY, scheduleId, documentId];
}

export function defenseAnnotationsUrl(scheduleId: string, documentId: string): string {
  return `/thesis/defense/${encodeURIComponent(scheduleId)}/collaboration/annotations?documentId=${encodeURIComponent(
    documentId,
  )}`;
}

export function canAnnotateRole(role: string | null | undefined): boolean {
  return (ANNOTATION_WRITE_ROLES as readonly string[]).includes(String(role ?? ""));
}

export function canCommentRole(role: string | null | undefined): boolean {
  return (COMMENT_WRITE_ROLES as readonly string[]).includes(String(role ?? ""));
}

/**
 * Whether the collaboration layer is writable: an active session status AND a
 * non-frozen report. The backend remains the authority; this drives UX only.
 */
export function isCollaborationActive(
  sessionStatus: string | null | undefined,
  rapStatus: string | null | undefined,
): boolean {
  const status = String(sessionStatus ?? "");
  if (!(COLLABORATION_ACTIVE_STATUSES as readonly string[]).includes(status)) {
    return false;
  }
  return !(FROZEN_RAP_STATUSES as readonly string[]).includes(String(rapStatus ?? ""));
}

/** Poll only while collaboration is active; otherwise disable. */
export function collaborationPollIntervalMs(
  sessionStatus: string | null | undefined,
  rapStatus: string | null | undefined,
): number | false {
  return isCollaborationActive(sessionStatus, rapStatus) ? COLLAB_POLL_INTERVAL_MS : false;
}

export type CommentInputResult =
  | { ok: true; body: string }
  | { ok: false; error: string };

/** Trim + validate a comment body before submit (blank and length). */
export function normalizeCommentInput(value: unknown): CommentInputResult {
  if (typeof value !== "string") {
    return { ok: false, error: "Comment body is required." };
  }
  const body = value.trim();
  if (!body) {
    return { ok: false, error: "Comment body is required." };
  }
  if (body.length > MAX_COMMENT_LENGTH) {
    return {
      ok: false,
      error: `Comment is too long (maximum ${MAX_COMMENT_LENGTH} characters).`,
    };
  }
  return { ok: true, body };
}

function errorStatus(error: unknown): number | null {
  if (typeof error !== "object" || error === null) return null;
  const record = error as { statusCode?: unknown; status?: unknown };
  const value = typeof record.statusCode === "number" ? record.statusCode : record.status;
  return typeof value === "number" ? value : null;
}

/**
 * Map a mutation failure to a safe, user-facing message. Never surfaces raw
 * backend/Prisma text.
 */
export function collaborationErrorMessage(error: unknown): string {
  switch (errorStatus(error)) {
    case 409:
      return "The defense state changed and collaboration may be closed. Refreshing the latest comments.";
    case 403:
      return "You do not have permission to add comments to this defense.";
    case 400:
      return "That comment could not be saved. Check the text and try again.";
    case 404:
      return "This defense document is no longer available.";
    default:
      return "The comment could not be saved. Please try again.";
  }
}

const ROLE_LABELS: Record<string, string> = {
  CHAIRMAN: "Chairman",
  PANELIST: "Panelist",
  RAPPORTEUR: "Rapporteur",
  ADVISER: "Adviser",
  FACILITATOR: "Facilitator",
};

/** Human-readable defense role label (never derived from the account role). */
export function defenseRoleLabel(role: string | null | undefined): string {
  const key = String(role ?? "");
  return ROLE_LABELS[key] ?? key;
}

/**
 * Comment timestamp formatter. Uses the same browser-LOCAL timezone convention as
 * the rest of the authenticated frontend (never a silently-UTC rendering, which
 * would read eight hours early for EARIST users). Timestamps are only rendered
 * client-side (after the React Query fetch), so this stays hydration-safe.
 */
export function formatCommentTimestamp(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}
