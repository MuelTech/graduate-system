/**
 * CDW-1 — controlled JSON Committee Report body: validation, deterministic
 * canonicalization, and SHA-256 hashing.
 *
 * The Rapporteur report body is NOT arbitrary HTML. It is a bounded JSON
 * document model (paragraphs, headings, text runs with bold/italic/underline
 * marks, and bullet/numbered lists). Unknown nodes/marks are REJECTED (fail
 * closed); nothing is silently rewritten.
 *
 * Canonicalization produces a deterministic serialization so that a
 * semantically identical frozen snapshot always hashes to the same value.
 * This is what later RAP signatures bind to.
 */

import { createHash } from "node:crypto";

export const REPORT_BODY_LIMITS = {
  maxNodes: 5000,
  maxDepth: 20,
  maxTextLength: 20000,
  /** Bounded paragraph indentation levels (0 = none, 1..6 = progressively indented). */
  maxIndentLevel: 6,
} as const;

export type ReportMark = "bold" | "italic" | "underline";
export type ReportAlignment = "left" | "center" | "right" | "justify";
export type ReportHeadingLevel = 1 | 2 | 3;
/** Canonical stored paragraph indentation (0 is represented by omission). */
export type ReportIndentLevel = 1 | 2 | 3 | 4 | 5 | 6;

const ALLOWED_MARKS: readonly ReportMark[] = ["bold", "italic", "underline"];
const ALLOWED_ALIGNMENTS: readonly ReportAlignment[] = ["left", "center", "right", "justify"];

/** Paragraph attrs are a closed set: nothing else may be persisted. */
const ALLOWED_PARAGRAPH_ATTRS: readonly string[] = ["textAlign", "indentLevel"];
/** Heading attrs are a closed set; headings are NOT indentable. */
const ALLOWED_HEADING_ATTRS: readonly string[] = ["level", "textAlign"];

export interface CanonicalTextNode {
  type: "text";
  text: string;
  marks: ReportMark[];
}
export interface CanonicalBreakNode {
  type: "hardBreak";
}
export type CanonicalInlineNode = CanonicalTextNode | CanonicalBreakNode;

export interface CanonicalParagraphNode {
  type: "paragraph";
  content: CanonicalInlineNode[];
  attrs?: { textAlign?: ReportAlignment; indentLevel?: ReportIndentLevel };
}
export interface CanonicalHeadingNode {
  type: "heading";
  attrs: { level: ReportHeadingLevel; textAlign?: ReportAlignment };
  content: CanonicalInlineNode[];
}
export interface CanonicalListItemNode {
  type: "listItem";
  content: CanonicalBlockNode[];
}
export interface CanonicalBulletListNode {
  type: "bulletList";
  content: CanonicalListItemNode[];
}
export interface CanonicalOrderedListNode {
  type: "orderedList";
  content: CanonicalListItemNode[];
}
export type CanonicalBlockNode =
  | CanonicalParagraphNode
  | CanonicalHeadingNode
  | CanonicalBulletListNode
  | CanonicalOrderedListNode;

export interface CanonicalReportDocument {
  type: "doc";
  content: CanonicalBlockNode[];
}

export type ReportValidationResult = { ok: true } | { ok: false; error: string };

interface ValidationContext {
  nodes: number;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isMark(value: unknown): value is ReportMark {
  return typeof value === "string" && (ALLOWED_MARKS as readonly string[]).includes(value);
}

function isAlignment(value: unknown): value is ReportAlignment {
  return typeof value === "string" && (ALLOWED_ALIGNMENTS as readonly string[]).includes(value);
}

function validateTextAlign(value: unknown): string | null {
  if (value === undefined) return null;
  return isAlignment(value) ? null : "textAlign must be a supported alignment.";
}

function isIndentLevel(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= REPORT_BODY_LIMITS.maxIndentLevel
  );
}

function validateIndentLevel(value: unknown): string | null {
  if (value === undefined) return null;
  return isIndentLevel(value)
    ? null
    : `indentLevel must be an integer between 0 and ${REPORT_BODY_LIMITS.maxIndentLevel}.`;
}

/** Fail closed on any attribute outside the bounded allow-list. */
function validateAllowedAttrs(
  attrs: Record<string, unknown>,
  allowed: readonly string[],
): string | null {
  for (const key of Object.keys(attrs)) {
    if (!allowed.includes(key)) return `Unsupported attribute: ${key}.`;
  }
  return null;
}

function validateInline(node: unknown, ctx: ValidationContext, depth: number): string | null {
  ctx.nodes += 1;
  if (ctx.nodes > REPORT_BODY_LIMITS.maxNodes) return "Report body exceeds the node limit.";
  if (depth > REPORT_BODY_LIMITS.maxDepth) return "Report body exceeds the nesting limit.";
  if (!isPlainObject(node)) return "Inline content must be an object.";
  if (node.type === "hardBreak") return null;
  if (node.type !== "text") return `Unsupported inline node type: ${String(node.type)}.`;
  if (typeof node.text !== "string") return "Text node requires a string text value.";
  if (node.text.length > REPORT_BODY_LIMITS.maxTextLength) return "Text node is too long.";
  if (node.marks !== undefined) {
    if (!Array.isArray(node.marks)) return "marks must be an array.";
    for (const mark of node.marks) {
      if (!isMark(mark)) return `Unsupported mark: ${String(mark)}.`;
    }
  }
  return null;
}

function validateInlineList(content: unknown, ctx: ValidationContext, depth: number): string | null {
  if (!Array.isArray(content)) return "Node content must be an array.";
  for (const child of content) {
    const error = validateInline(child, ctx, depth);
    if (error) return error;
  }
  return null;
}

function validateListItem(node: unknown, ctx: ValidationContext, depth: number): string | null {
  ctx.nodes += 1;
  if (ctx.nodes > REPORT_BODY_LIMITS.maxNodes) return "Report body exceeds the node limit.";
  if (depth > REPORT_BODY_LIMITS.maxDepth) return "Report body exceeds the nesting limit.";
  if (!isPlainObject(node) || node.type !== "listItem") return "List content must be listItem nodes.";
  if (!Array.isArray(node.content)) return "listItem requires content.";
  for (const child of node.content) {
    const error = validateBlock(child, ctx, depth + 1);
    if (error) return error;
  }
  return null;
}

function validateBlock(node: unknown, ctx: ValidationContext, depth: number): string | null {
  ctx.nodes += 1;
  if (ctx.nodes > REPORT_BODY_LIMITS.maxNodes) return "Report body exceeds the node limit.";
  if (depth > REPORT_BODY_LIMITS.maxDepth) return "Report body exceeds the nesting limit.";
  if (!isPlainObject(node)) return "Block content must be an object.";

  switch (node.type) {
    case "paragraph": {
      if (node.attrs !== undefined) {
        if (!isPlainObject(node.attrs)) return "paragraph attrs must be an object.";
        const allowedError = validateAllowedAttrs(node.attrs, ALLOWED_PARAGRAPH_ATTRS);
        if (allowedError) return allowedError;
        const attrError = validateTextAlign(node.attrs.textAlign);
        if (attrError) return attrError;
        const indentError = validateIndentLevel(node.attrs.indentLevel);
        if (indentError) return indentError;
      }
      return validateInlineList(node.content, ctx, depth + 1);
    }
    case "heading": {
      if (!isPlainObject(node.attrs)) return "heading requires attrs.";
      const allowedError = validateAllowedAttrs(node.attrs, ALLOWED_HEADING_ATTRS);
      if (allowedError) return allowedError;
      const level = node.attrs.level;
      if (level !== 1 && level !== 2 && level !== 3) return "heading level must be 1, 2, or 3.";
      const attrError = validateTextAlign(node.attrs.textAlign);
      if (attrError) return attrError;
      return validateInlineList(node.content, ctx, depth + 1);
    }
    case "bulletList":
    case "orderedList": {
      if (!Array.isArray(node.content)) return "List requires content.";
      for (const item of node.content) {
        const error = validateListItem(item, ctx, depth + 1);
        if (error) return error;
      }
      return null;
    }
    default:
      return `Unsupported block node type: ${String(node.type)}.`;
  }
}

export function validateReportDocument(input: unknown): ReportValidationResult {
  if (!isPlainObject(input)) return { ok: false, error: "Report body must be an object." };
  if (input.type !== "doc") return { ok: false, error: "Report body root must be a doc node." };
  if (!Array.isArray(input.content)) return { ok: false, error: "Report body content must be an array." };
  const ctx: ValidationContext = { nodes: 1 };
  for (const block of input.content) {
    const error = validateBlock(block, ctx, 1);
    if (error) return { ok: false, error };
  }
  return { ok: true };
}

function canonicalizeMarks(marks: unknown): ReportMark[] {
  const list = Array.isArray(marks) ? marks.filter(isMark) : [];
  return Array.from(new Set(list)).sort();
}

function asRecord(value: unknown): Record<string, unknown> {
  return isPlainObject(value) ? value : {};
}

function canonicalizeInline(node: unknown): CanonicalInlineNode {
  const record = asRecord(node);
  if (record.type === "hardBreak") return { type: "hardBreak" };
  return {
    type: "text",
    text: typeof record.text === "string" ? record.text : "",
    marks: canonicalizeMarks(record.marks),
  };
}

function canonicalizeBlock(node: unknown): CanonicalBlockNode {
  const record = asRecord(node);
  const content = Array.isArray(record.content) ? record.content : [];

  if (record.type === "heading") {
    const attrs = asRecord(record.attrs);
    const heading: CanonicalHeadingNode = {
      type: "heading",
      attrs: { level: (attrs.level as ReportHeadingLevel) ?? 1 },
      content: content.map(canonicalizeInline),
    };
    if (attrs.textAlign !== undefined) heading.attrs.textAlign = attrs.textAlign as ReportAlignment;
    return heading;
  }

  if (record.type === "paragraph") {
    const attrs = asRecord(record.attrs);
    const paragraph: CanonicalParagraphNode = {
      type: "paragraph",
      content: content.map(canonicalizeInline),
    };
    // Deterministic attr order (textAlign, then indentLevel). A canonical level
    // of 0 is represented by omission, never by an explicit indeterminate value.
    const canonicalAttrs: { textAlign?: ReportAlignment; indentLevel?: ReportIndentLevel } = {};
    if (attrs.textAlign !== undefined) canonicalAttrs.textAlign = attrs.textAlign as ReportAlignment;
    if (isIndentLevel(attrs.indentLevel) && attrs.indentLevel > 0) {
      canonicalAttrs.indentLevel = attrs.indentLevel as ReportIndentLevel;
    }
    if (Object.keys(canonicalAttrs).length > 0) paragraph.attrs = canonicalAttrs;
    return paragraph;
  }

  if (record.type === "bulletList" || record.type === "orderedList") {
    const items: CanonicalListItemNode[] = content.map((item) => {
      const itemContent = asRecord(item).content;
      return {
        type: "listItem",
        content: (Array.isArray(itemContent) ? itemContent : []).map(canonicalizeBlock),
      };
    });
    return record.type === "bulletList"
      ? { type: "bulletList", content: items }
      : { type: "orderedList", content: items };
  }

  // Only reachable for an unvalidated document; degrade to an empty paragraph.
  return { type: "paragraph", content: [] };
}

export function canonicalizeReportDocument(doc: unknown): CanonicalReportDocument {
  const root = asRecord(doc);
  const content = Array.isArray(root.content) ? root.content : [];
  return { type: "doc", content: content.map(canonicalizeBlock) };
}

/** Deterministic JSON serialization of the canonical document. */
export function serializeReportDocument(doc: unknown): string {
  return JSON.stringify(canonicalizeReportDocument(doc));
}

/** Server-generated SHA-256 (hex) of the canonical document. */
export function hashReportDocument(doc: unknown): string {
  return createHash("sha256").update(serializeReportDocument(doc), "utf8").digest("hex");
}

function nodeHasMeaningfulText(node: unknown): boolean {
  const record = asRecord(node);
  if (record.type === "text") {
    return typeof record.text === "string" && record.text.trim().length > 0;
  }
  const content = record.content;
  return Array.isArray(content) ? content.some(nodeHasMeaningfulText) : false;
}

/**
 * Freeze-gate helper: a committee report must contain at least one non-whitespace
 * text run. Empty documents, empty paragraphs, hard-break-only nodes, and
 * whitespace-only text are NOT meaningful institutional report content and are
 * therefore not eligible for freeze/signatures. (Draft saving may still allow
 * an empty document.)
 */
export function hasMeaningfulReportContent(doc: unknown): boolean {
  const root = asRecord(doc);
  if (root.type !== "doc") return false;
  const content = Array.isArray(root.content) ? root.content : [];
  return content.some(nodeHasMeaningfulText);
}
