/**
 * CDW-2/CDW-3 — CDW-1 collaboration annotation read model + safe parsing.
 *
 * The production viewer + Shared Comments rail read the accepted CDW-1 endpoint
 *
 *   GET /api/thesis/defense/:scheduleId/collaboration/annotations?documentId=<id>
 *
 * and render stored highlights + thread comments. Parsing is fail-safe: anything
 * malformed, or belonging to a DIFFERENT document, is dropped rather than
 * rendered — a highlight from another document must never appear on the current
 * manuscript. A malformed comment is dropped without discarding its annotation.
 *
 * This module is read/display only; writes live in the React Query hook layer.
 */

import { type PdfAnchor, isValidAnchor } from "./anchors.ts";

export interface CollaborationCommentAuthor {
  assignmentId: string;
  userId: string;
  name: string;
  role: string;
}

export interface CollaborationComment {
  id: string;
  annotationId: string;
  parentCommentId: string | null;
  body: string;
  author: CollaborationCommentAuthor;
  createdAt: string;
  updatedAt: string;
}

export interface CollaborationAnnotation {
  id: string;
  scheduleId: string;
  thesisDocumentId: string;
  pageNumber: number;
  selectedText: string;
  anchor: PdfAnchor;
  author: CollaborationCommentAuthor;
  createdAt: string;
  updatedAt: string;
  comments: CollaborationComment[];
}

export interface ParseAnnotationsResult {
  annotations: CollaborationAnnotation[];
  /** Count of raw entries that were dropped (wrong document / malformed). */
  skipped: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

export function filterAnchorsForDocument<T extends { thesisDocumentId: string }>(
  items: T[],
  documentId: string,
): T[] {
  return items.filter((item) => item.thesisDocumentId === documentId);
}

function parseAuthor(value: unknown): CollaborationCommentAuthor {
  const author = isRecord(value) ? value : {};
  return {
    assignmentId: asString(author.assignmentId),
    userId: asString(author.userId),
    name: asString(author.name),
    // Role comes from the server-side defense assignment, never the account role.
    role: asString(author.role),
  };
}

function parseComment(
  value: unknown,
  annotationId: string,
): CollaborationComment | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== "string" || value.id.length === 0) return null;
  if (typeof value.body !== "string") return null;
  const parentCommentId =
    typeof value.parentCommentId === "string" && value.parentCommentId.length > 0
      ? value.parentCommentId
      : null;
  return {
    id: value.id,
    annotationId: asString(value.annotationId, annotationId),
    parentCommentId,
    body: value.body,
    author: parseAuthor(value.author),
    createdAt: asString(value.createdAt),
    updatedAt: asString(value.updatedAt),
  };
}

function parseComments(value: unknown, annotationId: string): CollaborationComment[] {
  if (!Array.isArray(value)) return [];
  // Preserve the server's ordering (the backend orders comments by createdAt asc);
  // never re-sort, so a comment with a missing timestamp cannot jump position.
  const comments: CollaborationComment[] = [];
  for (const raw of value) {
    const parsed = parseComment(raw, annotationId);
    if (parsed) comments.push(parsed);
  }
  return comments;
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
    annotations.push({
      id: item.id,
      scheduleId: asString(item.scheduleId),
      thesisDocumentId: expectedDocumentId,
      pageNumber: anchor.pageNumber,
      selectedText: asString(item.selectedText, anchor.selectedText),
      anchor,
      author: parseAuthor(item.author),
      createdAt: asString(item.createdAt),
      updatedAt: asString(item.updatedAt),
      comments: parseComments(item.comments, item.id),
    });
  }

  return { annotations, skipped };
}

/** Top-level (annotation) comments — parentCommentId is null. */
export function topLevelComments(annotation: {
  comments: CollaborationComment[];
}): CollaborationComment[] {
  return annotation.comments.filter((c) => c.parentCommentId === null);
}

/** One-level replies to a specific top-level comment. */
export function repliesFor(
  annotation: { comments: CollaborationComment[] },
  parentCommentId: string,
): CollaborationComment[] {
  return annotation.comments.filter((c) => c.parentCommentId === parentCommentId);
}
