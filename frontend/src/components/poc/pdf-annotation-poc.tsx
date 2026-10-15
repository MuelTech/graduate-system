"use client";

/**
 * CDW-0A — PDF annotation proof of concept (throwaway, isolated).
 *
 * Proves the pieces the collaborative Defense Workspace (CDW-2/CDW-3) depends on:
 *   1. load an authenticated thesis PDF through the EXISTING secure proxy route;
 *   2. render it with a controllable pdf.js canvas + text layer;
 *   3. select text and create a visual highlight;
 *   4. serialize the highlight (page + text + normalized geometry + version);
 *   5. restore the serialized highlight after reload;
 *   6. change zoom and keep the highlight anchored.
 *
 * The source PDF is never modified. Highlights are a separate overlay persisted
 * only to localStorage (no database, no migration). This component is NOT wired
 * into the production Defense Workspace.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import {
  type PdfAnchor,
  buildAnchor,
  deserializeAnchor,
} from "@/lib/pdf-annotation/anchors";

import "./pdf-annotation-poc.css";

const ZOOM_LEVELS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;
const DEFAULT_ZOOM = 1;
const ANCHORS_STORAGE_PREFIX = "cdw0:pdf-anchors:";

type Status = "idle" | "loading" | "ready" | "error";
type PdfJsModule = typeof import("pdfjs-dist");
type PdfDocument = Awaited<ReturnType<PdfJsModule["getDocument"]>["promise"]>;

function storageKey(documentId: string): string {
  return `${ANCHORS_STORAGE_PREFIX}${documentId}`;
}

function loadStoredAnchors(documentId: string): PdfAnchor[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(storageKey(documentId));
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const anchors: PdfAnchor[] = [];
    for (const item of parsed) {
      try {
        anchors.push(deserializeAnchor(JSON.stringify(item)));
      } catch {
        // Skip any entry we cannot interpret instead of failing the reload.
      }
    }
    return anchors;
  } catch {
    return [];
  }
}

function persistAnchors(documentId: string, anchors: PdfAnchor[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey(documentId), JSON.stringify(anchors));
}

export function PdfAnnotationPoc({ documentId }: { documentId: string }) {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState<number>(DEFAULT_ZOOM);
  const [anchors, setAnchors] = useState<PdfAnchor[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const pdfjsRef = useRef<PdfJsModule | null>(null);
  const docRef = useRef<PdfDocument | null>(null);
  const loadingTaskRef = useRef<ReturnType<PdfJsModule["getDocument"]> | null>(null);
  const renderTokenRef = useRef(0);
  const pageRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const textLayerRef = useRef<HTMLDivElement | null>(null);

  // 1. Load the authenticated PDF through the existing secure proxy route.
  useEffect(() => {
    if (!documentId) return;
    let cancelled = false;

    (async () => {
      setStatus("loading");
      setError(null);
      setNumPages(0);
      setPageNumber(1);
      setAnchors(loadStoredAnchors(documentId));
      try {
        const pdfjs = pdfjsRef.current ?? (await import("pdfjs-dist"));
        pdfjsRef.current = pdfjs;
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url,
        ).toString();

        const response = await fetch(
          `/api/documents/thesis-document/${documentId}/file`,
          { credentials: "include", cache: "no-store" },
        );
        if (!response.ok) {
          throw new Error(
            `Secure document fetch failed (HTTP ${response.status}). ` +
              "Sign in and confirm you are authorized for this document.",
          );
        }
        const data = new Uint8Array(await response.arrayBuffer());
        const loadingTask = pdfjs.getDocument({ data });
        loadingTaskRef.current = loadingTask;
        const doc = await loadingTask.promise;
        if (cancelled) return;
        docRef.current = doc;
        setNumPages(doc.numPages);
        setStatus("ready");
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setStatus("error");
        }
      }
    })();

    return () => {
      cancelled = true;
      void loadingTaskRef.current?.destroy();
      loadingTaskRef.current = null;
      docRef.current = null;
    };
  }, [documentId]);

  // 2. Render the current page (canvas + selectable text layer) at the current zoom.
  useEffect(() => {
    if (status !== "ready") return;
    const doc = docRef.current;
    const canvas = canvasRef.current;
    const textLayerContainer = textLayerRef.current;
    const pageContainer = pageRef.current;
    const pdfjs = pdfjsRef.current;
    if (!doc || !canvas || !textLayerContainer || !pageContainer || !pdfjs) return;

    const token = ++renderTokenRef.current;

    (async () => {
      try {
        const page = await doc.getPage(pageNumber);
        if (token !== renderTokenRef.current) return;
        const viewport = page.getViewport({ scale });
        const outputScale =
          typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
        const cssWidth = Math.floor(viewport.width);
        const cssHeight = Math.floor(viewport.height);

        pageContainer.style.width = `${cssWidth}px`;
        pageContainer.style.height = `${cssHeight}px`;
        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = `${cssWidth}px`;
        canvas.style.height = `${cssHeight}px`;

        await page.render({
          canvas,
          viewport,
          transform:
            outputScale !== 1
              ? [outputScale, 0, 0, outputScale, 0, 0]
              : undefined,
        }).promise;
        if (token !== renderTokenRef.current) return;

        const textContent = await page.getTextContent();
        if (token !== renderTokenRef.current) return;
        textLayerContainer.innerHTML = "";
        textLayerContainer.style.setProperty(
          "--total-scale-factor",
          String(viewport.scale),
        );
        const textLayer = new pdfjs.TextLayer({
          textContentSource: textContent,
          container: textLayerContainer,
          viewport,
        });
        await textLayer.render();
      } catch (err) {
        if (token === renderTokenRef.current) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    })();
  }, [status, pageNumber, scale]);

  // 3. Create a highlight from the current text selection.
  const handleMouseUp = useCallback(() => {
    const selection = window.getSelection();
    const pageContainer = pageRef.current;
    const textLayerContainer = textLayerRef.current;
    if (!selection || selection.isCollapsed || !pageContainer || !textLayerContainer) {
      return;
    }
    const anchorNode = selection.anchorNode;
    const focusNode = selection.focusNode;
    const insideTextLayer =
      (anchorNode && textLayerContainer.contains(anchorNode)) ||
      (focusNode && textLayerContainer.contains(focusNode));
    if (!insideTextLayer) return;

    const selectedText = selection.toString().replace(/\s+/g, " ").trim();
    if (!selectedText) return;

    const pageBox = pageContainer.getBoundingClientRect();
    const clientRects: { left: number; top: number; width: number; height: number }[] = [];
    for (let i = 0; i < selection.rangeCount; i++) {
      const range = selection.getRangeAt(i);
      for (const rect of Array.from(range.getClientRects())) {
        if (rect.width <= 0 || rect.height <= 0) continue;
        clientRects.push({
          left: rect.left - pageBox.left,
          top: rect.top - pageBox.top,
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
      page: { width: pageBox.width, height: pageBox.height },
    });

    setAnchors((prev) => {
      const next = [...prev, anchor];
      persistAnchors(documentId, next);
      return next;
    });
    selection.removeAllRanges();
    setMessage(`Highlighted ${anchor.rects.length} line(s) on page ${pageNumber}.`);
  }, [documentId, pageNumber]);

  // 4. Reload/restore from serialized storage (simulates a page reload).
  const handleReloadFromStorage = useCallback(() => {
    const restored = loadStoredAnchors(documentId);
    setAnchors(restored);
    setMessage(`Restored ${restored.length} highlight(s) from serialized storage.`);
  }, [documentId]);

  const handleClearAll = useCallback(() => {
    setAnchors([]);
    persistAnchors(documentId, []);
    setMessage("Cleared all highlights for this document.");
  }, [documentId]);

  const pageAnchors = anchors.filter((a) => a.pageNumber === pageNumber);
  const totalRects = anchors.reduce((sum, a) => sum + a.rects.length, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="rounded border px-3 py-1.5 text-sm disabled:opacity-40"
          onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
          disabled={pageNumber <= 1}
        >
          ← Prev
        </button>
        <span className="text-sm tabular-nums">
          Page {pageNumber} / {numPages || "?"}
        </span>
        <button
          type="button"
          className="rounded border px-3 py-1.5 text-sm disabled:opacity-40"
          onClick={() => setPageNumber((p) => Math.min(numPages || p, p + 1))}
          disabled={numPages > 0 && pageNumber >= numPages}
        >
          Next →
        </button>

        <span className="mx-2 h-5 w-px bg-current/20" />

        <label className="text-sm" htmlFor="cdw0-zoom">
          Zoom
        </label>
        <input
          id="cdw0-zoom"
          type="range"
          min={0}
          max={ZOOM_LEVELS.length - 1}
          step={1}
          value={ZOOM_LEVELS.indexOf(scale as (typeof ZOOM_LEVELS)[number])}
          onChange={(e) => setScale(ZOOM_LEVELS[Number(e.target.value)])}
        />
        <span className="text-sm tabular-nums">{Math.round(scale * 100)}%</span>

        <span className="mx-2 h-5 w-px bg-current/20" />

        <button
          type="button"
          className="rounded border px-3 py-1.5 text-sm"
          onClick={handleReloadFromStorage}
        >
          Reload from storage
        </button>
        <button
          type="button"
          className="rounded border px-3 py-1.5 text-sm disabled:opacity-40"
          onClick={handleClearAll}
          disabled={anchors.length === 0}
        >
          Clear all
        </button>
      </div>

      <p className="text-sm text-current/70">
        Select text in the document to create a highlight. Highlights are stored
        as serialized anchors (page + text + normalized geometry) and restored on
        reload and zoom.
      </p>

      {message && (
        <p className="rounded bg-emerald-50 px-3 py-1.5 text-sm text-emerald-800">
          {message}
        </p>
      )}
      {status === "loading" && <p className="text-sm">Loading secure PDF…</p>}
      {status === "error" && (
        <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
      )}

      <div className="flex gap-4">
        <div className="min-w-0 flex-1 overflow-auto rounded border bg-neutral-100 p-4">
          <div
            ref={pageRef}
            className="cdw0Page"
            onMouseUp={handleMouseUp}
          >
            <canvas ref={canvasRef} className="cdw0Canvas" />
            <div ref={textLayerRef} className="cdw0TextLayer" />
            <div className="cdw0Overlay">
              {pageAnchors.flatMap((anchor, ai) =>
                anchor.rects.map((rect, ri) => (
                  <div
                    key={`${ai}-${ri}`}
                    className="cdw0Highlight"
                    title={anchor.selectedText}
                    style={{
                      left: `${rect.x * 100}%`,
                      top: `${rect.y * 100}%`,
                      width: `${rect.width * 100}%`,
                      height: `${rect.height * 100}%`,
                    }}
                  />
                )),
              )}
            </div>
          </div>
        </div>

        <aside className="w-80 shrink-0 space-y-3 text-sm">
          <div>
            <p className="font-medium">
              Highlights: {anchors.length} ({totalRects} rects)
            </p>
            <p className="text-current/60">
              On this page: {pageAnchors.length}
            </p>
          </div>
          <ol className="space-y-2">
            {anchors.map((anchor, index) => (
              <li
                key={`${anchor.pageNumber}-${index}`}
                className="rounded border p-2"
              >
                <p className="font-medium">Page {anchor.pageNumber}</p>
                <p className="line-clamp-3 text-current/80">
                  {anchor.selectedText || "(no text)"}
                </p>
              </li>
            ))}
          </ol>
          {anchors.length > 0 && (
            <details>
              <summary className="cursor-pointer">Serialized anchor JSON</summary>
              <pre className="mt-2 max-h-64 overflow-auto rounded bg-neutral-900 p-2 text-xs text-neutral-100">
                {JSON.stringify(anchors, null, 2)}
              </pre>
            </details>
          )}
        </aside>
      </div>
    </div>
  );
}
