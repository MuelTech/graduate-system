"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClientRequest } from "@/lib/api.client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { DocumentViewer } from "@/components/ui/document-viewer";
import { Clock, FileText, Eye, Info, RefreshCw } from "lucide-react";

interface CurrentEvidenceDto {
  id: string;
  docType: string;
  defenseStage: string | null;
  originalFilename: string | null;
  sizeBytes: number | null;
  uploadedAt: string;
  isCurrent: boolean;
}

interface CurrentApplicationDto {
  thesisId: string;
  stage: string;
  status: string;
  rejectionReason: string | null;
  evidence: CurrentEvidenceDto[];
}

function formatBytes(bytes: number | null | undefined): string | null {
  if (bytes == null) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

/**
 * UIUX-4B: immediate post-submission receipt state for the Student Title
 * Defense application (defenseStatus = APPLICATION_UNDER_REVIEW). Shows the
 * authoritative current Title Defense Proposal Package via the safe
 * GET /thesis/defense/current DTO and the authenticated DocumentViewer.
 * This is not the later Approved/Scheduled redesign (UIUX-4C).
 */
export function TitleDefenseUnderReview() {
  const [viewerOpen, setViewerOpen] = useState(false);

  const {
    data: application,
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useQuery<CurrentApplicationDto | null>({
    queryKey: ["student", "thesis", "current-application"],
    queryFn: async () => apiClientRequest("/thesis/defense/current"),
  });

  const currentPackage =
    (application?.evidence ?? []).find(
      (e) => e.docType === "TITLE_PROPOSAL" && e.isCurrent,
    ) ?? null;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader
        title="Title Defense"
        description="Your application has been submitted and is under Graduate School review."
      />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-(--earist-secondary)">
            <Clock className="h-4 w-4 text-amber-600" />
            Under Graduate School Review
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-(--earist-body-text)">
          <p>
            Your Title Defense application was submitted successfully. Graduate
            School review is the next responsibility — no action is required from
            you right now.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
            />
            {isFetching ? "Refreshing…" : "Refresh Status"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-(--earist-secondary)">
            Title Defense Proposal Package
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {isLoading && (
            <p className="text-(--earist-body-text)">Loading submitted package…</p>
          )}
          {isError && (
            <div className="space-y-2">
              <p className="text-(--earist-body-text)">
                Unable to load the submitted package.
              </p>
              <Button type="button" variant="outline" size="sm" onClick={() => refetch()}>
                Try again
              </Button>
            </div>
          )}
          {!isLoading && !isError && !currentPackage && (
            <p className="text-(--earist-body-text)">
              Your submitted proposal package is being processed. Refresh if it
              does not appear.
            </p>
          )}
          {currentPackage && (
            <div className="flex flex-col gap-3 rounded-lg border border-(--earist-border-gray) p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded bg-(--earist-surface-gray)">
                  <FileText className="h-4 w-4 text-(--earist-primary)" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-(--earist-primary)">
                    {currentPackage.originalFilename || "Proposal Package"}
                  </p>
                  <p className="text-xs text-(--earist-body-text)">
                    {[
                      formatBytes(currentPackage.sizeBytes),
                      `Submitted ${new Date(
                        currentPackage.uploadedAt,
                      ).toLocaleDateString()}`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge variant="outline" className="text-(--earist-success)">
                  On file
                </Badge>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setViewerOpen(true)}
                >
                  <Eye className="mr-1 h-4 w-4" /> View
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-start gap-2 rounded-lg border border-(--earist-border-gray) bg-(--earist-surface-gray) p-3 text-xs text-(--earist-body-text)">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-(--earist-secondary)" />
        <div>
          <p className="font-medium text-(--earist-secondary)">
            Need to correct a submitted document?
          </p>
          <p>
            Documents under active review cannot currently be replaced directly
            by the Student. If a correction is required, the Graduate School can
            return the application so you can upload a replacement.
          </p>
        </div>
      </div>

      {currentPackage && (
        <DocumentViewer
          open={viewerOpen}
          onOpenChange={setViewerOpen}
          fetchUrl={`/api/documents/thesis-document/${currentPackage.id}/file`}
          title={currentPackage.originalFilename || "Title Defense Proposal Package"}
        />
      )}
    </div>
  );
}
