/**
 * CDW-LIVE-1A — authorization for the ephemeral `report:preview` transport.
 *
 * This module deliberately reuses the shared report-edit authority rule and a
 * narrow persistence port. It does not duplicate academic write logic and never
 * trusts client-supplied identity or role.
 */

import { isReportBodyEditable } from "../services/report-edit-authority.rules";
import {
  isActiveDefenseSessionStatus,
  isValidDefenseScheduleId,
} from "./defense-realtime.types";

export interface ReportPreviewSenderState {
  sessionStatus: string;
  role: string | null;
  rapStatus: string | null;
  rapFrozenAt: Date | string | null;
}

export interface DefenseReportPreviewStore {
  getSessionStatus(scheduleId: string): Promise<string | null>;
  listAssignedUserIds(
    scheduleId: string,
    userIds: readonly string[],
  ): Promise<ReadonlySet<string>>;
  getReportPreviewSenderState(
    scheduleId: string,
    userId: string,
  ): Promise<ReportPreviewSenderState | null>;
}

export type ReportPreviewSenderAuthorization =
  | { ok: true }
  | { ok: false; code: "FORBIDDEN" | "NOT_ACTIVE" };

/**
 * Every preview is authorized against the exact current assignment and the
 * same editability rule as the REST draft. A removed/replaced Rapporteur fails
 * here on the next message, even if the socket still believes it is joined.
 */
export async function authorizeDefenseReportPreviewSender(
  store: DefenseReportPreviewStore,
  scheduleId: unknown,
  userId: string,
): Promise<ReportPreviewSenderAuthorization> {
  if (!isValidDefenseScheduleId(scheduleId)) {
    return { ok: false, code: "FORBIDDEN" };
  }

  const state = await store.getReportPreviewSenderState(scheduleId, userId);
  if (!state) {
    return { ok: false, code: "FORBIDDEN" };
  }

  if (!isActiveDefenseSessionStatus(String(state.sessionStatus))) {
    return { ok: false, code: "NOT_ACTIVE" };
  }

  if (
    !isReportBodyEditable({
      sessionStatus: String(state.sessionStatus),
      role: state.role,
      rapStatus: state.rapStatus,
      rapFrozenAt: state.rapFrozenAt,
    })
  ) {
    return { ok: false, code: "FORBIDDEN" };
  }

  return { ok: true };
}

export interface ReportPreviewDeliveryAuthorization {
  deliver: boolean;
  authorizedUserIds: ReadonlySet<string>;
}

/**
 * Revalidate recipients immediately before delivery. Frozen/concluded/cancelled
 * attempts never receive a preview, and only exact current assignments survive.
 */
export async function resolveDefenseReportPreviewDelivery(
  store: DefenseReportPreviewStore,
  scheduleId: string,
  connectedUserIds: readonly string[],
): Promise<ReportPreviewDeliveryAuthorization> {
  const dropped: ReportPreviewDeliveryAuthorization = {
    deliver: false,
    authorizedUserIds: new Set<string>(),
  };

  if (!isValidDefenseScheduleId(scheduleId)) {
    return dropped;
  }

  const sessionStatus = await store.getSessionStatus(scheduleId);
  if (sessionStatus === null || !isActiveDefenseSessionStatus(sessionStatus)) {
    return dropped;
  }

  const authorizedUserIds = await store.listAssignedUserIds(
    scheduleId,
    connectedUserIds,
  );

  return { deliver: true, authorizedUserIds };
}
