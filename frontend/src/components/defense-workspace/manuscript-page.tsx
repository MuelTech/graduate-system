"use client";

/**
 * CDW-2 — single-page pdf.js renderer (canvas + selectable text layer + overlay).
 *
 * Owns the pdf.js render loop for ONE page at the current zoom. Stale renders are
 * cancelled; the source PDF is never modified. Text selection is converted into the
 * accepted normalized v1 anchor and reported via `onTextSelection` (the viewer does
 * not persist anything in CDW-2).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";

import { buildAnchor, denormalizeRects, type PageRect, type PdfAnchor } from "@/lib/pdf-annotation/anchors";
import type { CollaborationAnnotation } from "@/lib/pdf-annotation/annotations";
import { hasUsableTextLayer } from "@/lib/pdf-annotation/viewer-core";

import { ManuscriptHighlightLayer } from "./manuscript-highlight-layer";

type PdfJsModule = typeof import("pdfjs-dist");

export interface ManuscriptPageProps {
  pdfjs: PdfJsModule;
  pdf: PDFDocumentProxy;
  pageNumber: number;
  scale: number;
  /** Annotations already scoped to this page + exact document. */
  annotations: CollaborationAnnotation[];
  focusedAnnotationId: string | null;
  onTextSelection?: (anchor: PdfAnchor) => void;
  /** CDW-3: select an existing highlight's thread via pointer hit-testing. */
  onAnnotationSelect?: (annotationId: string) => void;
  onTextLayerStatus?: (hasText: boolean) => void;
  onBaseSize?: (size: { width: number; height: number }) => void;
}

export function ManuscriptPage({
  pdfjs,
  pdf,
  pageNumber,
  scale,
  annotations,
  focusedAnnotationId,
  onTextSelection,
  onAnnotationSelect,
  onTextLayerStatus,
  onBaseSize,
}: ManuscriptPageProps) {
  const pageRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const textLayerRef = useRef<HTMLDivElement | null>(null);
  const renderTaskRef = useRef<RenderTask | null>(null);
  const touchSelectionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const touchSessionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const touchSelectingRef = useRef(false);
  const [pageSize, setPageSize] = useState<{ width: number; height: number } | null>(null);

  // Keep callbacks in a ref so unstable identities never restart the render loop.
  const callbacksRef = useRef({ onTextSelection, onTextLayerStatus, onBaseSize });
  useEffect(() => {
    callbacksRef.current = { onTextSelection, onTextLayerStatus, onBaseSize };
  });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const page = await pdf.getPage(pageNumber);
      if (cancelled) return;

      const base = page.getViewport({ scale: 1 });
      callbacksRef.current.onBaseSize?.({ width: base.width, height: base.height });

      const viewport = page.getViewport({ scale });
      const outputScale = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
      const cssWidth = Math.floor(viewport.width);
      const cssHeight = Math.floor(viewport.height);

      const canvas = canvasRef.current;
      const textLayerContainer = textLayerRef.current;
      const pageContainer = pageRef.current;
      if (!canvas || !textLayerContainer || !pageContainer) return;

      pageContainer.style.width = `${cssWidth}px`;
      pageContainer.style.height = `${cssHeight}px`;
      canvas.width = Math.floor(viewport.width * outputScale);
      canvas.height = Math.floor(viewport.height * outputScale);
      canvas.style.width = `${cssWidth}px`;
      canvas.style.height = `${cssHeight}px`;

      const task = page.render({
        canvas,
        viewport,
        transform: outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined,
      });
      renderTaskRef.current = task;
      await task.promise;
      if (cancelled) return;

      const textContent = await page.getTextContent();
      if (cancelled) return;
      callbacksRef.current.onTextLayerStatus?.(
        hasUsableTextLayer(textContent.items as Array<{ str?: string }>),
      );

      textLayerContainer.innerHTML = "";
      textLayerContainer.style.setProperty("--total-scale-factor", String(viewport.scale));
      const textLayer = new pdfjs.TextLayer({
        textContentSource: textContent,
        container: textLayerContainer,
        viewport,
      });
      await textLayer.render();
      if (cancelled) return;

      setPageSize({ width: cssWidth, height: cssHeight });
    })().catch((error: unknown) => {
      if (cancelled) return;
      if ((error as { name?: string })?.name === "RenderingCancelledException") return;
      callbacksRef.current.onTextLayerStatus?.(false);
    });

    return () => {
      cancelled = true;
      renderTaskRef.current?.cancel();
      renderTaskRef.current = null;
    };
  }, [pdfjs, pdf, pageNumber, scale]);

  const clearTouchTimers = useCallback(() => {
    if (touchSelectionTimerRef.current) {
      clearTimeout(touchSelectionTimerRef.current);
      touchSelectionTimerRef.current = null;
    }
    if (touchSessionTimeoutRef.current) {
      clearTimeout(touchSessionTimeoutRef.current);
      touchSessionTimeoutRef.current = null;
    }
  }, []);

  /**
   * Native mobile long-press selection can cancel the originating pointer
   * sequence. Keep the selection session armed across pointercancel and bound it
   * with a cleanup timer instead of leaving touch mode active indefinitely.
   */
  const armTouchSelectionSession = useCallback(() => {
    touchSelectingRef.current = true;
    if (touchSessionTimeoutRef.current) {
      clearTimeout(touchSessionTimeoutRef.current);
    }
    touchSessionTimeoutRef.current = setTimeout(() => {
      touchSessionTimeoutRef.current = null;
      touchSelectingRef.current = false;
      if (touchSelectionTimerRef.current) {
        clearTimeout(touchSelectionTimerRef.current);
        touchSelectionTimerRef.current = null;
      }
    }, 5000);
  }, []);

  /**
   * ONE anchor-building path for desktop mouse selection and touch/mobile
   * native selection. Returns true only when a candidate anchor was created and
   * the browser selection was consumed by the Add Comment flow.
   */
  const processSelection = useCallback((): boolean => {
    const selection = window.getSelection();
    const textLayerContainer = textLayerRef.current;
    const pageContainer = pageRef.current;
    if (!textLayerContainer || !pageContainer) return false;

    if (!selection || selection.isCollapsed) return false;

    // Read-only viewers (Rapporteur/Adviser/Facilitator, frozen/concluded,
    // Proposal Context) keep normal selection + copy: do not anchor and do
    // NOT clear the browser selection.
    if (!callbacksRef.current.onTextSelection) return false;

    const anchorNode = selection.anchorNode;
    const focusNode = selection.focusNode;
    const inside =
      (anchorNode && textLayerContainer.contains(anchorNode)) ||
      (focusNode && textLayerContainer.contains(focusNode));
    if (!inside) return false;

    const selectedText = selection.toString().replace(/\s+/g, " ").trim();
    if (!selectedText) return false;

    const box = pageContainer.getBoundingClientRect();
    const clientRects: PageRect[] = [];
    for (let i = 0; i < selection.rangeCount; i += 1) {
      const range = selection.getRangeAt(i);
      for (const rect of Array.from(range.getClientRects())) {
        if (rect.width <= 0 || rect.height <= 0) continue;
        clientRects.push({
          left: rect.left - box.left,
          top: rect.top - box.top,
          width: rect.width,
          height: rect.height,
        });
      }
    }
    if (clientRects.length === 0) return false;

    clearTouchTimers();
    touchSelectingRef.current = false;

    const anchor = buildAnchor({
      pageNumber,
      selectedText,
      clientRects,
      page: { width: box.width, height: box.height },
    });
    callbacksRef.current.onTextSelection?.(anchor);
    selection.removeAllRanges();
    return true;
  }, [clearTouchTimers, pageNumber]);

  const scheduleTouchSelection = useCallback(() => {
    if (!touchSelectingRef.current) return;
    armTouchSelectionSession();
    if (touchSelectionTimerRef.current) {
      clearTimeout(touchSelectionTimerRef.current);
    }
    // Let native selection handles settle before creating one candidate anchor.
    touchSelectionTimerRef.current = setTimeout(() => {
      touchSelectionTimerRef.current = null;
      processSelection();
    }, 180);
  }, [armTouchSelectionSession, processSelection]);

  useEffect(() => {
    const onSelectionChange = () => {
      if (!touchSelectingRef.current) return;
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;
      scheduleTouchSelection();
    };

    document.addEventListener("selectionchange", onSelectionChange);
    return () => {
      document.removeEventListener("selectionchange", onSelectionChange);
      clearTouchTimers();
      touchSelectingRef.current = false;
    };
  }, [clearTouchTimers, scheduleTouchSelection]);

  const handleMouseUp = useCallback(
    (event: { clientX: number; clientY: number }) => {
      if (processSelection()) return;

      const pageContainer = pageRef.current;
      if (!pageContainer) return;

      // A collapsed click: hit-test existing highlights so a highlight opens its
      // thread WITHOUT making the overlay intercept text selection (the overlay
      // stays pointer-events:none; we resolve the click against stored geometry).
      if (!onAnnotationSelect || annotations.length === 0) return;
      const box = pageContainer.getBoundingClientRect();
      const px = event.clientX - box.left;
      const py = event.clientY - box.top;
      const hit = annotations.find((annotation) =>
        denormalizeRects(annotation.anchor.rects, {
          width: box.width,
          height: box.height,
        }).some(
          (rect) =>
            px >= rect.left &&
            px <= rect.left + rect.width &&
            py >= rect.top &&
            py <= rect.top + rect.height,
        ),
      );
      if (hit) onAnnotationSelect(hit.id);
    },
    [annotations, onAnnotationSelect, processSelection],
  );

  return (
    <div
      ref={pageRef}
      className="mwPage"
      onMouseUp={handleMouseUp}
      onPointerDown={(event) => {
        if (event.pointerType === "touch") {
          armTouchSelectionSession();
        } else {
          clearTouchTimers();
          touchSelectingRef.current = false;
        }
      }}
      onPointerUp={(event) => {
        if (event.pointerType === "touch") scheduleTouchSelection();
      }}
      onPointerCancel={(event) => {
        // Native long-press selection legitimately cancels the pointer sequence.
        // Keep the mobile selection session armed so the following
        // selectionchange can still produce the pending anchor.
        if (event.pointerType === "touch") armTouchSelectionSession();
      }}
    >
      <canvas ref={canvasRef} className="mwCanvas" />
      <div ref={textLayerRef} className="mwTextLayer" />
      {pageSize && (
        <ManuscriptHighlightLayer
          pageSize={pageSize}
          annotations={annotations}
          focusedAnnotationId={focusedAnnotationId}
        />
      )}
    </div>
  );
}
