/**
 * CDW-LIVE-1A — viewer-side ephemeral report preview boundary.
 *
 * Preview bodies live only in component/workspace state. They are never written
 * into the authoritative React Query report cache and never become the saved
 * DRAFT by arrival alone.
 */

import {
  normalizeReportDocument,
  type ReportDocument,
} from "../report/report-document.ts";
import type { DefenseRealtimeEventName } from "./defense-realtime-events.ts";

export const REPORT_PREVIEW_EVENT = "report:preview" as const;

/** Matches the server/transport bound (Express default JSON body limit). */
export const REPORT_PREVIEW_MAX_BYTES = 100 * 1024;

const PREVIEW_RENDERABLE_STATUSES = ["DRAFT", "NOT_CREATED"] as const;

export interface LiveReportPreview {
  scheduleId: string;
  baseBodyVersion: number;
  previewSequence: number;
  senderUserId: string;
  body: ReportDocument;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSafeNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isValidScheduleId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 128 &&
    /^[A-Za-z0-9_-]+$/.test(value)
  );
}

function isReportBodyShape(value: unknown): value is ReportDocument {
  return (
    isRecord(value) &&
    value.type === "doc" &&
    Array.isArray(value.content)
  );
}

export function parseLiveReportPreview(payload: unknown): LiveReportPreview | null {
  if (!isRecord(payload)) return null;

  const { scheduleId, baseBodyVersion, previewSequence, senderUserId, body } = payload;

  if (!isValidScheduleId(scheduleId)) return null;
  if (!isSafeNonNegativeInteger(baseBodyVersion)) return null;
  if (!isSafeNonNegativeInteger(previewSequence)) return null;
  if (typeof senderUserId !== "string" || senderUserId.length === 0) return null;
  if (!isReportBodyShape(body)) return null;

  let serialized: string;
  try {
    serialized = JSON.stringify(body);
  } catch {
    return null;
  }
  if (serialized.length > REPORT_PREVIEW_MAX_BYTES) return null;

  return {
    scheduleId,
    baseBodyVersion,
    previewSequence,
    senderUserId,
    body: normalizeReportDocument(body),
  };
}

/**
 * Ordering is scoped to one sender session. A replacement Rapporteur starts a
 * new stream even when its local sequence restarts.
 */
export function isNewerLiveReportPreview(
  previous: LiveReportPreview | null,
  incoming: LiveReportPreview,
): boolean {
  if (!previous) return true;
  if (previous.senderUserId !== incoming.senderUserId) return true;
  return incoming.previewSequence > previous.previewSequence;
}

export interface LiveReportPreviewDisplayInput {
  preview: LiveReportPreview | null;
  scheduleId: string;
  reportStatus: string;
  authoritativeBodyVersion: number;
}

export type ReportPreviewEventDisposition = "keep" | "clear";

/**
 * A persisted save must NOT clear the ephemeral preview by itself. The viewer
 * keeps the preview until the authoritative REST bodyVersion catches up; the
 * display gate then hides it naturally. Freeze/sign/final/conclusion events do
 * clear immediately because the report can never return to an editable DRAFT.
 */
export function reportPreviewDispositionForEvent(
  eventName: DefenseRealtimeEventName,
): ReportPreviewEventDisposition {
  switch (eventName) {
    case "report.ready_for_signature":
    case "rap.signature.recorded":
    case "rap.finalized":
    case "defense.concluded":
      return "clear";
    default:
      return "keep";
  }
}

/**
 * A preview is displayable only while the report is still editable and the
 * authoritative saved body has not advanced past the preview's base version.
 */
export function shouldDisplayLiveReportPreview(
  input: LiveReportPreviewDisplayInput,
): boolean {
  const { preview, scheduleId, reportStatus, authoritativeBodyVersion } = input;

  if (!preview) return false;
  if (preview.scheduleId !== scheduleId) return false;
  if (
    !(PREVIEW_RENDERABLE_STATUSES as readonly string[]).includes(reportStatus)
  ) {
    return false;
  }
  if (!isSafeNonNegativeInteger(authoritativeBodyVersion)) return false;

  return authoritativeBodyVersion <= preview.baseBodyVersion;
}
