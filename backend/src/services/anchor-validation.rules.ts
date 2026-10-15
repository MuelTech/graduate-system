/**
 * CDW-1 — authoritative server-side validation for the CDW-0A v1 annotation anchor.
 *
 * Fail closed: malformed, out-of-range, or unknown-version payloads are rejected.
 * We never silently clamp/normalize a client-supplied out-of-range payload.
 */

export const SUPPORTED_ANCHOR_VERSION = 1 as const;

export const ANCHOR_LIMITS = {
  maxSelectedTextLength: 5000,
  maxRects: 200,
  maxContextLength: 500,
} as const;

export interface AnchorRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AnchorPayload {
  anchorVersion: number;
  pageNumber: number;
  selectedText: string;
  rects: AnchorRect[];
  prefix: string;
  suffix: string;
}

export type AnchorValidationResult =
  | { ok: true; anchor: AnchorPayload }
  | { ok: false; error: string };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

type RectResult = { ok: true; rect: AnchorRect } | { ok: false; error: string };

function validateRect(value: unknown, index: number): RectResult {
  if (!isPlainObject(value)) {
    return { ok: false, error: `rect[${index}] must be an object.` };
  }
  const { x, y, width, height } = value;
  if (!isFiniteNumber(x) || !isFiniteNumber(y) || !isFiniteNumber(width) || !isFiniteNumber(height)) {
    return { ok: false, error: `rect[${index}] coordinates must be finite numbers.` };
  }
  if (x < 0 || y < 0) {
    return { ok: false, error: `rect[${index}] x and y must be >= 0.` };
  }
  if (x > 1 || y > 1) {
    return { ok: false, error: `rect[${index}] x and y must be <= 1.` };
  }
  if (width <= 0 || height <= 0) {
    return { ok: false, error: `rect[${index}] width and height must be > 0.` };
  }
  if (width > 1 || height > 1) {
    return { ok: false, error: `rect[${index}] width and height must be <= 1.` };
  }
  if (x + width > 1) {
    return { ok: false, error: `rect[${index}] x + width must be <= 1.` };
  }
  if (y + height > 1) {
    return { ok: false, error: `rect[${index}] y + height must be <= 1.` };
  }
  return { ok: true, rect: { x, y, width, height } };
}

/**
 * Validate a client-supplied anchor payload against the supported v1 format.
 * On success the returned payload contains ONLY the known fields (extra fields
 * are dropped; optional prefix/suffix default to "").
 */
export function validateAnchorPayload(input: unknown): AnchorValidationResult {
  if (!isPlainObject(input)) {
    return { ok: false, error: "Anchor payload must be an object." };
  }

  const { anchorVersion, pageNumber, selectedText, rects, prefix, suffix } = input;

  if (anchorVersion !== SUPPORTED_ANCHOR_VERSION) {
    return {
      ok: false,
      error: `Unsupported anchor version. Supported version: ${SUPPORTED_ANCHOR_VERSION}.`,
    };
  }
  if (!Number.isInteger(pageNumber) || (pageNumber as number) < 1) {
    return { ok: false, error: "pageNumber must be a positive integer." };
  }
  if (typeof selectedText !== "string" || selectedText.trim().length === 0) {
    return { ok: false, error: "selectedText is required." };
  }
  if (selectedText.length > ANCHOR_LIMITS.maxSelectedTextLength) {
    return { ok: false, error: "selectedText is too long." };
  }
  if (!Array.isArray(rects) || rects.length === 0) {
    return { ok: false, error: "rects must be a non-empty array." };
  }
  if (rects.length > ANCHOR_LIMITS.maxRects) {
    return {
      ok: false,
      error: `rects must contain at most ${ANCHOR_LIMITS.maxRects} entries.`,
    };
  }

  const normalizedRects: AnchorRect[] = [];
  for (let index = 0; index < rects.length; index += 1) {
    const result = validateRect(rects[index], index);
    if (!result.ok) return result;
    normalizedRects.push(result.rect);
  }

  const normalizedPrefix = prefix ?? "";
  const normalizedSuffix = suffix ?? "";
  if (typeof normalizedPrefix !== "string" || typeof normalizedSuffix !== "string") {
    return { ok: false, error: "prefix/suffix must be strings." };
  }
  if (
    normalizedPrefix.length > ANCHOR_LIMITS.maxContextLength ||
    normalizedSuffix.length > ANCHOR_LIMITS.maxContextLength
  ) {
    return { ok: false, error: "prefix/suffix context is too long." };
  }

  return {
    ok: true,
    anchor: {
      anchorVersion: SUPPORTED_ANCHOR_VERSION,
      pageNumber: pageNumber as number,
      selectedText,
      rects: normalizedRects,
      prefix: normalizedPrefix,
      suffix: normalizedSuffix,
    },
  };
}
