"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClientRequest } from "@/lib/api.client";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DocumentViewer } from "@/components/ui/document-viewer";
import type { DefenseApplicationDto } from "@/components/admin/defense-applications/application-row";
import {
  STAGE_LABELS,
  displayStatusKey,
  displayStatusLabel,
  requirementLabel,
} from "@/components/admin/defense-applications/labels";
import type { DefenseDocumentHistory } from "@/types/defense-document-history";
import type { MissingRequirement } from "@/types";
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  Eye,
  FileText,
  History,
  RefreshCw,
  ShieldCheck,
  X,
  XCircle,
} from "lucide-react";

const STATUS_BADGE_CLASS: Record<string, string> = {
  PENDING: "text-(--earist-warning)",
  APPROVED: "text-(--earist-success)",
  SCHEDULED: "text-(--earist-secondary)",
  PASSED: "text-(--earist-success)",
  REJECTED: "text-destructive",
  REVISION: "text-(--earist-warning)",
  FAILED: "text-destructive",
};

type ApiErrorish = { statusCode?: number; missing?: MissingRequirement[] };

const MANUSCRIPT_STATUS_LABEL: Record<string, string> = {
  NONE: "No Adviser review yet",
  AWAITING_REVIEW: "Awaiting Adviser Review",
  CHANGES_REQUESTED: "Changes Requested",
  ISSUED: "Certified by Adviser",
};

const TIMELINE_LABEL: Record<string, string> = {
  DEFENSE_APPLICATION_REJECT: "Rejected",
  DEFENSE_APPLICATION_APPROVE: "Approved",
  DEFENSE_RESUBMIT: "Resubmitted",
};

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

function formatDate(value: string): string {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-xs font-medium text-(--earist-body-text)">{label}</dt>
      <dd className="text-right text-sm break-words text-foreground">
        {value}
      </dd>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-6" aria-busy="true" aria-live="polite">
        <div className="space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-24 w-full rounded-lg" />
        </div>
        <Skeleton className="h-64 w-full rounded-lg" />
        <Skeleton className="h-16 w-full rounded-lg" />
      </div>
      <div className="space-y-4">
        <Skeleton className="h-52 w-full rounded-lg" />
        <Skeleton className="h-40 w-full rounded-lg" />
      </div>
    </div>
  );
}

export default function DefenseApplicationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const thesisId = String(params?.id ?? "");

  const [showApprove, setShowApprove] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [approveError, setApproveError] = useState<string | null>(null);
  const [missingRequirements, setMissingRequirements] = useState<
    MissingRequirement[]
  >([]);
  const [rejectError, setRejectError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    type: "success";
    message: string;
  } | null>(null);
  const [viewerDoc, setViewerDoc] = useState<{
    fetchUrl: string;
    title: string;
  } | null>(null);

  const appQuery = useQuery<DefenseApplicationDto>({
    queryKey: ["defenseApplication", thesisId],
    enabled: !!thesisId,
    queryFn: async () =>
      (await apiClientRequest(
        `/thesis/defense/applications/${thesisId}`,
      )) as DefenseApplicationDto,
  });

  const app = appQuery.data;
  const stage = app?.stage;

  const historyQuery = useQuery<DefenseDocumentHistory>({
    queryKey: ["defenseDocumentHistory", thesisId, stage],
    enabled: !!thesisId && !!stage,
    queryFn: async () =>
      (await apiClientRequest(
        `/thesis/defense/applications/${thesisId}/document-history?stage=${stage}`,
      )) as DefenseDocumentHistory,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({
      queryKey: ["defenseApplication", thesisId],
    });
    queryClient.invalidateQueries({ queryKey: ["defenseDocumentHistory"] });
    queryClient.invalidateQueries({ queryKey: ["defenseApplications"] });
    queryClient.invalidateQueries({ queryKey: ["defenseWorkflowSummary"] });
  };

  const approveMutation = useMutation({
    mutationFn: async () =>
      apiClientRequest(`/thesis/defense/${thesisId}/status`, {
        method: "PUT",
        body: JSON.stringify({ status: "APPROVED" }),
      }),
    onSuccess: () => {
      invalidate();
      setShowApprove(false);
      setApproveError(null);
      setMissingRequirements([]);
      setFeedback({ type: "success", message: "Application approved." });
    },
    onError: (error: Error) => {
      const err = error as Error & ApiErrorish;
      if (err.missing?.length) {
        setMissingRequirements(err.missing);
        setApproveError("Application cannot be approved yet.");
      } else {
        setMissingRequirements([]);
        setApproveError(
          error.message || "The application could not be approved.",
        );
      }
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (reason: string) =>
      apiClientRequest(`/thesis/defense/${thesisId}/reject`, {
        method: "PUT",
        body: JSON.stringify({ reason }),
      }),
    onSuccess: () => {
      invalidate();
      setShowReject(false);
      setRejectReason("");
      setRejectError(null);
      setFeedback({
        type: "success",
        message:
          "Application rejected. The student can correct the identified requirements and resubmit.",
      });
    },
    onError: (error: Error) => {
      setRejectError(error.message || "The application could not be rejected.");
    },
  });

  const breadcrumb = (
    <Breadcrumb
      items={[
        { label: "Defense Applications", href: "/admin/thesis/applications" },
        { label: "Review Application" },
      ]}
    />
  );

  if (appQuery.isLoading) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-6">
        {breadcrumb}
        <DetailSkeleton />
      </div>
    );
  }

  if (appQuery.isError || !app) {
    const statusCode = (appQuery.error as ApiErrorish | null)?.statusCode;
    const notFound = statusCode === 404;
    return (
      <div className="mx-auto w-full max-w-6xl space-y-6">
        {breadcrumb}
        <div className="rounded-lg border border-(--earist-border-gray) bg-white">
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
            <AlertCircle
              className="h-8 w-8 text-(--earist-secondary)"
              aria-hidden="true"
            />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-(--earist-primary)">
                {notFound
                  ? "Defense application not found"
                  : "Unable to load this defense application"}
              </p>
              <p className="text-sm text-(--earist-body-text)">
                {notFound
                  ? "This application may have been removed or the link is incorrect."
                  : "The application could not be loaded. Please try again."}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {!notFound && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => appQuery.refetch()}
                  disabled={appQuery.isFetching}
                >
                  <RefreshCw
                    className={cn(
                      "mr-2 h-4 w-4",
                      appQuery.isFetching && "animate-spin",
                    )}
                    aria-hidden="true"
                  />
                  Retry
                </Button>
              )}
              <Link
                href="/admin/thesis/applications"
                className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
              >
                Back to Defense Applications
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const student = app.student;
  const studentName = `${student.user.firstName} ${student.user.lastName}`;
  const stageLabel = STAGE_LABELS[app.stage] ?? app.stage;
  const statusKey = displayStatusKey(app);
  const statusLabel = displayStatusLabel(app);
  const isTitle = app.stage === "TITLE";
  const isProposal = app.stage === "PROPOSAL";
  const isFinal = app.stage === "FINAL";
  const selectedTitle = app.thesisTitles.find((t) => t.isSelected) ?? null;
  const adviser = app.activeAdviser;
  const canDecide =
    app.workflowBucket === "NEEDS_REVIEW" ||
    app.rawApplicationStatus === "PENDING";
  const isReady = app.workflowBucket === "READY";
  const isActive = app.workflowBucket === "ACTIVE";
  const isHistory = app.workflowBucket === "HISTORY";
  const schedulingHref = `/admin/thesis/scheduling?thesisId=${app.thesisId ?? app.id}`;
  // FIX-3A: an ACTIVE application is not in the Ready queue, so its exact
  // confirmed session opens the Scheduled view by scheduleId.
  const scheduledSessionHref = app.currentSchedule?.id
    ? `/admin/thesis/scheduling?scheduleId=${app.currentSchedule.id}`
    : schedulingHref;

  const viewDocument = (id: string, title: string) =>
    setViewerDoc({
      fetchUrl: `/api/documents/thesis-document/${id}/file`,
      title,
    });

  const requirements = historyQuery.data?.supportingEvidence ?? [];

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      {breadcrumb}

      <PageHeader
        title={studentName}
        description={`${stageLabel} · ${statusLabel}`}
      />

      {feedback && (
        <div
          role="status"
          className="flex items-center justify-between gap-3 rounded-lg border border-(--earist-success)/30 bg-(--earist-surface-gray) px-4 py-2"
        >
          <p className="flex items-start gap-2 text-sm text-(--earist-success)">
            <CheckCircle2
              className="mt-0.5 h-4 w-4 shrink-0"
              aria-hidden="true"
            />
            {feedback.message}
          </p>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Dismiss message"
            onClick={() => setFeedback(null)}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* Main review column */}
        <div className="min-w-0 space-y-6">
          {/* Research Information */}
          <section>
            <h2 className="text-sm font-semibold text-(--earist-secondary)">
              Research Information
            </h2>
            <div className="mt-3">
              {isTitle && (
                <div>
                  <p className="text-xs font-medium text-(--earist-secondary)">
                    Proposed Research Titles
                  </p>
                  {app.thesisTitles.length === 0 ? (
                    <p className="mt-1 text-sm text-(--earist-body-text)">
                      No proposed titles recorded.
                    </p>
                  ) : (
                    <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm">
                      {app.thesisTitles.map((title) => (
                        <li
                          key={title.id}
                          className="break-words text-foreground"
                        >
                          {title.titleText}
                        </li>
                      ))}
                    </ol>
                  )}
                  <p className="mt-2 text-xs text-(--earist-body-text)">
                    The official research title is selected during Title Defense
                    conclusion. Application approval does not select a title.
                  </p>
                </div>
              )}

              {(isProposal || isFinal) && (
                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-medium text-(--earist-secondary)">
                      Official Research Title
                    </p>
                    <p className="mt-0.5 text-sm break-words text-foreground">
                      {selectedTitle?.titleText || "Not selected yet"}
                    </p>
                  </div>
                  {adviser && (
                    <div>
                      <p className="text-xs font-medium text-(--earist-secondary)">
                        Thesis / Dissertation Adviser
                      </p>
                      <p className="mt-0.5 text-sm break-words text-foreground">
                        {adviser.firstName} {adviser.lastName}
                      </p>
                      <p className="mt-1 text-xs text-(--earist-body-text)">
                        Included automatically in the Proposal/Final defense
                        committee.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* Application Requirements — dominant review surface */}
          <section className="rounded-lg border border-(--earist-border-gray) bg-white p-4">
            <h2 className="text-sm font-semibold text-(--earist-secondary)">
              Application Requirements
            </h2>
            <div className="mt-3">
              {historyQuery.isLoading ? (
                <div className="space-y-2" aria-hidden="true">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <Skeleton key={index} className="h-14 w-full rounded-lg" />
                  ))}
                </div>
              ) : historyQuery.isError || !historyQuery.data ? (
                <div className="flex flex-col items-start gap-2">
                  <p className="text-sm text-(--earist-body-text)">
                    Unable to load the application requirements.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => historyQuery.refetch()}
                    disabled={historyQuery.isFetching}
                  >
                    <RefreshCw
                      className={cn(
                        "mr-2 h-4 w-4",
                        historyQuery.isFetching && "animate-spin",
                      )}
                      aria-hidden="true"
                    />
                    Retry
                  </Button>
                </div>
              ) : requirements.length === 0 ? (
                <p className="text-sm text-(--earist-body-text)">
                  No requirements are recorded for this stage.
                </p>
              ) : (
                <ul className="divide-y divide-(--earist-border-gray)">
                  {requirements.map((slot) => (
                    <li
                      key={slot.docType}
                      className="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">
                          {requirementLabel(slot.docType)}
                        </p>
                        {slot.integrityState === "MISSING" && (
                          <p className="mt-0.5 text-sm text-(--earist-warning)">
                            No current document recorded.
                          </p>
                        )}
                        {slot.integrityState === "AMBIGUOUS" && (
                          <p className="mt-0.5 text-sm text-(--earist-warning)">
                            Multiple current versions recorded — review
                            required.
                          </p>
                        )}
                        {slot.current && (
                          <p className="mt-0.5 text-xs break-words text-(--earist-body-text)">
                            {slot.current.originalFilename ||
                              "Filename unavailable"}{" "}
                            · {formatDateTime(slot.current.uploadedAt)}
                          </p>
                        )}
                      </div>
                      {slot.current && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            viewDocument(
                              slot.current!.id,
                              requirementLabel(slot.docType),
                            )
                          }
                        >
                          <Eye className="mr-1.5 h-4 w-4" aria-hidden="true" />
                          View
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          {/* Document / Review History — secondary, collapsed */}
          <details className="rounded-lg border border-(--earist-border-gray) bg-white px-4 py-3">
            <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-(--earist-secondary)">
              <History className="h-4 w-4" aria-hidden="true" />
              View document history
            </summary>
            <div className="mt-3 space-y-4">
              {historyQuery.isLoading ? (
                <p className="text-sm text-(--earist-body-text)">
                  Loading document history…
                </p>
              ) : historyQuery.isError || !historyQuery.data ? (
                <p className="text-sm text-(--earist-body-text)">
                  Unable to load document history.
                </p>
              ) : (
                <>
                  {historyQuery.data.reviewTimeline.length > 0 && (
                    <div>
                      <p className="mb-1 text-xs font-medium text-(--earist-secondary)">
                        Review Timeline
                      </p>
                      <ul className="space-y-1">
                        {historyQuery.data.reviewTimeline.map((event, index) => (
                          <li
                            key={`${event.type}-${index}`}
                            className="rounded-md bg-(--earist-surface-gray) px-3 py-2 text-sm"
                          >
                            <span className="font-medium text-(--earist-primary)">
                              {TIMELINE_LABEL[event.type] ?? event.type}
                            </span>
                            <span className="text-(--earist-body-text)">
                              {" "}
                              · {formatDateTime(event.timestamp)}
                            </span>
                            {event.actor && (
                              <span className="text-(--earist-body-text)">
                                {" "}
                                · {event.actor.name}
                              </span>
                            )}
                            {event.reason && (
                              <p className="mt-0.5 text-(--earist-body-text)">
                                Reason: {event.reason}
                              </p>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {historyQuery.data.manuscriptReview && (
                    <div className="rounded-md border border-(--earist-border-gray) p-3">
                      <p className="flex items-center gap-1 text-xs font-semibold text-(--earist-secondary)">
                        <ShieldCheck
                          className="h-3.5 w-3.5"
                          aria-hidden="true"
                        />
                        Manuscript — Read-only (Adviser reviewed)
                      </p>
                      <p className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                        <Badge variant="outline">
                          {MANUSCRIPT_STATUS_LABEL[
                            historyQuery.data.manuscriptReview
                              .certificationStatus
                          ] ??
                            historyQuery.data.manuscriptReview
                              .certificationStatus}
                        </Badge>
                        {historyQuery.data.manuscriptReview.adviser && (
                          <span className="text-(--earist-body-text)">
                            Adviser:{" "}
                            {historyQuery.data.manuscriptReview.adviser.name}
                          </span>
                        )}
                      </p>
                    </div>
                  )}

                  <div>
                    <p className="mb-1 text-xs font-medium text-(--earist-secondary)">
                      Previous Versions
                    </p>
                    {requirements.every((slot) => slot.history.length === 0) ? (
                      <p className="text-sm text-(--earist-body-text)">
                        No previous document versions recorded.
                      </p>
                    ) : (
                      <ul className="space-y-1">
                        {requirements.flatMap((slot) =>
                          slot.history.map((version) => (
                            <li
                              key={version.id}
                              className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-(--earist-surface-gray) px-3 py-2 text-sm"
                            >
                              <span className="min-w-0 break-words">
                                {requirementLabel(slot.docType)} ·{" "}
                                {version.originalFilename ||
                                  "Filename unavailable"}
                              </span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  viewDocument(
                                    version.id,
                                    `${requirementLabel(slot.docType)} (previous version)`,
                                  )
                                }
                              >
                                <Eye
                                  className="mr-1.5 h-4 w-4"
                                  aria-hidden="true"
                                />
                                View
                              </Button>
                            </li>
                          )),
                        )}
                      </ul>
                    )}
                  </div>
                </>
              )}
            </div>
          </details>
        </div>

        {/* Context / action sidebar */}
        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          {/* Application Summary */}
          <div className="rounded-lg border border-(--earist-border-gray) bg-white p-4">
            <h2 className="text-sm font-semibold text-(--earist-secondary)">
              Application Summary
            </h2>
            <dl className="mt-3 space-y-2">
              <SummaryRow
                label="Student Number"
                value={student.studentNumber || "Not recorded"}
              />
              <SummaryRow
                label="Program"
                value={student.program?.programName || "Not recorded"}
              />
              <SummaryRow label="Defense Stage" value={stageLabel} />
              <SummaryRow
                label="Submitted"
                value={formatDate(app.createdAt)}
              />
              <div className="flex items-center justify-between gap-3">
                <dt className="text-xs font-medium text-(--earist-body-text)">
                  Status
                </dt>
                <dd>
                  <Badge
                    variant="outline"
                    className={cn("font-medium", STATUS_BADGE_CLASS[statusKey])}
                  >
                    {statusLabel}
                  </Badge>
                </dd>
              </div>
            </dl>
            {app.rejectionReason && app.rawApplicationStatus === "REJECTED" && (
              <p className="mt-3 rounded-md bg-destructive/5 px-3 py-2 text-xs break-words text-destructive">
                Rejection reason: {app.rejectionReason}
              </p>
            )}
          </div>

          {/* Admin Decision (pending) */}
          {canDecide && (
            <div className="rounded-lg border border-(--earist-border-gray) bg-white p-4">
              <h2 className="text-sm font-semibold text-(--earist-secondary)">
                Admin Decision
              </h2>
              <p className="mt-2 text-xs text-(--earist-body-text)">
                Approving accepts this application for panel assignment and
                scheduling. It does not select an official research title or
                mark the defense as passed.
              </p>
              {isTitle && (
                <p className="mt-1 text-xs text-(--earist-body-text)">
                  The official title is selected only during the Title Defense
                  conclusion.
                </p>
              )}
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  className="text-destructive hover:bg-destructive/10"
                  onClick={() => {
                    setRejectError(null);
                    setShowReject(true);
                  }}
                >
                  <XCircle className="mr-1.5 h-4 w-4" aria-hidden="true" />
                  Reject
                </Button>
                <Button
                  className="bg-(--earist-primary) text-white hover:bg-(--earist-primary)/90"
                  onClick={() => {
                    setApproveError(null);
                    setMissingRequirements([]);
                    setShowApprove(true);
                  }}
                >
                  <CheckCircle2 className="mr-1.5 h-4 w-4" aria-hidden="true" />
                  Approve
                </Button>
              </div>
            </div>
          )}

          {/* Next Step (ready) */}
          {isReady && (
            <div className="rounded-lg border border-(--earist-border-gray) bg-white p-4">
              <h2 className="text-sm font-semibold text-(--earist-secondary)">
                Next Step
              </h2>
              <p className="mt-2 text-sm text-(--earist-body-text)">
                Application requirements have been approved. Panel assignment
                and defense scheduling are managed in Scheduling &amp; Panels.
              </p>
              <Link
                href={schedulingHref}
                className={cn(
                  buttonVariants(),
                  "mt-3 w-full justify-center bg-(--earist-primary) text-white hover:bg-(--earist-primary)/90",
                )}
              >
                <CalendarClock className="mr-2 h-4 w-4" aria-hidden="true" />
                Assign Panel &amp; Schedule
              </Link>
            </div>
          )}

          {/* Scheduled / Active */}
          {isActive && (
            <div className="rounded-lg border border-(--earist-border-gray) bg-white p-4">
              <h2 className="text-sm font-semibold text-(--earist-secondary)">
                Scheduled / Active
              </h2>
              <p className="mt-2 text-sm text-(--earist-body-text)">
                This application has proceeded to a scheduled defense. Committee
                and schedule details are managed in Scheduling &amp; Panels.
              </p>
              <Link
                href={scheduledSessionHref}
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "mt-3 w-full justify-center",
                )}
              >
                <CalendarClock className="mr-2 h-4 w-4" aria-hidden="true" />
                View Schedule
              </Link>
            </div>
          )}

          {/* History */}
          {isHistory && (
            <div className="rounded-lg border border-(--earist-border-gray) bg-white p-4">
              <h2 className="text-sm font-semibold text-(--earist-secondary)">
                History
              </h2>
              <p className="mt-2 text-sm text-(--earist-body-text)">
                This application is part of the student&apos;s defense history.
              </p>
              {historyQuery.data?.officialRecord?.available && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 w-full justify-center"
                  onClick={() =>
                    router.push(
                      `/admin/thesis/defense-records/${historyQuery.data!.officialRecord!.scheduleId}`,
                    )
                  }
                >
                  <FileText className="mr-2 h-4 w-4" aria-hidden="true" />
                  View Defense Record
                </Button>
              )}
            </div>
          )}
        </aside>
      </div>

      {/* Approve confirmation */}
      <Dialog
        open={showApprove}
        onOpenChange={(open) => {
          if (!open && !approveMutation.isPending) {
            setShowApprove(false);
            setApproveError(null);
            setMissingRequirements([]);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Approve this defense application?</DialogTitle>
            <DialogDescription>
              The application will become ready for panel assignment and
              scheduling. This does not select an official research title or
              mark the defense as passed.
            </DialogDescription>
          </DialogHeader>
          {isTitle && (
            <p className="text-xs text-(--earist-body-text)">
              The official title is selected only during the Title Defense
              conclusion.
            </p>
          )}
          {approveError && (
            <div className="space-y-1" role="alert">
              <p className="text-sm text-destructive">{approveError}</p>
              {missingRequirements.length > 0 && (
                <ul className="list-disc space-y-0.5 pl-5 text-xs text-destructive">
                  {missingRequirements.map((m) => (
                    <li key={`${m.code}-${m.stage}`} className="break-words">
                      {m.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowApprove(false);
                setApproveError(null);
                setMissingRequirements([]);
              }}
              disabled={approveMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => approveMutation.mutate()}
              disabled={approveMutation.isPending}
              className="bg-(--earist-primary) text-white hover:bg-(--earist-primary)/90"
            >
              {approveMutation.isPending ? "Approving…" : "Approve Application"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject confirmation */}
      <Dialog
        open={showReject}
        onOpenChange={(open) => {
          if (!open && !rejectMutation.isPending) {
            setShowReject(false);
            setRejectReason("");
            setRejectError(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject this defense application?</DialogTitle>
            <DialogDescription>
              Explain what the student must correct before resubmitting.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label
              htmlFor="defense-reject-reason"
              className="mb-1 block text-xs"
            >
              Reason for rejection{" "}
              <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="defense-reject-reason"
              value={rejectReason}
              onChange={(event) => {
                setRejectReason(event.target.value);
                if (rejectError) setRejectError(null);
              }}
              placeholder="Explain what must be corrected…"
              rows={3}
            />
          </div>
          {rejectError && (
            <p className="text-sm text-destructive" role="alert">
              {rejectError}
            </p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowReject(false);
                setRejectReason("");
                setRejectError(null);
              }}
              disabled={rejectMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!rejectReason.trim() || rejectMutation.isPending}
              onClick={() => rejectMutation.mutate(rejectReason.trim())}
            >
              {rejectMutation.isPending ? "Rejecting…" : "Reject Application"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {viewerDoc && (
        <DocumentViewer
          open={!!viewerDoc}
          onOpenChange={(open) => {
            if (!open) setViewerDoc(null);
          }}
          fetchUrl={viewerDoc.fetchUrl}
          title={viewerDoc.title}
        />
      )}
    </div>
  );
}
