"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClientRequest, ApiError } from "@/lib/api.client";
import {
  adviserAdviseeDetailQueryKey,
  adviserReviewStatusLabel,
  adviserWorkspaceQueryKey,
  formatWorkspaceDate,
  workspaceStageLabel,
} from "@/lib/adviser-workspace";
import {
  adviserReviewBasePath,
  adviserReviewTaskPath,
  adviserReviewTaskQueryKey,
  adviserReviewsQueueQueryKey,
  isFinalStrikeBlocked,
  isCertificationConfirmationReady,
  type AdviserReviewStageKey,
  type AdviserReviewTaskDetail,
} from "@/lib/adviser-reviews";
import { panelistDashboardQueryKey } from "@/lib/panelist-dashboard";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DocumentViewer } from "@/components/ui/document-viewer";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ESignaturePad } from "@/components/defense-workspace/e-signature-pad";
import { AdviserCertificationRecords, adviserCertificationRecordsQueryKey } from "@/components/shared/adviser-certification-records";
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  RefreshCw,
} from "lucide-react";

const STALE_REVIEW_MESSAGE =
  "The manuscript or review state changed. Review the latest version before continuing.";

/**
 * ADV-6 — the one shared Adviser Proposal/Final review action surface.
 *
 * Existing stage-specific task/mutation endpoints remain authoritative. This
 * component owns only task fetching, exact manuscript concurrency, stale-409
 * refresh, and the shared image-evidence signature input.
 */
export function AdviserReviewActionPanel({
  open,
  onOpenChange,
  stage,
  thesisId,
  studentName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stage: AdviserReviewStageKey;
  thesisId: string;
  studentName?: string | null;
}) {
  const queryClient = useQueryClient();
  const [remarks, setRemarks] = useState("");
  const [signature, setSignature] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmCertify, setConfirmCertify] = useState(false);
  const [confirmationDocumentId, setConfirmationDocumentId] = useState<string | null>(null);
  const [acknowledgedDocumentId, setAcknowledgedDocumentId] = useState<string | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);

  const taskQuery = useQuery<AdviserReviewTaskDetail>({
    queryKey: adviserReviewTaskQueryKey(stage, thesisId),
    queryFn: async () =>
      (await apiClientRequest(
        adviserReviewTaskPath(stage, thesisId),
      )) as AdviserReviewTaskDetail,
    enabled: open && Boolean(thesisId),
    retry: false,
  });

  const task = taskQuery.data ?? null;
  const taskStudentId = task?.student?.id ?? null;

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: adviserReviewTaskQueryKey(stage, thesisId),
      }),
      queryClient.invalidateQueries({ queryKey: adviserWorkspaceQueryKey }),
      queryClient.invalidateQueries({ queryKey: adviserReviewsQueueQueryKey }),
      queryClient.invalidateQueries({ queryKey: adviserCertificationRecordsQueryKey }),
      queryClient.invalidateQueries({ queryKey: panelistDashboardQueryKey }),
      ...(taskStudentId
        ? [
            queryClient.invalidateQueries({
              queryKey: adviserAdviseeDetailQueryKey(taskStudentId),
            }),
          ]
        : []),
    ]);
  };

  const handleMutationError = (mutationError: Error, staleMessage: string) => {
    if (mutationError instanceof ApiError && mutationError.statusCode === 409) {
      setError(STALE_REVIEW_MESSAGE);
      void invalidate();
      return;
    }
    setError(mutationError.message || staleMessage);
  };

  const requestChanges = useMutation({
    mutationFn: async () => {
      const documentId = task?.manuscript?.documentId;
      if (!documentId) throw new Error("The exact manuscript is unavailable.");
      return apiClientRequest(
        `${adviserReviewBasePath(stage)}/${thesisId}/request-changes`,
        {
          method: "POST",
          body: JSON.stringify({
            remarks: remarks.trim(),
            expectedReviewedDocumentId: documentId,
          }),
        },
      );
    },
    onSuccess: async () => {
      setError(null);
      setRemarks("");
      await invalidate();
    },
    onError: (mutationError: Error) =>
      handleMutationError(mutationError, "Unable to request changes."),
  });

  const certify = useMutation({
    mutationFn: async () => {
      const documentId = task?.manuscript?.documentId;
      if (!documentId) throw new Error("The exact manuscript is unavailable.");
      if (!isCertificationConfirmationReady({
        documentId, manuscriptTitle: task?.manuscript?.manuscriptTitle ?? null,
        originalFilename: task?.manuscript?.originalFilename ?? null,
        confirmationDocumentId, acknowledgedDocumentId,
      })) throw new Error("Review and acknowledge the exact manuscript before certifying.");
      return apiClientRequest(
        `${adviserReviewBasePath(stage)}/${thesisId}/certify`,
        {
          method: "POST",
          body: JSON.stringify({
            signatureData: signature,
            remarks,
            expectedReviewedDocumentId: documentId,
          }),
        },
      );
    },
    onSuccess: async () => {
      setError(null);
      setSignature("");
      setRemarks("");
      setConfirmCertify(false);
      await invalidate();
      // Certification removes the task from the open-review queue; close the
      // action surface so the URL cannot remain pointing at a completed task.
      onOpenChange(false);
    },
    onError: (mutationError: Error) => {
      setConfirmCertify(false);
      handleMutationError(mutationError, "Unable to certify this manuscript.");
    },
  });

  const reviewStatus = String(task?.reviewStatus ?? "").toUpperCase();
  const awaitingReview = reviewStatus === "AWAITING_REVIEW";
  const changesRequested = reviewStatus === "CHANGES_REQUESTED";
  const issued =
    task?.certification?.issued === true || reviewStatus === "ISSUED";
  const strikeBlocked = isFinalStrikeBlocked(stage, task);
  const manuscriptId = task?.manuscript?.documentId ?? null;
  const confirmationReady = isCertificationConfirmationReady({
    documentId: manuscriptId, manuscriptTitle: task?.manuscript?.manuscriptTitle ?? null,
    originalFilename: task?.manuscript?.originalFilename ?? null,
    confirmationDocumentId, acknowledgedDocumentId,
  });
  const actionsAvailable =
    awaitingReview &&
    !!manuscriptId &&
    !issued &&
    !strikeBlocked &&
    !taskQuery.isFetching;

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next && (requestChanges.isPending || certify.isPending)) return;
          onOpenChange(next);
        }}
      >
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              Review {workspaceStageLabel(stage)} manuscript
            </DialogTitle>
            <DialogDescription>
              {studentName || task?.student?.name || "Adviser review"} · Review
              the exact manuscript currently under review.
            </DialogDescription>
          </DialogHeader>

          {taskQuery.isLoading ? (
            <div className="space-y-3" aria-busy="true" aria-live="polite">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : null}

          {!taskQuery.isLoading && taskQuery.isError ? (
            <div className="space-y-3">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Unable to load this review.</AlertTitle>
                <AlertDescription>
                  {taskQuery.error instanceof ApiError &&
                  taskQuery.error.statusCode === 409
                    ? taskQuery.error.message
                    : "Please try again."}
                </AlertDescription>
              </Alert>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => taskQuery.refetch()}
                disabled={taskQuery.isFetching}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Try again
              </Button>
            </div>
          ) : null}

          {!taskQuery.isLoading && !taskQuery.isError && task ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-(--earist-primary)">
                    {task.student?.name || "Student"}
                  </p>
                  <p className="text-xs text-(--earist-body-text)">
                    {task.student?.studentNumber || "—"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="outline">{workspaceStageLabel(stage)}</Badge>
                  <Badge variant="outline">
                    {adviserReviewStatusLabel(String(task.reviewStatus))}
                  </Badge>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 rounded-lg border border-(--earist-border-gray) p-3">
                <FileText
                  className="h-4 w-4 text-(--earist-primary)"
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-(--earist-primary)">
                    {workspaceStageLabel(stage)} manuscript
                  </p>
                  <p className="mt-2 text-xs font-medium text-(--earist-body-text)">Thesis/Dissertation Title</p>
                  <p className="text-sm break-words text-(--earist-secondary)">
                    {task.manuscript?.manuscriptTitle || "Title not recorded for this manuscript."}
                  </p>
                  <p className="mt-1 text-xs break-words text-(--earist-body-text)">
                    {task.manuscript?.originalFilename || "Filename unavailable"}
                  </p>
                  <p className="text-xs text-(--earist-body-text)">
                    Updated {formatWorkspaceDate(task.manuscript?.uploadedAt)}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!manuscriptId}
                  onClick={() => setViewerOpen(true)}
                >
                  Open manuscript
                </Button>
              </div>

              {error ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}

              {strikeBlocked ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>STRIKE pending</AlertTitle>
                  <AlertDescription>
                    Required STRIKE / plagiarism clearance is still pending.
                    Review actions are disabled until clearance is recorded.
                  </AlertDescription>
                </Alert>
              ) : null}

              {task.reviewRemarks ? (
                <div className="rounded-lg border border-(--earist-border-gray) bg-(--earist-surface-gray) p-3">
                  <p className="text-xs font-medium text-(--earist-body-text)">
                    Review remarks
                  </p>
                  <p className="mt-1 text-sm break-words text-(--earist-secondary)">
                    {task.reviewRemarks}
                  </p>
                </div>
              ) : null}

              {issued ? (
                <div className="space-y-3"><Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertTitle>Certification issued</AlertTitle>
                  <AlertDescription>
                    Certified by {task.certification?.adviserName || "the Adviser"}
                    {task.certification?.signedAt
                      ? ` on ${formatWorkspaceDate(task.certification.signedAt)}`
                      : ""}
                    .
                  </AlertDescription>
                </Alert><AdviserCertificationRecords thesisId={thesisId} stage={stage} /></div>
              ) : changesRequested ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Changes requested</AlertTitle>
                  <AlertDescription>
                    Waiting for the Student to submit a revised manuscript.
                  </AlertDescription>
                </Alert>
              ) : actionsAvailable ? (
                confirmCertify ? (
                  <div className="space-y-3 rounded-lg border border-(--earist-border-gray) bg-(--earist-surface-gray) p-4">
                    <div>
                      <p className="text-sm font-semibold text-(--earist-primary)">
                        Certify this manuscript?
                      </p>
                      <p className="mt-1 text-sm text-(--earist-body-text)">
                        Certification applies to the exact manuscript currently
                        under review and cannot be undone.
                      </p>
                      <dl className="mt-3 space-y-2 text-sm break-words">
                        <div><dt className="font-medium">Student</dt><dd>{task.student?.name}</dd></div>
                        <div><dt className="font-medium">Stage</dt><dd>{workspaceStageLabel(stage)}</dd></div>
                        <div><dt className="font-medium">Thesis/Dissertation Title</dt><dd>{task.manuscript?.manuscriptTitle || "Title not recorded for this manuscript."}</dd></div>
                        <div><dt className="font-medium">Manuscript file</dt><dd>{task.manuscript?.originalFilename || "Filename unavailable"}</dd></div>
                      </dl>
                      <Button type="button" variant="outline" size="sm" className="mt-3" disabled={!manuscriptId} onClick={() => setViewerOpen(true)}>View Manuscript</Button>
                      <label className="mt-3 flex items-start gap-2 text-sm">
                        <input type="checkbox" checked={Boolean(manuscriptId && acknowledgedDocumentId === manuscriptId)}
                          disabled={taskQuery.isFetching || confirmationDocumentId !== manuscriptId}
                          onChange={event => setAcknowledgedDocumentId(event.target.checked ? manuscriptId : null)} />
                        I confirm that I reviewed this exact manuscript and that it is the document I am certifying as ready for defense application.
                      </label>
                      {confirmationDocumentId !== manuscriptId && <p role="alert" className="mt-2 text-sm">The manuscript changed. Cancel and reopen confirmation to review it again.</p>}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setConfirmCertify(false)}
                        disabled={certify.isPending}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => certify.mutate()}
                        disabled={certify.isPending || !signature.trim() || !confirmationReady || !actionsAvailable}
                        className="bg-(--earist-primary) hover:bg-(--earist-primary)/90"
                      >
                        {certify.isPending
                          ? "Certifying…"
                          : "Confirm Certification"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div>
                      <label
                        className="mb-1 block text-xs font-medium text-(--earist-secondary)"
                        htmlFor="adviser-review-remarks"
                      >
                        Remarks
                      </label>
                      <Textarea
                        id="adviser-review-remarks"
                        value={remarks}
                        onChange={(event) => setRemarks(event.target.value)}
                        placeholder="Comments for the student (required when requesting changes)"
                        rows={3}
                        disabled={!actionsAvailable}
                      />
                    </div>
                    <div>
                      <label
                        className="mb-1 block text-xs font-medium text-(--earist-secondary)"
                      >
                        E-signature (required to certify)
                      </label>
                      <ESignaturePad
                        value={signature}
                        onChange={setSignature}
                        readyText="Signature ready for Adviser certification."
                        requiredText="Signature required before certification."
                        disabled={!actionsAvailable}
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        disabled={
                          !actionsAvailable ||
                          requestChanges.isPending ||
                          !remarks.trim()
                        }
                        onClick={() => requestChanges.mutate()}
                      >
                        {requestChanges.isPending
                          ? "Requesting…"
                          : "Request Changes"}
                      </Button>
                      <Button
                        type="button"
                        disabled={
                          !actionsAvailable ||
                          certify.isPending ||
                          !signature.trim()
                        }
                        className="bg-(--earist-primary) hover:bg-(--earist-primary)/90"
                        onClick={() => { setConfirmationDocumentId(manuscriptId); setAcknowledgedDocumentId(null); setConfirmCertify(true); }}
                      >
                        Certify &amp; Sign
                      </Button>
                    </div>
                  </>
                )
              ) : !manuscriptId ? (
                <p className="text-sm text-(--earist-body-text)">
                  No manuscript is currently available for review.
                </p>
              ) : !strikeBlocked && !taskQuery.isFetching ? (
                <p className="text-sm text-(--earist-body-text)">
                  This manuscript is not currently awaiting Adviser review.
                </p>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {viewerOpen && manuscriptId ? (
        <DocumentViewer
          open
          onOpenChange={(next) => {
            if (!next) setViewerOpen(false);
          }}
          fetchUrl={`/api/documents/thesis-document/${manuscriptId}/file`}
          title={`${workspaceStageLabel(stage)} manuscript`}
        />
      ) : null}
    </>
  );
}
