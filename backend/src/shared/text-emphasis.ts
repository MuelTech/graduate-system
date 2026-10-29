/** Dependency-free API validator; frontend parity is covered by focused tests.
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
