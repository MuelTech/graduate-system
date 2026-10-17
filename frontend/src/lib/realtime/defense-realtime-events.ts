/**
 * CDW-8B — canonical frontend defense realtime contracts and invalidation
 * mapping. Framework-free so the mapping can be verified in Node.
 *
 * Events are invalidation hints only. They are parsed/sanitized at the boundary
 * and never written into the React Query cache as academic state.
 */

export const DEFENSE_REALTIME_EVENT_NAMES = [
  "defense.started",
  "annotation.created",
  "annotation.comment.created",
  "report.draft.updated",
  "evaluation.finalized",
  "report.ready_for_signature",
  "rap.signature.recorded",
  "rap.finalized",
  "defense.concluded",
] as const;

export type DefenseRealtimeEventName =
  (typeof DEFENSE_REALTIME_EVENT_NAMES)[number];

export const DEFENSE_REALTIME_ACTIVE_STATUSES = [
  "SCHEDULED",
  "IN_PROGRESS",
  "AWAITING_CONCLUSION",
] as const;

export function isDefenseRealtimeActiveStatus(status: unknown): boolean {
  return (
    typeof status === "string" &&
    (DEFENSE_REALTIME_ACTIVE_STATUSES as readonly string[]).includes(status)
  );
}

export interface DefenseRealtimeEventBase {
  eventName: DefenseRealtimeEventName;
  eventId: string;
  scheduleId: string;
  occurredAt: string;
}

export type DefenseRealtimeEvent =
  | (DefenseRealtimeEventBase & {
      eventName: "defense.started";
      sessionStatus: "IN_PROGRESS";
    })
  | (DefenseRealtimeEventBase & {
      eventName: "annotation.created";
      thesisDocumentId: string;
      annotationId: string;
    })
  | (DefenseRealtimeEventBase & {
      eventName: "annotation.comment.created";
      thesisDocumentId: string;
      annotationId: string;
      commentId: string;
    })
  | (DefenseRealtimeEventBase & {
      eventName: "report.draft.updated";
      reportId: string;
      bodyVersion: number;
    })
  | (DefenseRealtimeEventBase & { eventName: "evaluation.finalized" })
  | (DefenseRealtimeEventBase & {
      eventName: "report.ready_for_signature";
      reportId: string;
      contentVersion: number;
    })
  | (DefenseRealtimeEventBase & {
      eventName: "rap.signature.recorded";
      reportId: string;
      contentVersion: number;
    })
  | (DefenseRealtimeEventBase & {
      eventName: "rap.finalized";
      reportId: string;
      contentVersion: number;
    })
  | (DefenseRealtimeEventBase & {
      eventName: "defense.concluded";
      sessionStatus: "CONCLUDED";
    });

export type DefenseQueryTarget =
  | { target: "workspace" }
  | { target: "annotations"; documentId: string }
  | { target: "committeeReport" }
  | { target: "oralEvaluation" }
  | { target: "conclusionReadiness" };

export type DefenseJoinDenialCode = "FORBIDDEN" | "NOT_ACTIVE" | "NOT_FOUND";

export type DefenseJoinAck =
  | { ok: true; room: string }
  | { ok: false; code: DefenseJoinDenialCode };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isEventName(value: unknown): value is DefenseRealtimeEventName {
  return (
    typeof value === "string" &&
    (DEFENSE_REALTIME_EVENT_NAMES as readonly string[]).includes(value)
  );
}

/**
 * Parses and sanitizes an incoming socket payload. Only documented envelope
 * and metadata fields survive; any accidental private content is dropped.
 */
export function parseDefenseRealtimeEvent(
  eventName: unknown,
  payload: unknown,
): DefenseRealtimeEvent | null {
  if (!isEventName(eventName) || !isRecord(payload)) {
    return null;
  }

  const { eventId, scheduleId, occurredAt } = payload;
  if (
    !isNonEmptyString(eventId) ||
    !isNonEmptyString(scheduleId) ||
    !isNonEmptyString(occurredAt)
  ) {
    return null;
  }

  const envelope = { eventId, scheduleId, occurredAt };

  switch (eventName) {
    case "defense.started":
      if (payload.sessionStatus !== "IN_PROGRESS") return null;
      return { eventName, ...envelope, sessionStatus: "IN_PROGRESS" };

    case "annotation.created":
      if (
        !isNonEmptyString(payload.thesisDocumentId) ||
        !isNonEmptyString(payload.annotationId)
      ) {
        return null;
      }
      return {
        eventName,
        ...envelope,
        thesisDocumentId: payload.thesisDocumentId,
        annotationId: payload.annotationId,
      };

    case "annotation.comment.created":
      if (
        !isNonEmptyString(payload.thesisDocumentId) ||
        !isNonEmptyString(payload.annotationId) ||
        !isNonEmptyString(payload.commentId)
      ) {
        return null;
      }
      return {
        eventName,
        ...envelope,
        thesisDocumentId: payload.thesisDocumentId,
        annotationId: payload.annotationId,
        commentId: payload.commentId,
      };

    case "report.draft.updated":
      if (
        !isNonEmptyString(payload.reportId) ||
        !isFiniteNumber(payload.bodyVersion)
      ) {
        return null;
      }
      return {
        eventName,
        ...envelope,
        reportId: payload.reportId,
        bodyVersion: payload.bodyVersion,
      };

    case "evaluation.finalized":
      return { eventName, ...envelope };

    case "report.ready_for_signature":
      if (
        !isNonEmptyString(payload.reportId) ||
        !isFiniteNumber(payload.contentVersion)
      ) {
        return null;
      }
      return {
        eventName,
        ...envelope,
        reportId: payload.reportId,
        contentVersion: payload.contentVersion,
      };

    case "rap.signature.recorded":
      if (
        !isNonEmptyString(payload.reportId) ||
        !isFiniteNumber(payload.contentVersion)
      ) {
        return null;
      }
      return {
        eventName,
        ...envelope,
        reportId: payload.reportId,
        contentVersion: payload.contentVersion,
      };

    case "rap.finalized":
      if (
        !isNonEmptyString(payload.reportId) ||
        !isFiniteNumber(payload.contentVersion)
      ) {
        return null;
      }
      return {
        eventName,
        ...envelope,
        reportId: payload.reportId,
        contentVersion: payload.contentVersion,
      };

    case "defense.concluded":
      if (payload.sessionStatus !== "CONCLUDED") return null;
      return { eventName, ...envelope, sessionStatus: "CONCLUDED" };
  }
}

/**
 * One pure event -> query-target mapping. The hook resolves targets to the
 * exact existing React Query keys (including `annotationsQueryKey`).
 */
export function queryTargetsForDefenseRealtimeEvent(
  event: DefenseRealtimeEvent,
): DefenseQueryTarget[] {
  switch (event.eventName) {
    case "defense.started":
      return [{ target: "workspace" }, { target: "oralEvaluation" }];

    case "annotation.created":
    case "annotation.comment.created":
      return [{ target: "annotations", documentId: event.thesisDocumentId }];

    case "report.draft.updated":
      return [{ target: "committeeReport" }];

    case "evaluation.finalized":
      return [
        { target: "workspace" },
        { target: "committeeReport" },
        { target: "conclusionReadiness" },
      ];

    case "report.ready_for_signature":
    case "rap.signature.recorded":
    case "rap.finalized":
      return [
        { target: "committeeReport" },
        { target: "workspace" },
        { target: "conclusionReadiness" },
      ];

    case "defense.concluded":
      return [
        { target: "workspace" },
        { target: "committeeReport" },
        { target: "conclusionReadiness" },
      ];
  }
}

/** Ignore events for a different attempt before any invalidation occurs. */
export function targetsForMountedSchedule(
  event: DefenseRealtimeEvent,
  mountedScheduleId: string,
): DefenseQueryTarget[] {
  if (event.scheduleId !== mountedScheduleId) {
    return [];
  }
  return queryTargetsForDefenseRealtimeEvent(event);
}

/** Authoritative refetch set after a successful join/reconnect. */
export function convergenceQueryTargets(options: {
  documentId?: string | null;
}): DefenseQueryTarget[] {
  const targets: DefenseQueryTarget[] = [{ target: "workspace" }];

  if (options.documentId) {
    targets.push({ target: "annotations", documentId: options.documentId });
  }

  targets.push(
    { target: "committeeReport" },
    { target: "conclusionReadiness" },
    { target: "oralEvaluation" },
  );

  return targets;
}

export function parseDefenseJoinAck(value: unknown): DefenseJoinAck {
  if (!isRecord(value)) {
    return { ok: false, code: "FORBIDDEN" };
  }

  if (value.ok === true && isNonEmptyString(value.room)) {
    return { ok: true, room: value.room };
  }

  if (
    value.ok === false &&
    (value.code === "FORBIDDEN" ||
      value.code === "NOT_ACTIVE" ||
      value.code === "NOT_FOUND")
  ) {
    return { ok: false, code: value.code };
  }

  return { ok: false, code: "FORBIDDEN" };
}
