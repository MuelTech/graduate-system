"use client";

/**
 * CDW-2/CDW-3 — Collaborative Manuscript Viewer (controlled).
 *
 * Renders the EXACT authoritative ThesisDocument resolved by the server read model
 * inside the Defense Workspace, using a controlled pdf.js viewer instead of the
 * browser-native PDF chrome.
 *
 * Security: loads through the existing authenticated document proxy
 * (`/api/documents/thesis-document/<id>/file`); no storage path / public URL is
 * used. The source PDF is never modified — highlights are a separate overlay.
 *
 * CDW-3: this viewer is CONTROLLED. It no longer owns the annotation query; the
 * Student Document collaboration container is the single React Query source and
 * passes parsed annotations + selection callbacks in. It exposes text selection
 * and highlight selection to the parent and never writes.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, FileWarning, Loader2 } from "lucide-react";
import type { PDFDocumentProxy } from "pdfjs-dist";

import { type PdfAnchor } from "@/lib/pdf-annotation/anchors";
import type { CollaborationAnnotation } from "@/lib/pdf-annotation/annotations";
import {
  DEFAULT_ZOOM,
  clampPage,
  computeFitWidthScale,
  resolveFocusPage,
  stepPage,
  zoomIn as zoomInScale,
  zoomOut as zoomOutScale,
} from "@/lib/pdf-annotation/viewer-core";

import { ManuscriptPage } from "./manuscript-page";
import { ManuscriptViewerToolbar } from "./manuscript-viewer-toolbar";

import "./manuscript-viewer.css";

type PdfJsModule = typeof import("pdfjs-dist");

let pdfjsPromise: Promise<PdfJsModule> | null = null;

/** Load + configure pdf.js once (worker bundled via the CDW-0-proven pattern). */
function getPdfjs(): Promise<PdfJsModule> {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist").then((mod) => {
      mod.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url,
      ).toString();
      return mod;
    });
  }
  return pdfjsPromise;
}

type ViewerErrorCode = "unauthorized" | "forbidden" | "not_found" | "invalid" | "load_failed";

const ERROR_MESSAGES: Record<ViewerErrorCode, string> = {
  unauthorized: "Your session has expired. Please sign in again to view this document.",
  forbidden: "You do not have access to this document.",
  not_found: "This document could not be found.",
  invalid: "This document could not be displayed (it may be corrupted or unsupported).",
  load_failed: "The document could not be loaded. Please try again.",
};

function mapStatus(status: number): ViewerErrorCode {
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  return "load_failed";
}

export interface CollaborativeManuscriptViewerProps {
  /** EXACT authoritative ThesisDocument id from the server read model. */
  documentId: string;
  documentLabel?: string;
  /** Parsed collaboration annotations for this exact document (controlled). */
  annotations?: CollaborationAnnotation[];
  /** Unsaved selection draft (presentation only, never persisted here). */
  pendingAnchor?: PdfAnchor | null;
  /** Report a new text selection as a candidate anchor (not persisted here). */
  onTextSelection?: (anchor: PdfAnchor) => void;
  /** Open the existing Shared Comments drawer for the pending selection. */
  onOpenPendingComments?: () => void;
  /** Select an existing highlight's thread (CDW-3 focus contract). */
  onAnnotationSelect?: (annotationId: string) => void;
  /** Navigate to + emphasize a specific annotation. */
  focusedAnnotationId?: string | null;
  className?: string;
}

export function CollaborativeManuscriptViewer({
  documentId,
  documentLabel,
  annotations = [],
  pendingAnchor = null,
  onTextSelection,
  onOpenPendingComments,
  onAnnotationSelect,
  focusedAnnotationId = null,
  className,
}: CollaborativeManuscriptViewerProps) {
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "empty">("loading");
  const [errorCode, setErrorCode] = useState<ViewerErrorCode | null>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [pdfjs, setPdfjs] = useState<PdfJsModule | null>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState<number>(DEFAULT_ZOOM);
  const [fitMode, setFitMode] = useState(true);
  const [baseSize, setBaseSize] = useState<{ width: number; height: number } | null>(null);
  const [textAvailable, setTextAvailable] = useState(true);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const loadingTaskRef = useRef<ReturnType<PdfJsModule["getDocument"]> | null>(null);

  const annotationsByPage = useMemo(() => {
    const map = new Map<number, CollaborationAnnotation[]>();
    for (const annotation of annotations) {
      const list = map.get(annotation.anchor.pageNumber) ?? [];
      list.push(annotation);
      map.set(annotation.anchor.pageNumber, list);
    }
    return map;
  }, [annotations]);

  // --- Load the EXACT document, once per documentId ---
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    (async () => {
      setStatus("loading");
      setErrorCode(null);
      setTextAvailable(true);
      setPageNumber(1);
      setScale(DEFAULT_ZOOM);
      setFitMode(true);
      setBaseSize(null);
      if (!documentId) {
        setStatus("empty");
        return;
      }
      try {
        const pdfjsModule = await getPdfjs();
        if (cancelled) return;
        const response = await fetch(
          `/api/documents/thesis-document/${encodeURIComponent(documentId)}/file`,
          { signal: controller.signal, cache: "no-store" },
        );
        if (!response.ok) {
          if (cancelled) return;
          setErrorCode(mapStatus(response.status));
          setStatus("error");
          return;
        }
        const data = new Uint8Array(await response.arrayBuffer());
        const loadingTask = pdfjsModule.getDocument({ data });
        loadingTaskRef.current = loadingTask;
        const doc = await loadingTask.promise;
        if (cancelled) {
          void loadingTask.destroy();
          return;
        }
        setPdfjs(pdfjsModule);
        setPdf(doc);
        setTotalPages(doc.numPages);
        setStatus("ready");
      } catch (error) {
        if (cancelled || (error as { name?: string })?.name === "AbortError") return;
        setErrorCode("invalid");
        setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
      void loadingTaskRef.current?.destroy();
      loadingTaskRef.current = null;
      setPdf(null);
    };
  }, [documentId]);

  // --- Fit width: react to container resize while fit mode is active ---
  // Recomputes the fit scale from the container width WITHOUT refetching the PDF
  // or reloading the document (the getDocument effect only depends on documentId).
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const applyFit = () => {
      if (!fitMode || !baseSize) return;
      setScale(computeFitWidthScale(baseSize.width, container.clientWidth, 32));
    };
    void (async () => {
      applyFit();
    })();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(applyFit);
    observer.observe(container);
    return () => observer.disconnect();
  }, [fitMode, baseSize]);

  // --- Focus contract: navigate to the focused annotation's page ---
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const targetPage = resolveFocusPage(annotations, focusedAnnotationId);
      if (cancelled || targetPage === null) return;
      setPageNumber(clampPage(targetPage, totalPages || targetPage));
      scrollRef.current?.scrollTo({ top: 0 });
    })();
    return () => {
      cancelled = true;
    };
  }, [focusedAnnotationId, annotations, totalPages]);

  const handleBaseSize = useCallback((size: { width: number; height: number }) => {
    setBaseSize((current) =>
      current && current.width === size.width && current.height === size.height ? current : size,
    );
  }, []);

  const handlePageChange = useCallback(
    (page: number) => {
      setPageNumber(clampPage(page, totalPages));
      scrollRef.current?.scrollTo({ top: 0 });
    },
    [totalPages],
  );

  const currentPageAnnotations = annotationsByPage.get(pageNumber) ?? [];

  return (
    <div className={"flex h-full min-h-0 flex-col " + (className ?? "")}>
      <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-(--earist-border-gray) bg-(--earist-surface-gray)">
        {documentLabel && (
          <div className="shrink-0 border-b border-(--earist-border-gray) px-3 py-1.5 text-[14px] font-medium text-(--earist-body-text)">
            {documentLabel}
          </div>
        )}

        {status === "ready" && (
          <ManuscriptViewerToolbar
            pageNumber={pageNumber}
            totalPages={totalPages}
            scale={scale}
            disabled={!pdf || !pdfjs}
            onPrevPage={() => handlePageChange(stepPage(pageNumber, -1, totalPages))}
            onNextPage={() => handlePageChange(stepPage(pageNumber, 1, totalPages))}
            onPageChange={handlePageChange}
            onZoomIn={() => {
              setFitMode(false);
              setScale((value) => zoomInScale(value));
            }}
            onZoomOut={() => {
              setFitMode(false);
              setScale((value) => zoomOutScale(value));
            }}
            onFitWidth={() => setFitMode(true)}
          />
        )}

        {status === "ready" && !textAvailable && (
          <p
            role="status"
            aria-live="polite"
            className="shrink-0 border-b border-(--earist-border-gray) bg-amber-50 px-3 py-1.5 text-[14px] text-amber-800"
          >
            Text selection and highlighting are unavailable for this document (no
            extractable text layer).
          </p>
        )}

        <div
          ref={scrollRef}
          className="flex min-h-0 flex-1 justify-center overflow-auto p-3"
        >
          {status === "loading" && (
            <div
              role="status"
              aria-live="polite"
              className="flex items-center justify-center gap-2 self-center"
            >
              <Loader2 className="h-7 w-7 animate-spin text-(--earist-primary)" aria-hidden="true" />
              <span className="text-sm text-(--earist-body-text)">Loading document…</span>
            </div>
          )}

          {status === "empty" && (
            <p className="self-center text-sm text-(--earist-body-text)">
              No document is available for this session.
            </p>
          )}

          {status === "error" && (
            <div
              role="alert"
              className="flex flex-col items-center justify-center gap-2 self-center text-center"
            >
              {errorCode === "invalid" ? (
                <FileWarning className="h-6 w-6 text-amber-600" aria-hidden="true" />
              ) : (
                <AlertCircle className="h-6 w-6 text-red-600" aria-hidden="true" />
              )}
              <p className="max-w-sm break-words text-sm text-(--earist-body-text)">
                {errorCode ? ERROR_MESSAGES[errorCode] : ERROR_MESSAGES.load_failed}
              </p>
            </div>
          )}

          {status === "ready" && pdf && pdfjs && (
            <ManuscriptPage
              pdfjs={pdfjs}
              pdf={pdf}
              pageNumber={pageNumber}
              scale={scale}
              annotations={currentPageAnnotations}
              focusedAnnotationId={focusedAnnotationId}
              pendingAnchor={pendingAnchor}
              onTextSelection={onTextSelection}
              onOpenPendingComments={onOpenPendingComments}
              onAnnotationSelect={onAnnotationSelect}
              onTextLayerStatus={setTextAvailable}
              onBaseSize={handleBaseSize}
            />
          )}
        </div>
      </div>
    </div>
  );
}
