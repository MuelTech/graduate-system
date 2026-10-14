"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FileWarning } from "lucide-react";

/**
 * UIUX-4B: Student-local pre-submission preview (pure presentational shell).
 *
 * Renders a locally selected File through an object URL that the caller owns and
 * revokes — WITHOUT uploading anything. This is deliberately separate from the
 * authenticated DocumentViewer so the shared viewer's security contract is not
 * weakened to accept arbitrary local URLs.
 */
export function LocalFilePreviewDialog({
  open,
  onOpenChange,
  objectUrl,
  file,
  title = "Document preview",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  objectUrl: string | null;
  file: File | null;
  title?: string;
}) {
  const type = file?.type || "";
  const kind = type.includes("pdf")
    ? "pdf"
    : type.startsWith("image/")
      ? "image"
      : "other";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[80vh] flex-col p-0 sm:max-w-[min(92vw,1100px)]">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle className="truncate pr-8 text-base font-semibold">
            {file?.name || title}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Local preview of the selected file. Nothing is uploaded until you
            confirm and submit the application.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-hidden">
          {objectUrl && kind === "pdf" && (
            <iframe
              src={objectUrl}
              className="h-full w-full border-0"
              title={file?.name || title}
            />
          )}
          {objectUrl && kind === "image" && (
            <div className="flex h-full w-full items-center justify-center overflow-auto bg-muted/30 p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={objectUrl}
                alt={file?.name || title}
                className="max-h-full max-w-full"
              />
            </div>
          )}
          {objectUrl && kind === "other" && (
            <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
              <FileWarning className="h-10 w-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                This file type cannot be previewed here.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
