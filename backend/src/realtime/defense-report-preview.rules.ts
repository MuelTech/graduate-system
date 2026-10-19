/**
 * CDW-LIVE-1A — ephemeral Rapporteur report preview transport contract.
 *
 * `report:preview` is NOT a tenth CDW-8 persisted-domain event. It never enters
 * the post-commit publisher, never writes the database, and is never replayed.
 * The server validates the same bounded ReportDocument model used by the
 * authoritative REST draft before relaying it to authorized viewers.
 */

import {
  type CanonicalReportDocument,
  canonicalizeReportDocument,
  validateReportDocument,
} from "../services/report-body.rules";
import { isValidDefenseScheduleId } from "./defense-realtime.types";

export const DEFENSE_REPORT_PREVIEW_EVENT = "report:preview" as const;

/**
 * Match the Express default JSON body limit used by the authoritative REST
 * report endpoint (100 KiB). A preview must never be allowed to carry more than
 * the saved draft path can accept.
 */
export const DEFENSE_REPORT_PREVIEW_MAX_BYTES = 100 * 1024;

export interface DefenseReportPreview {
  scheduleId: string;
  baseBodyVersion: number;
  previewSequence: number;
  body: CanonicalReportDocument;
}

/**
 * Server-generated delivery shape. `senderUserId` is attached from the
 * authenticated socket identity (never trusted from client payload) so viewers
 * can distinguish a replacement Rapporteur's new preview sequence.
 */
export interface DefenseReportPreviewDelivery extends DefenseReportPreview {
  senderUserId: string;
}

export type DefenseReportPreviewParseResult =
  | { ok: true; preview: DefenseReportPreview }
  | { ok: false; code: "INVALID" };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSafeNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

export function parseDefenseReportPreviewPayload(
  input: unknown,
): DefenseReportPreviewParseResult {
  if (!isPlainObject(input)) {
    return { ok: false, code: "INVALID" };
  }

  const { scheduleId, baseBodyVersion, previewSequence, body } = input;

  if (!isValidDefenseScheduleId(scheduleId)) {
    return { ok: false, code: "INVALID" };
  }
  if (!isSafeNonNegativeInteger(baseBodyVersion)) {
    return { ok: false, code: "INVALID" };
  }
  if (!isSafeNonNegativeInteger(previewSequence)) {
    return { ok: false, code: "INVALID" };
  }

  const validation = validateReportDocument(body);
  if (!validation.ok) {
    return { ok: false, code: "INVALID" };
  }

  const preview: DefenseReportPreview = {
    scheduleId,
    baseBodyVersion,
    previewSequence,
    body: canonicalizeReportDocument(body),
  };

  if (
    Buffer.byteLength(JSON.stringify(preview), "utf8") >
    DEFENSE_REPORT_PREVIEW_MAX_BYTES
  ) {
    return { ok: false, code: "INVALID" };
  }

  return { ok: true, preview };
}
