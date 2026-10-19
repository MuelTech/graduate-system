/**
 * CDW-2 — framework-free viewer core (page / zoom / anchor geometry).
 *
 * These pure helpers back the production Collaborative Manuscript Viewer so the
 * deterministic parts (bounds, fit-width, zoom-stable highlight geometry, anchor
 * focus) are unit-testable without a browser. They never mutate the source PDF.
 */

import {
  type PageRect,
  type PageSize,
  type PdfAnchor,
  denormalizeRects,
} from "./anchors.ts";

export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 3;
export const ZOOM_STEP = 0.25;
export const DEFAULT_ZOOM = 1;

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function clampZoom(scale: number): number {
  if (!Number.isFinite(scale)) return DEFAULT_ZOOM;
  return Math.min(Math.max(scale, MIN_ZOOM), MAX_ZOOM);
}

export function zoomIn(scale: number): number {
  return clampZoom(round2(clampZoom(scale) + ZOOM_STEP));
}

export function zoomOut(scale: number): number {
  return clampZoom(round2(clampZoom(scale) - ZOOM_STEP));
}

export function clampPage(page: number, totalPages: number): number {
  if (!Number.isInteger(totalPages) || totalPages < 1) return 1;
  const candidate = Number.isFinite(page) ? Math.trunc(page) : 1;
  return Math.min(Math.max(candidate, 1), totalPages);
}

export function stepPage(page: number, delta: number, totalPages: number): number {
  const current = Number.isFinite(page) ? Math.trunc(page) : 1;
  return clampPage(current + delta, totalPages);
}

/**
 * Scale that fits a page of `pageWidthAtUnitScale` px into `containerWidth` px,
 * clamped to the viewer zoom bounds.
 */
export function computeFitWidthScale(
  pageWidthAtUnitScale: number,
  containerWidth: number,
  padding = 0,
): number {
  if (!Number.isFinite(pageWidthAtUnitScale) || pageWidthAtUnitScale <= 0) {
    return DEFAULT_ZOOM;
  }
  const available = containerWidth - padding;
  if (!Number.isFinite(available) || available <= 0) return DEFAULT_ZOOM;
  return clampZoom(round2(available / pageWidthAtUnitScale));
}

/** Pixel rects for a stored anchor against the currently rendered page box. */
export function rectsForAnchorOnPage(anchor: PdfAnchor, page: PageSize): PageRect[] {
  return denormalizeRects(anchor.rects, page);
}

export function isAnchorOnPage(anchor: PdfAnchor, pageNumber: number): boolean {
  return anchor.pageNumber === pageNumber;
}

/** The page to navigate to for a focused annotation id (null when unknown). */
export function resolveFocusPage(
  items: Array<{ id: string; anchor: PdfAnchor }>,
  annotationId: string | null | undefined,
): number | null {
  if (!annotationId) return null;
  const found = items.find((item) => item.id === annotationId);
  return found ? found.anchor.pageNumber : null;
}

/** A page "has text" only when at least one non-whitespace text run exists. */
export function hasUsableTextLayer(items: Array<{ str?: string }>): boolean {
  return items.some((item) => typeof item.str === "string" && item.str.trim().length > 0);
}
