import type { DefenseRealtimeEventName } from "./defense-realtime.types";
import {
  defenseRoomName,
  isActiveDefenseSessionStatus,
  isValidDefenseScheduleId,
  type DefenseJoinAck,
} from "./defense-realtime.types";

/**
 * Narrow persistence port for realtime authorization. Keeping it explicit
 * makes the room rules testable without a live database and prevents the
 * transport layer from growing its own copy of academic business logic.
 */
export interface DefenseRealtimeAuthorizationStore {
  getSessionStatus(scheduleId: string): Promise<string | null>;
  hasPanelAssignment(scheduleId: string, userId: string): Promise<boolean>;
  listAssignedUserIds(
    scheduleId: string,
    userIds: readonly string[],
  ): Promise<ReadonlySet<string>>;
}

/**
 * Exact-current-assignment room authorization. Account role, thesis
 * membership, historical assignments, and client-provided roles are never
 * sufficient.
 */
export async function authorizeDefenseRoomJoin(
  store: DefenseRealtimeAuthorizationStore,
  scheduleId: unknown,
  userId: string,
): Promise<DefenseJoinAck> {
  if (!isValidDefenseScheduleId(scheduleId)) {
    return { ok: false, code: "NOT_FOUND" };
  }

  const sessionStatus = await store.getSessionStatus(scheduleId);
  if (sessionStatus === null) {
    return { ok: false, code: "NOT_FOUND" };
  }

  const assigned = await store.hasPanelAssignment(scheduleId, userId);
  if (!assigned) {
    return { ok: false, code: "FORBIDDEN" };
  }

  if (!isActiveDefenseSessionStatus(sessionStatus)) {
    return { ok: false, code: "NOT_ACTIVE" };
  }

  return { ok: true, room: defenseRoomName(scheduleId) };
}

export interface DefenseDeliveryAuthorization {
  deliver: boolean;
  authorizedUserIds: ReadonlySet<string>;
}

const DROPPED: DefenseDeliveryAuthorization = {
  deliver: false,
  authorizedUserIds: new Set<string>(),
};

/**
 * Revalidates the exact schedule and current assignments before a realtime
 * event is delivered. `defense.concluded` is the one event allowed after the
 * commit that moved the session to CONCLUDED (design §6.6); every other event
 * is dropped once the attempt is no longer active. CANCELLED never receives
 * realtime delivery. Callers must treat storage errors as fail-closed.
 */
export async function resolveDefenseDeliveryAuthorization(
  store: DefenseRealtimeAuthorizationStore,
  scheduleId: string,
  eventName: DefenseRealtimeEventName,
  connectedUserIds: readonly string[],
): Promise<DefenseDeliveryAuthorization> {
  const sessionStatus = await store.getSessionStatus(scheduleId);

  if (sessionStatus === null) {
    return DROPPED;
  }

  const deliverable =
    isActiveDefenseSessionStatus(sessionStatus) ||
    (eventName === "defense.concluded" && sessionStatus === "CONCLUDED");

  if (!deliverable) {
    return DROPPED;
  }

  const authorizedUserIds = await store.listAssignedUserIds(
    scheduleId,
    connectedUserIds,
  );

  return { deliver: true, authorizedUserIds };
}
