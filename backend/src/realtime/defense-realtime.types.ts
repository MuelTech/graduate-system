/**
 * CDW-8A: canonical defense realtime contracts.
 *
 * These are transport-only invalidation signals. They must never carry
 * academic content (scores, recommendations, report/comment bodies, signature
 * evidence, document bytes, or storage paths). Authorized clients refetch the
 * authoritative REST state after receiving an event.
 */

export const DEFENSE_REALTIME_EVENT_NAMES = {
  defenseStarted: "defense.started",
  annotationCreated: "annotation.created",
  annotationCommentCreated: "annotation.comment.created",
  reportDraftUpdated: "report.draft.updated",
  evaluationFinalized: "evaluation.finalized",
  reportReadyForSignature: "report.ready_for_signature",
  rapSignatureRecorded: "rap.signature.recorded",
  rapFinalized: "rap.finalized",
  defenseConcluded: "defense.concluded",
} as const;

export type DefenseRealtimeEventName =
  (typeof DEFENSE_REALTIME_EVENT_NAMES)[keyof typeof DEFENSE_REALTIME_EVENT_NAMES];

/**
 * Event-specific metadata. `scheduleId` is always required; the shared
 * envelope fields (`eventId`, `occurredAt`) are generated server-side.
 */
export interface DefenseRealtimeEventPayloads {
  "defense.started": {
    scheduleId: string;
    sessionStatus: "IN_PROGRESS";
  };
  "annotation.created": {
    scheduleId: string;
    thesisDocumentId: string;
    annotationId: string;
  };
  "annotation.comment.created": {
    scheduleId: string;
    thesisDocumentId: string;
    annotationId: string;
    commentId: string;
  };
  "report.draft.updated": {
    scheduleId: string;
    reportId: string;
    bodyVersion: number;
  };
  "evaluation.finalized": {
    scheduleId: string;
  };
  "report.ready_for_signature": {
    scheduleId: string;
    reportId: string;
    contentVersion: number;
  };
  "rap.signature.recorded": {
    scheduleId: string;
    reportId: string;
    contentVersion: number;
  };
  "rap.finalized": {
    scheduleId: string;
    reportId: string;
    contentVersion: number;
  };
  "defense.concluded": {
    scheduleId: string;
    sessionStatus: "CONCLUDED";
  };
}

/**
 * Runtime allow-list used by the publisher to build payloads. Only these
 * metadata keys are copied onto the wire, so accidental private fields cannot
 * leak even if a future caller forces them into the input object.
 */
export const DEFENSE_REALTIME_EVENT_METADATA_KEYS: Record<
  DefenseRealtimeEventName,
  readonly string[]
> = {
  "defense.started": ["sessionStatus"],
  "annotation.created": ["thesisDocumentId", "annotationId"],
  "annotation.comment.created": [
    "thesisDocumentId",
    "annotationId",
    "commentId",
  ],
  "report.draft.updated": ["reportId", "bodyVersion"],
  "evaluation.finalized": [],
  "report.ready_for_signature": ["reportId", "contentVersion"],
  "rap.signature.recorded": ["reportId", "contentVersion"],
  "rap.finalized": ["reportId", "contentVersion"],
  "defense.concluded": ["sessionStatus"],
};

export interface DefenseRealtimeEventEnvelope {
  /** Server-generated UUID; transport tracing only. */
  eventId: string;
  scheduleId: string;
  /** Server-generated ISO timestamp. */
  occurredAt: string;
}

export type DefenseRealtimeEventFor<K extends DefenseRealtimeEventName> =
  DefenseRealtimeEventEnvelope & DefenseRealtimeEventPayloads[K];

export type DefenseRealtimeEvent = {
  [K in DefenseRealtimeEventName]: DefenseRealtimeEventFor<K>;
}[DefenseRealtimeEventName];

export const ACTIVE_DEFENSE_SESSION_STATUSES = [
  "SCHEDULED",
  "IN_PROGRESS",
  "AWAITING_CONCLUSION",
] as const;

export type ActiveDefenseSessionStatus =
  (typeof ACTIVE_DEFENSE_SESSION_STATUSES)[number];

export function isActiveDefenseSessionStatus(
  status: string,
): status is ActiveDefenseSessionStatus {
  return (ACTIVE_DEFENSE_SESSION_STATUSES as readonly string[]).includes(status);
}

export const DEFENSE_JOIN_EVENT = "defense:join";
export const DEFENSE_LEAVE_EVENT = "defense:leave";

export function defenseRoomName(scheduleId: string): string {
  return `defense:${scheduleId}`;
}

/**
 * Schedule ids are opaque identifiers. Reject empty/oversized/whitespace or
 * separator-bearing values before they reach Prisma or the room namespace.
 */
export function isValidDefenseScheduleId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 128 &&
    /^[A-Za-z0-9_-]+$/.test(value)
  );
}

export interface DefenseJoinPayload {
  scheduleId: string;
}

export type DefenseJoinDenialCode = "FORBIDDEN" | "NOT_ACTIVE" | "NOT_FOUND";

export type DefenseJoinAck =
  | { ok: true; room: string }
  | { ok: false; code: DefenseJoinDenialCode };

export type DefenseLeaveAck =
  | { ok: true }
  | { ok: false; code: "FORBIDDEN" };

export interface DefenseRealtimeIdentity {
  userId: string;
  role: string;
}

export interface DefenseRealtimeLogger {
  info(message: string, ...meta: unknown[]): void;
  error(message: string, ...meta: unknown[]): void;
}
