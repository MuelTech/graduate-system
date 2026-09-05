// frontend/src/components/ui/document-viewer.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, RotateCcw, Loader2, AlertCircle } from "lucide-react";

interface DocumentViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fetchUrl: string;
  title?: string;
}

type LoadState = "idle" | "loading" | "loaded" | "error";

export function DocumentViewer({
  open,
  onOpenChange,
  fetchUrl,
  title,
}: DocumentViewerProps) {
  const { data: session } = useSession();
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>("");
  const [zoom, setZoom] = useState(100);
  const [errorMessage, setErrorMessage] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const blobRef = useRef<string | null>(null);

  const cleanup = () => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    if (blobRef.current) {
      URL.revokeObjectURL(blobRef.current);
      blobRef.current = null;
      setBlobUrl(null);
    }
  };

  useEffect(() => {
    if (!open || !fetchUrl) {
      cleanup();
      setLoadState("idle");
      setMimeType("");
      setZoom(100);
      setErrorMessage("");
      return;
    }

    const fetchDocument = async () => {
      cleanup();
      setLoadState("loading");
      setZoom(100);
      setErrorMessage("");

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const token = (session as any)?.user?.accessToken;
        const headers: Record<string, string> = {};
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }

        const response = await fetch(fetchUrl, {
          headers,
          signal: controller.signal,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => null);
          throw new Error(errorData?.error || `Failed to load document (${response.status})`);
        }

        const ct = response.headers.get("Content-Type") || "";
        setMimeType(ct);

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        blobRef.current = url;
        setBlobUrl(url);
        setLoadState("loaded");
      } catch (err: any) {
        if (err.name === "AbortError") return;
        setLoadState("error");
        setErrorMessage(err.message || "Failed to load document");
      }
    };

    fetchDocument();

    return cleanup;
  }, [open, fetchUrl, session]);

  const isPdf = mimeType.includes("application/pdf");
  const isImage = mimeType.includes("image/jpeg") || mimeType.includes("image/png");

  const handleZoomIn = () => setZoom((z) => Math.min(z + 25, 200));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 25, 50));
  const handleZoomReset = () => setZoom(100);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[85vh] flex flex-col p-0">
        <DialogHeader className="flex flex-row items-center justify-between border-b px-6 py-4">
          <DialogTitle className="text-lg font-semibold truncate pr-4">
            {title || "Document"}
          </DialogTitle>
          {isImage && loadState === "loaded" && (
            <div className="flex items-center gap-1 shrink-0">
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleZoomOut}>
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground w-12 text-center">{zoom}%</span>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleZoomIn}>
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleZoomReset}>
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {loadState === "loading" && (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-(--earist-primary)" />
              <span className="ml-3 text-sm text-muted-foreground">Loading document...</span>
            </div>
          )}

          {loadState === "error" && (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <AlertCircle className="h-10 w-10 text-red-500" />
              <p className="text-sm text-muted-foreground">{errorMessage}</p>
            </div>
          )}

          {loadState === "loaded" && isPdf && blobUrl && (
            <iframe
              src={blobUrl}
              className="w-full h-full border-0"
              title={title || "Document"}
            />
          )}

          {loadState === "loaded" && isImage && blobUrl && (
            <div className="w-full h-full overflow-auto flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
              <img
                src={blobUrl}
                alt={title || "Document"}
                className="max-w-full transition-transform duration-200"
                style={{ transform: `scale(${zoom / 100})`, transformOrigin: "center center" }}
              />
            </div>
          )}

          {loadState === "loaded" && !isPdf && !isImage && (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <p className="text-sm text-muted-foreground">
                File type not supported for preview.
              </p>
              <p className="text-xs text-muted-foreground">Content-Type: {mimeType}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
