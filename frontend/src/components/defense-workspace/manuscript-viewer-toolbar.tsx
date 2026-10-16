"use client";

/**
 * CDW-2 — viewer toolbar: application-controlled page navigation + zoom.
 * Replaces the browser-native PDF toolbar with accessible, labelled controls.
 */

import { ChevronLeft, ChevronRight, Maximize2, ZoomIn, ZoomOut } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface ManuscriptViewerToolbarProps {
  pageNumber: number;
  totalPages: number;
  scale: number;
  disabled?: boolean;
  onPrevPage: () => void;
  onNextPage: () => void;
  onPageChange: (page: number) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitWidth: () => void;
}

export function ManuscriptViewerToolbar({
  pageNumber,
  totalPages,
  scale,
  disabled = false,
  onPrevPage,
  onNextPage,
  onPageChange,
  onZoomIn,
  onZoomOut,
  onFitWidth,
}: ManuscriptViewerToolbarProps) {
  const [pageDraft, setPageDraft] = useState<string | null>(null);

  const commitPage = () => {
    const raw = pageDraft ?? String(pageNumber);
    const parsed = Number.parseInt(raw, 10);
    if (Number.isFinite(parsed)) {
      onPageChange(parsed);
    }
    setPageDraft(null);
  };

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-(--earist-border-gray) px-2 py-2">
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label="Previous page"
          onClick={onPrevPage}
          disabled={disabled || pageNumber <= 1}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <form
          className="flex items-center gap-1"
          onSubmit={(event) => {
            event.preventDefault();
            commitPage();
          }}
        >
          <label htmlFor="mw-page-input" className="sr-only">
            Page number
          </label>
          <Input
            id="mw-page-input"
            inputMode="numeric"
            aria-label="Page number"
            className="h-8 w-14 text-center text-sm"
            value={pageDraft ?? String(pageNumber)}
            disabled={disabled || totalPages <= 0}
            onChange={(event) => setPageDraft(event.target.value)}
            onBlur={commitPage}
          />
          <span className="text-xs text-(--earist-body-text)" aria-live="polite">
            / {totalPages > 0 ? totalPages : "?"}
          </span>
        </form>

        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label="Next page"
          onClick={onNextPage}
          disabled={disabled || totalPages <= 0 || pageNumber >= totalPages}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="ml-auto flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label="Zoom out"
          onClick={onZoomOut}
          disabled={disabled}
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <span className="w-12 text-center text-xs tabular-nums text-(--earist-body-text)">
          {Math.round(scale * 100)}%
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label="Zoom in"
          onClick={onZoomIn}
          disabled={disabled}
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label="Fit page width"
          onClick={onFitWidth}
          disabled={disabled}
        >
          <Maximize2 className="mr-1 h-4 w-4" />
          Fit width
        </Button>
      </div>
    </div>
  );
}
