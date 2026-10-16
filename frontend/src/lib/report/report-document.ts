/**
 * CDW-5 — frontend mirror of the canonical Committee Report document model.
 *
 * The SERVER (`report-body.rules.ts`) is the authority; this module only mirrors
 * the bounded ProseMirror-shaped nodes/marks so the editor and read-only renderer
 * speak the same shape, plus a normalizer that guarantees a payload the strict
 * server validator accepts (arrays present, no null textAlign, no extra marks).
 *
 * No HTML is produced or consumed anywhere — the body is structured JSON.
 */

export type ReportMark = "bold" | "italic" | "underline";
export type ReportAlignment = "left" | "center" | "right" | "justify";

export interface ReportTextNode {
  type: "text";
  text: string;
  marks?: ReportMark[];
}
export interface ReportHardBreakNode {
  type: "hardBreak";
}
export type ReportInlineNode = ReportTextNode | ReportHardBreakNode;

export interface ReportParagraphNode {
  type: "paragraph";
  content: ReportInlineNode[];
  attrs?: { textAlign?: ReportAlignment };
}
export interface ReportHeadingNode {
  type: "heading";
  attrs: { level: 1 | 2 | 3; textAlign?: ReportAlignment };
  content: ReportInlineNode[];
}
export interface ReportListItemNode {
  type: "listItem";
  content: ReportBlockNode[];
}
export interface ReportBulletListNode {
  type: "bulletList";
  content: ReportListItemNode[];
}
export interface ReportOrderedListNode {
  type: "orderedList";
  content: ReportListItemNode[];
}
export type ReportBlockNode =
  | ReportParagraphNode
  | ReportHeadingNode
  | ReportBulletListNode
  | ReportOrderedListNode;

export interface ReportDocument {
  type: "doc";
  content: ReportBlockNode[];
}

const MARK_SET: readonly ReportMark[] = ["bold", "italic", "underline"];
const ALIGN_SET: readonly string[] = ["left", "center", "right", "justify"];

export function emptyReportDocument(): ReportDocument {
  return { type: "doc", content: [{ type: "paragraph", content: [] }] };
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function normalizeInline(node: unknown): ReportInlineNode {
  const record = (node ?? {}) as Record<string, unknown>;
  if (record.type === "hardBreak") return { type: "hardBreak" };
  const marks = asArray(record.marks)
    .filter((mark): mark is ReportMark => MARK_SET.includes(mark as ReportMark))
    .filter((mark, index, all) => all.indexOf(mark) === index);
  return {
    type: "text",
    text: typeof record.text === "string" ? record.text : "",
    marks,
  };
}

function normalizeTextAlign(attrs: unknown): ReportAlignment | null {
  const value = (attrs as Record<string, unknown> | undefined)?.textAlign;
  return typeof value === "string" && ALIGN_SET.includes(value)
    ? (value as ReportAlignment)
    : null;
}

function normalizeBlock(node: unknown): ReportBlockNode {
  const record = (node ?? {}) as Record<string, unknown>;
  const content = asArray(record.content);

  if (record.type === "heading") {
    const rawLevel = (record.attrs as Record<string, unknown> | undefined)?.level;
    const level = rawLevel === 2 || rawLevel === 3 ? rawLevel : 1;
    const heading: ReportHeadingNode = {
      type: "heading",
      attrs: { level },
      content: content.map(normalizeInline),
    };
    const align = normalizeTextAlign(record.attrs);
    if (align) heading.attrs.textAlign = align;
    return heading;
  }

  if (record.type === "bulletList" || record.type === "orderedList") {
    const items = content.map((item) => ({
      type: "listItem" as const,
      content: asArray((item as Record<string, unknown>)?.content).map(normalizeBlock),
    }));
    return record.type === "bulletList"
      ? { type: "bulletList", content: items }
      : { type: "orderedList", content: items };
  }

  // Default: paragraph.
  const paragraph: ReportParagraphNode = {
    type: "paragraph",
    content: content.map(normalizeInline),
  };
  const align = normalizeTextAlign(record.attrs);
  if (align) paragraph.attrs = { textAlign: align };
  return paragraph;
}

/**
 * Produce a document that always satisfies the strict server validator: every
 * block/listItem has a `content` array, text marks are allow-listed, and a
 * `textAlign` is only present when valid (Tiptap emits `null` otherwise).
 */
export function normalizeReportDocument(doc: unknown): ReportDocument {
  const record = (doc ?? {}) as Record<string, unknown>;
  return { type: "doc", content: asArray(record.content).map(normalizeBlock) };
}

function nodeHasMeaningfulText(node: unknown): boolean {
  const record = (node ?? {}) as Record<string, unknown>;
  if (record.type === "text") {
    return typeof record.text === "string" && record.text.trim().length > 0;
  }
  return asArray(record.content).some(nodeHasMeaningfulText);
}

/** Mirrors the server's meaningful-content gate (empty paragraphs are not content). */
export function isReportDocumentEmpty(doc: unknown): boolean {
  const record = (doc ?? {}) as Record<string, unknown>;
  if (record.type !== "doc") return true;
  return !asArray(record.content).some(nodeHasMeaningfulText);
}

/**
 * Convert a plain comment body into insertable report content — one paragraph per
 * non-empty line. Used by "Insert into Report" so the FULL stored comment text is
 * copied (never a truncated preview).
 */
export function commentTextToContent(text: string): ReportBlockNode[] {
  const lines = String(text ?? "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0);
  if (lines.length === 0) return [];
  return lines.map((line) => ({
    type: "paragraph" as const,
    content: [{ type: "text" as const, text: line, marks: [] as ReportMark[] }],
  }));
}
