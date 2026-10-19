"use client";

/**
 * CDW-2 — highlight overlay layer.
 *
 * Renders stored normalized anchors as an absolutely-positioned overlay above the
 * rendered page. The source PDF is never modified; rects are derived from the
 * anchor's normalized geometry against the CURRENT page box, so they stay aligned
 * across zoom while the stored anchor is unchanged.
 */

import type { PdfAnchor } from "@/lib/pdf-annotation/anchors";
import type { CollaborationAnnotation } from "@/lib/pdf-annotation/annotations";
import { rectsForAnchorOnPage } from "@/lib/pdf-annotation/viewer-core";

export interface ManuscriptHighlightLayerProps {
  pageSize: { width: number; height: number };
  /** Annotations already scoped to the current page + exact document. */
  annotations: CollaborationAnnotation[];
  focusedAnnotationId: string | null;
  /** Unsaved selection draft already scoped to this page. */
  pendingAnchor?: PdfAnchor | null;
}

export function ManuscriptHighlightLayer({
  pageSize,
  annotations,
  focusedAnnotationId,
  pendingAnchor = null,
}: ManuscriptHighlightLayerProps) {
  const pendingRects = pendingAnchor
    ? rectsForAnchorOnPage(pendingAnchor, pageSize)
    : [];

  if (annotations.length === 0 && pendingRects.length === 0) return null;

  return (
    <div className="mwOverlay" aria-hidden="true">
      {annotations.flatMap((annotation) =>
        rectsForAnchorOnPage(annotation.anchor, pageSize).map((rect, index) => (
          <span
            key={`${annotation.id}-${index}`}
            className={
              annotation.id === focusedAnnotationId
                ? "mwHighlightRect mwHighlightRect--focused"
                : "mwHighlightRect"
            }
            style={{
              left: `${rect.left}px`,
              top: `${rect.top}px`,
              width: `${rect.width}px`,
              height: `${rect.height}px`,
            }}
          />
        )),
      )}
      {pendingRects.map((rect, index) => (
        <span
          key={`pending-${index}`}
          className="mwHighlightRect mwHighlightRect--pending"
          style={{
            left: `${rect.left}px`,
            top: `${rect.top}px`,
            width: `${rect.width}px`,
            height: `${rect.height}px`,
          }}
        />
      ))}
    </div>
  );
}
