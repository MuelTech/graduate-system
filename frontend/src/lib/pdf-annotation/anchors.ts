/**
 * CDW-0A — controlled PDF annotation anchors (framework-free).
 *
 * A {@link PdfAnchor} stores everything the viewer needs to restore a highlight
 * after a reload and across zoom levels WITHOUT touching the source PDF:
 *
 *   - page number (1-based);
 *   - the selected text;
 *   - page-normalized rectangles (0..1 of the rendered page box) so geometry is
 *     independent of zoom / device pixel ratio;
 *   - surrounding prefix/suffix text for future text-fallback resilience;
 *   - an anchor format version.
 *
 * This is the production anchor contract used by the Collaborative Manuscript
 * Viewer (CDW-2). The format is immutable once stored; `anchorVersion` lets a
 * future viewer refuse (fail closed) an anchor it does not understand.
 */

export const ANCHOR_VERSION = 1 as const;

/** A rectangle in normalized page space (0..1, top-left origin). */
export interface NormalizedRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A rectangle in page pixels (CSS px, top-left origin, relative to the page box). */
export interface PageRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface PageSize {
  width: number;
  height: number;
}

export interface PdfAnchor {
  anchorVersion: number;
  pageNumber: number;
  selectedText: string;
  rects: NormalizedRect[];
  prefix: string;
  suffix: string;
}

export interface BuildAnchorInput {
  pageNumber: number;
  selectedText: string;
  clientRects: PageRect[];
  page: PageSize;
  prefix?: string;
  suffix?: string;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * Convert page-pixel rectangles into normalized 0..1 rectangles, clamped to the
 * page box. Zero-area rectangles (e.g. empty selection lines) are dropped.
 */
export function normalizeRects(clientRects: PageRect[], page: PageSize): NormalizedRect[] {
  if (page.width <= 0 || page.height <= 0) return [];
  return clientRects
    .map((rect) => {
      const x = clamp(rect.left / page.width, 0, 1);
      const y = clamp(rect.top / page.height, 0, 1);
      const width = clamp(rect.width / page.width, 0, 1 - x);
      const height = clamp(rect.height / page.height, 0, 1 - y);
      return { x, y, width, height };
    })
    .filter((rect) => rect.width > 0 && rect.height > 0);
}

/** Convert normalized rectangles back into page pixels for a given (zoomed) page size. */
export function denormalizeRects(rects: NormalizedRect[], page: PageSize): PageRect[] {
  return rects.map((rect) => ({
    left: rect.x * page.width,
    top: rect.y * page.height,
    width: rect.width * page.width,
    height: rect.height * page.height,
  }));
}

export function buildAnchor(input: BuildAnchorInput): PdfAnchor {
  return {
    anchorVersion: ANCHOR_VERSION,
    pageNumber: input.pageNumber,
    selectedText: input.selectedText,
    rects: normalizeRects(input.clientRects, input.page),
    prefix: input.prefix ?? "",
    suffix: input.suffix ?? "",
  };
}

export function isValidAnchor(value: unknown): value is PdfAnchor {
  if (typeof value !== "object" || value === null) return false;
  const anchor = value as Record<string, unknown>;
  if (anchor.anchorVersion !== ANCHOR_VERSION) return false;
  if (!Number.isInteger(anchor.pageNumber) || (anchor.pageNumber as number) < 1) return false;
  if (typeof anchor.selectedText !== "string") return false;
  if (typeof anchor.prefix !== "string" || typeof anchor.suffix !== "string") return false;
  if (!Array.isArray(anchor.rects)) return false;
  return anchor.rects.every((rect) => {
    if (typeof rect !== "object" || rect === null) return false;
    const r = rect as Record<string, unknown>;
    return (
      isFiniteNumber(r.x) &&
      isFiniteNumber(r.y) &&
      isFiniteNumber(r.width) &&
      isFiniteNumber(r.height) &&
      r.x >= 0 &&
      r.x <= 1 &&
      r.y >= 0 &&
      r.y <= 1 &&
      r.width > 0 &&
      r.width <= 1 &&
      r.height > 0 &&
      r.height <= 1
    );
  });
}

export function serializeAnchor(anchor: PdfAnchor): string {
  return JSON.stringify(anchor);
}

/**
 * Parse a serialized anchor, rejecting invalid JSON, structurally invalid
 * payloads, and unsupported anchor versions (fail closed — never silently
 * restore a highlight we cannot interpret).
 */
export function deserializeAnchor(json: string): PdfAnchor {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("Anchor payload is not valid JSON.");
  }
  if (!isValidAnchor(parsed)) {
    throw new Error("Anchor payload is not a valid anchor or uses an unsupported version.");
  }
  return parsed;
}
