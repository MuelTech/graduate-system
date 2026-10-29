/** Frontend semantic contract; backend validator parity is covered by focused tests.
 * Offsets are UTF-16 code units, zero-based and end-exclusive (JS/textarea indices).
 * Never split a surrogate pair. Same-style overlaps are rejected, not repaired.
 */
export interface TextEmphasisSpan {
  start: number;
  end: number;
  style: "BOLD" | "UNDERLINE";
}
export const MAX_EMPHASIS_SPANS = 128;

export function validateTextEmphasis(
  text: string | null,
  value: unknown,
): TextEmphasisSpan[] | null {
  if (value == null) return null;
  if (!Array.isArray(value) || value.length > MAX_EMPHASIS_SPANS)
    throw new Error("Emphasis must be a bounded array of spans.");
  if (text === null && value.length)
    throw new Error("Image-only options cannot carry text emphasis.");
  const boundary = (offset: number) =>
    !text ||
    offset === 0 ||
    offset === text.length ||
    !(
      text.charCodeAt(offset - 1) >= 0xd800 &&
      text.charCodeAt(offset - 1) <= 0xdbff &&
      text.charCodeAt(offset) >= 0xdc00 &&
      text.charCodeAt(offset) <= 0xdfff
    );
  const spans = value
    .map((item: unknown): TextEmphasisSpan => {
      if (!item || typeof item !== "object" || Array.isArray(item))
        throw new Error("Invalid emphasis span.");
      const span = item as Record<string, unknown>;
      if (
        Object.keys(span).length !== 3 ||
        Object.keys(span).some((k) => !["start", "end", "style"].includes(k)) ||
        typeof span.start !== "number" ||
        typeof span.end !== "number" ||
        !Number.isInteger(span.start) ||
        !Number.isInteger(span.end) ||
        span.start < 0 ||
        span.start >= span.end ||
        text === null ||
        span.end > text.length ||
        !boundary(span.start) ||
        !boundary(span.end) ||
        (span.style !== "BOLD" && span.style !== "UNDERLINE")
      )
        throw new Error("Invalid emphasis range or style.");
      return { start: span.start, end: span.end, style: span.style };
    })
    .sort(
      (a, b) =>
        a.start - b.start || a.end - b.end || a.style.localeCompare(b.style),
    );
  for (const style of ["BOLD", "UNDERLINE"] as const) {
    let end = -1;
    for (const span of spans.filter((s) => s.style === style)) {
      if (span.start < end)
        throw new Error("Duplicate or overlapping same-style emphasis.");
      end = span.end;
    }
  }
  return spans.length ? spans : null;
}

export interface SemanticTextSegment {
  start: number;
  text: string;
  bold: boolean;
  underline: boolean;
}
/** Invalid persisted/client metadata falls back to the exact plain text, never markup. */
export function semanticTextSegments(
  text: string,
  value: unknown,
): SemanticTextSegment[] {
  let spans: TextEmphasisSpan[];
  try {
    spans = validateTextEmphasis(text, value) ?? [];
  } catch {
    spans = [];
  }
  const points = [
    ...new Set([0, text.length, ...spans.flatMap((s) => [s.start, s.end])]),
  ].sort((a, b) => a - b);
  return points.slice(0, -1).map((start, index) => ({
    start,
    text: text.slice(start, points[index + 1]),
    bold: spans.some(
      (s) => s.style === "BOLD" && s.start <= start && s.end > start,
    ),
    underline: spans.some(
      (s) => s.style === "UNDERLINE" && s.start <= start && s.end > start,
    ),
  }));
}

export function markTextSelection(
  text: string,
  spans: unknown,
  start: number,
  end: number,
  style: TextEmphasisSpan["style"],
): TextEmphasisSpan[] | null {
  return validateTextEmphasis(text, [
    ...(validateTextEmphasis(text, spans) ?? []),
    { start, end, style },
  ]);
}

/** Deliberate plain-text edit strategy: clear ALL marks, even for same-length edits. */
export function editEmphasizedText(
  previous: string,
  next: string,
  spans: unknown,
) {
  const current = validateTextEmphasis(previous, spans);
  return {
    text: next,
    emphasis: previous === next ? current : null,
    cleared: previous !== next && !!current?.length,
  };
}

/** Remove all styles from the selected range; retain bounded nonintersecting fragments. */
export function clearTextSelection(
  text: string,
  spans: unknown,
  start: number,
  end: number,
): TextEmphasisSpan[] | null {
  validateTextEmphasis(text, [{ start, end, style: "BOLD" }]);
  return validateTextEmphasis(
    text,
    (validateTextEmphasis(text, spans) ?? []).flatMap((s) => {
      if (s.end <= start || s.start >= end) return [s];
      return [
        ...(s.start < start ? [{ ...s, end: start }] : []),
        ...(s.end > end ? [{ ...s, start: end }] : []),
      ];
    }),
  );
}

/** Textareas normalize CRLF/CR to LF; map DOM selection back to the unchanged string. */
export function canonicalTextareaOffset(text: string, offset: number): number {
  if (!Number.isInteger(offset) || offset < 0)
    throw new Error("Invalid text selection.");
  let dom = 0;
  let source = 0;
  while (source < text.length && dom < offset) {
    source += text[source] === "\r" && text[source + 1] === "\n" ? 2 : 1;
    dom++;
  }
  if (dom !== offset) throw new Error("Invalid text selection.");
  return source;
}
