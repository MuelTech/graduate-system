/**
 * CDW-2 — CDW-1 collaboration annotation read model + safe parsing.
 *
 * The production viewer reads the accepted CDW-1 endpoint
 *   GET /api/thesis/defense/:scheduleId/collaboration/annotations?documentId=<id>
 * and renders stored highlights. Parsing is fail-safe: anything malformed, or
 * belonging to a DIFFERENT document, is dropped rather than rendered — a highlight
 * from another document must never appear on the current manuscript.
 *
 * This module is read/display only. It contains no write path (CDW-3 owns the
 * shared comment workflow).
 */

import { type PdfAnchor, isValidAnchor } from "./anchors.ts";

export interface CollaborationAnnotation {
  id: string;
  scheduleId: string;
  thesisDocumentId: string;
  pageNumber: number;
  selectedText: string;
  anchor: PdfAnchor;
  author: {
    userId: string;
    name: string;
    role: string;
  };
}

export interface ParseAnnotationsResult {
  annotations: CollaborationAnnotation[];
  /** Count of raw entries that were dropped (wrong document / malformed). */
  skipped: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function filterAnchorsForDocument<T extends { thesisDocumentId: string }>(
  items: T[],
  documentId: string,
): T[] {
  return items.filter((item) => item.thesisDocumentId === documentId);
}

/**
 * Parse a CDW-1 annotation read response (either `{ annotations: [...] }` or a
 * bare array) into viewer annotations for the EXACT expected document.
 */
export function parseCollaborationAnnotations(
  raw: unknown,
  expectedDocumentId: string,
): ParseAnnotationsResult {
  const list = Array.isArray(raw)
    ? raw
    : isRecord(raw) && Array.isArray(raw.annotations)
      ? raw.annotations
      : [];

  const annotations: CollaborationAnnotation[] = [];
  let skipped = 0;

  for (const item of list) {
    if (!isRecord(item) || item.thesisDocumentId !== expectedDocumentId) {
      skipped += 1;
      continue;
    }
    const anchor = item.anchor;
    if (!isValidAnchor(anchor)) {
      skipped += 1;
      continue;
    }
    if (typeof item.id !== "string" || item.id.length === 0) {
      skipped += 1;
      continue;
    }
    const author = isRecord(item.author) ? item.author : {};
    annotations.push({
      id: item.id,
      scheduleId: typeof item.scheduleId === "string" ? item.scheduleId : "",
      thesisDocumentId: expectedDocumentId,
      pageNumber: anchor.pageNumber,
      selectedText:
        typeof item.selectedText === "string" ? item.selectedText : anchor.selectedText,
      anchor,
      author: {
        userId: typeof author.userId === "string" ? author.userId : "",
        name: typeof author.name === "string" ? author.name : "",
        role: typeof author.role === "string" ? author.role : "",
      },
    });
  }

  return { annotations, skipped };
}
