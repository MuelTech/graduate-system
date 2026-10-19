/**
 * CDW-5 — explicit Tiptap ⇄ canonical ReportDocument boundary adapters.
 *
 * The SERVER canonical model (`report-body.rules.ts`) stores marks as STRINGS
 * (`marks: ["bold","italic"]`). Tiptap / ProseMirror emits marks as OBJECTS
 * (`marks: [{ type: "bold" }]`). These two shapes are NOT interchangeable, so all
 * crossing happens here:
 *
 *   Tiptap JSON   --fromTiptapDocument-->  canonical ReportDocument
 *   canonical      --toTiptapDocument---->  Tiptap JSON
 *
 * The canonical representation never depends on Tiptap internals, and the bounded
 * node/mark subset is unchanged — unsupported nodes/marks are dropped/validated
 * server-side.
 */

import {
  emptyReportDocument,
  normalizeReportDocument,
  type ReportBlockNode,
  type ReportDocument,
  type ReportInlineNode,
} from "./report-document.ts";

interface TiptapMark {
  type: string;
}

/** A recursive ProseMirror-shaped node that satisfies Tiptap's `JSONContent`. */
export interface TiptapNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
  text?: string;
  marks?: TiptapMark[];
}

export interface TiptapDocument {
  type: "doc";
  content: TiptapNode[];
}

function inlineToTiptap(node: ReportInlineNode): TiptapNode {
  if (node.type === "hardBreak") return { type: "hardBreak" };
  const marks = (node.marks ?? []).map((mark) => ({ type: mark }));
  const out: TiptapNode = { type: "text", text: node.text };
  if (marks.length > 0) out.marks = marks;
  return out;
}

function blockToTiptap(node: ReportBlockNode): TiptapNode {
  if (node.type === "heading") {
    const attrs: Record<string, unknown> = { level: node.attrs.level };
    if (node.attrs.textAlign) attrs.textAlign = node.attrs.textAlign;
    return {
      type: "heading",
      attrs,
      content: (node.content ?? []).map(inlineToTiptap),
    };
  }
  if (node.type === "paragraph") {
    const out: TiptapNode = {
      type: "paragraph",
      content: (node.content ?? []).map(inlineToTiptap),
    };
    // Preservation only: canonical paragraph attrs must not be dropped.
    const attrs: Record<string, unknown> = {};
    if (node.attrs?.textAlign) attrs.textAlign = node.attrs.textAlign;
    if (node.attrs?.indentLevel) attrs.indentLevel = node.attrs.indentLevel;
    if (node.attrs?.fontSizePt) attrs.fontSizePt = node.attrs.fontSizePt;
    if (node.attrs?.lineSpacing) attrs.lineSpacing = node.attrs.lineSpacing;
    if (Object.keys(attrs).length > 0) out.attrs = attrs;
    return out;
  }
  // bulletList / orderedList
  return {
    type: node.type,
    content: (node.content ?? []).map((item) => ({
      type: "listItem",
      content: (item.content ?? []).map(blockToTiptap),
    })),
  };
}

/** Canonical string marks → Tiptap mark objects, ready for `useEditor`/`insertContent`. */
export function toTiptapDocument(
  doc: ReportDocument | null | undefined,
): TiptapDocument {
  const canonical = normalizeReportDocument(doc ?? emptyReportDocument());
  return { type: "doc", content: canonical.content.map(blockToTiptap) };
}

/** Tiptap/ProseMirror JSON (mark objects) → canonical ReportDocument (string marks). */
export function fromTiptapDocument(doc: unknown): ReportDocument {
  return normalizeReportDocument(doc);
}
