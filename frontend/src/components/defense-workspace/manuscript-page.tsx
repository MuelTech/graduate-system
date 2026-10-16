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

import { buildAnchor, type PageRect, type PdfAnchor } from "@/lib/pdf-annotation/anchors";
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
  onTextLayerStatus,
  onBaseSize,
}: ManuscriptPageProps) {
  const pageRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const textLayerRef = useRef<HTMLDivElement | null>(null);
  const renderTaskRef = useRef<RenderTask | null>(null);
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

  const handleMouseUp = useCallback(() => {
    const selection = window.getSelection();
    const textLayerContainer = textLayerRef.current;
    const pageContainer = pageRef.current;
    if (!selection || selection.isCollapsed || !textLayerContainer || !pageContainer) return;

    const anchorNode = selection.anchorNode;
    const focusNode = selection.focusNode;
    const inside =
      (anchorNode && textLayerContainer.contains(anchorNode)) ||
      (focusNode && textLayerContainer.contains(focusNode));
    if (!inside) return;

    const selectedText = selection.toString().replace(/\s+/g, " ").trim();
    if (!selectedText) return;

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
    if (clientRects.length === 0) return;

    const anchor = buildAnchor({
      pageNumber,
      selectedText,
      clientRects,
      page: { width: box.width, height: box.height },
    });
    callbacksRef.current.onTextSelection?.(anchor);
    selection.removeAllRanges();
  }, [pageNumber]);

  return (
    <div ref={pageRef} className="mwPage" onMouseUp={handleMouseUp}>
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
