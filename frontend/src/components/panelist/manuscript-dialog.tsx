"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClientRequest, ApiError } from "@/lib/api.client";
import { cn } from "@/lib/utils";
import { DocumentViewer } from "@/components/ui/document-viewer";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertCircle, FileText, Loader2, RefreshCw } from "lucide-react";

export interface ManuscriptTarget {
  scheduleId: string;
  studentName: string;
}

interface WorkspaceDocument {
  id: string;
  displayName: string;
}

/**
 * Only the fields this dialog needs. The authoritative, assignment-scoped,
 * stage-aware selection is performed by the Defense Workspace read model — this
 * component never enumerates `thesisDocuments` and never filters access itself.
 */
interface DefenseWorkspaceLite {
  documents: WorkspaceDocument[];
}

function resolveErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.statusCode === 409) {
      return "The certified manuscript is unavailable for this defense session.";
    }
    if (error.statusCode === 403) {
      return "You are not authorized to view this manuscript.";
    }
    if (error.statusCode === 404) {
      return "This defense session could not be found.";
    }
    return error.message || "Unable to resolve the manuscript.";
  }
  return error instanceof Error
    ? error.message
    : "Unable to resolve the manuscript.";
}

/**
 * Resolves the single authorized research paper for a selected defense via
 * `GET /thesis/defense/:scheduleId/workspace`, then opens the existing
 * authenticated DocumentViewer. It never falls back to an unrelated document.
 */
export function ManuscriptDialog({
  target,
  onClose,
}: {
  target: ManuscriptTarget | null;
  onClose: () => void;
}) {
  const open = target !== null;
  const scheduleId = target?.scheduleId;

  const query = useQuery<DefenseWorkspaceLite>({
    queryKey: ["defenseWorkspace", scheduleId],
    queryFn: async () =>
      (await apiClientRequest(
        `/thesis/defense/${scheduleId}/workspace`,
      )) as DefenseWorkspaceLite,
    enabled: open,
    retry: false,
    staleTime: 30_000,
  });

  if (!open || !target) return null;

  const document = query.data?.documents?.[0] ?? null;

  if (document) {
    return (
      <DocumentViewer
        open
        onOpenChange={(next) => {
          if (!next) onClose();
        }}
        fetchUrl={`/api/documents/thesis-document/${document.id}/file`}
        title={document.displayName || `${target.studentName} — Manuscript`}
      />
    );
  }

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="truncate pr-6">
            {target.studentName} — Manuscript
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-3 py-6 text-center">
          {query.isLoading ? (
            <>
              <Loader2
                className="h-8 w-8 animate-spin text-(--earist-primary)"
                aria-hidden="true"
              />
              <p className="text-sm text-(--earist-body-text)">
                Resolving the authorized manuscript…
              </p>
            </>
          ) : query.isError ? (
            <>
              <AlertCircle
                className="h-8 w-8 text-(--earist-secondary)"
                aria-hidden="true"
              />
              <p className="max-w-sm text-sm text-(--earist-body-text)">
                {resolveErrorMessage(query.error)}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => query.refetch()}
                disabled={query.isFetching}
              >
                <RefreshCw
                  className={cn(
                    "mr-2 h-4 w-4",
                    query.isFetching && "animate-spin",
                  )}
                  aria-hidden="true"
                />
                Retry
              </Button>
            </>
          ) : (
            <>
              <FileText
                className="h-8 w-8 text-(--earist-body-text)/40"
                aria-hidden="true"
              />
              <p className="text-sm font-medium text-(--earist-primary)">
                No manuscript is available
              </p>
              <p className="max-w-sm text-sm text-(--earist-body-text)">
                This defense does not have an authorized research paper to view
                yet.
              </p>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
