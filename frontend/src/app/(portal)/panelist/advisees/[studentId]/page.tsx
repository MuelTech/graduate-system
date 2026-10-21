"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { apiClientRequest, ApiError } from "@/lib/api.client";
import {
  adviserAdviseeDetailQueryKey,
  adviserReviewStatusLabel,
  defenseVerdictLabel,
  formatWorkspaceDate,
  nextAdviserResponsibility,
  researchDocumentKindLabel,
  workspaceStageLabel,
} from "@/lib/adviser-workspace";
import type {
  AdviserAdviseeDetailDto,
  AdviserDefenseHistoryEntryDto,
  AdviserWorkspaceReviewTaskDto,
} from "@/types/adviser-workspace";
import { AdviserReviewActionPanel } from "@/components/panelist/adviser-review-action-panel";
import type { AdviserReviewStageKey } from "@/lib/adviser-reviews";
import { PageHeader } from "@/components/ui/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DocumentViewer } from "@/components/ui/document-viewer";
import { Skeleton } from "@/components/ui/skeleton";
import { ReportDocumentView } from "@/components/defense-workspace/report-document-view";
import { normalizeReportDocument } from "@/lib/report/report-document";
import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  FileText,
  RefreshCw,
  UserRound,
} from "lucide-react";

function BackToMyAdvisees() {
  return (
    <Link
      href="/panelist/advisees"
      className="inline-flex items-center gap-1.5 text-sm font-medium text-(--earist-secondary) hover:text-(--earist-primary)"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      Back to My Advisees
    </Link>
  );
}

function Meta({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-(--earist-body-text)">{label}</dt>
      <dd className="mt-0.5 text-sm break-words text-(--earist-secondary)">
        {value}
      </dd>
    </div>
  );
}

function reviewBadgeClass(status: string) {
  switch (String(status).toUpperCase()) {
    case "AWAITING_REVIEW":
      return "border-amber-300 bg-amber-50 text-amber-800";
    case "CHANGES_REQUESTED":
      return "border-red-300 bg-red-50 text-red-800";
    case "ISSUED":
      return "border-emerald-300 bg-emerald-50 text-emerald-800";
    default:
      return "border-(--earist-border-gray) bg-(--earist-surface-gray) text-(--earist-secondary)";
  }
}

function DetailSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true" aria-live="polite">
      <div className="space-y-2">
        <Skeleton className="h-8 w-64 max-w-full" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-44 w-full rounded-xl lg:col-span-2" />
        <Skeleton className="h-44 w-full rounded-xl" />
      </div>
      <Skeleton className="h-56 w-full rounded-xl" />
    </div>
  );
}

function ReviewTaskRow({
  task,
  onReview,
}: {
  task: AdviserWorkspaceReviewTaskDto;
  onReview: (task: AdviserWorkspaceReviewTaskDto) => void;
}) {
  return (
    <div className="rounded-lg border border-(--earist-border-gray) p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-(--earist-primary)">
          {workspaceStageLabel(task.stage)} manuscript
        </p>
        <Badge variant="outline" className={reviewBadgeClass(task.reviewStatus)}>
          {adviserReviewStatusLabel(task.reviewStatus)}
        </Badge>
      </div>
      <dl className="mt-3 grid gap-2 sm:grid-cols-2">
        <Meta
          label="Manuscript updated"
          value={formatWorkspaceDate(task.manuscriptUploadedAt)}
        />
      </dl>
      {task.reviewRemarks ? (
        <div className="mt-3 rounded-md bg-(--earist-surface-gray) p-3">
          <p className="text-xs font-medium text-(--earist-body-text)">
            Review remarks
          </p>
          <p className="mt-1 text-sm break-words text-(--earist-secondary)">
            {task.reviewRemarks}
          </p>
        </div>
      ) : null}
      <div className="mt-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onReview(task)}
        >
          Review manuscript
        </Button>
      </div>
    </div>
  );
}

export default function AdviseeDetailPage() {
  const params = useParams<{ studentId: string }>();
  const studentId =
    typeof params?.studentId === "string" ? params.studentId : "";
  const [viewerDoc, setViewerDoc] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [reportEntry, setReportEntry] =
    useState<AdviserDefenseHistoryEntryDto | null>(null);
  const [reviewTarget, setReviewTarget] = useState<{
    stage: AdviserReviewStageKey;
    thesisId: string;
    studentName: string | null;
  } | null>(null);

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useQuery<AdviserAdviseeDetailDto>({
    queryKey: adviserAdviseeDetailQueryKey(studentId),
    queryFn: async () =>
      (await apiClientRequest(
        `/thesis/adviser/advisees/${studentId}`,
      )) as AdviserAdviseeDetailDto,
    enabled: Boolean(studentId),
    refetchOnWindowFocus: true,
  });

  const notFound =
    !studentId || (error instanceof ApiError && error.statusCode === 404);
  const integrityConflict =
    error instanceof ApiError && error.statusCode === 409;

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-5">
        <BackToMyAdvisees />
        <DetailSkeleton />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-5">
        <BackToMyAdvisees />
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <UserRound
              className="h-8 w-8 text-(--earist-body-text)/40"
              aria-hidden="true"
            />
            <div className="space-y-1">
              <h1 className="text-lg font-semibold text-(--earist-primary)">
                Advisee not available
              </h1>
              <p className="max-w-md text-sm text-(--earist-body-text)">
                This advisee is no longer available in your active supervision
                list.
              </p>
            </div>
            <Link
              href="/panelist/advisees"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Back to My Advisees
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-5">
        <BackToMyAdvisees />
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Unable to load this advisee.</AlertTitle>
          <AlertDescription>
            {integrityConflict && error instanceof ApiError
              ? error.message
              : "Please try again."}
          </AlertDescription>
          <div className="col-start-2 mt-2 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isRefetching}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Try again
            </Button>
            <Link
              href="/panelist/advisees"
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              Back to My Advisees
            </Link>
          </div>
        </Alert>
      </div>
    );
  }

  const nextResponsibility = nextAdviserResponsibility(
    data.reviewContext.tasks,
  );
  const documentGroups = (["TITLE", "PROPOSAL", "FINAL"] as const)
    .map((stage) => ({
      stage,
      documents: data.researchDocuments.filter((doc) => doc.stage === stage),
    }))
    .filter((group) => group.documents.length > 0);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5">
      <BackToMyAdvisees />

      <PageHeader
        title={data.student.name}
        description={`${data.student.studentNumber || "—"} · ${data.student.program || "—"}`}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-(--earist-secondary)">
              Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2">
              <Meta
                label="Research stage"
                value={workspaceStageLabel(data.research.currentStage)}
              />
              {data.research.workingTitle ? (
                <Meta
                  label="Current title"
                  value={data.research.workingTitle}
                />
              ) : null}
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-(--earist-secondary)">
              Adviser Relationship
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-4">
              <div>
                <dt className="text-xs font-medium text-(--earist-body-text)">
                  Status
                </dt>
                <dd className="mt-1">
                  <Badge
                    variant="outline"
                    className="border-emerald-300 bg-emerald-50 text-emerald-800"
                  >
                    Active adviser
                  </Badge>
                </dd>
              </div>
              <Meta
                label="Adviser since"
                value={
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays
                      className="h-3.5 w-3.5 text-(--earist-body-text)"
                      aria-hidden="true"
                    />
                    {formatWorkspaceDate(data.assignment.assignedDate)}
                  </span>
                }
              />
            </dl>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-(--earist-secondary)">
            Current Review Context
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-(--earist-border-gray) bg-(--earist-surface-gray) p-3">
            <p className="text-xs font-medium text-(--earist-body-text)">
              Next Adviser responsibility
            </p>
            <p className="mt-1 text-sm font-medium text-(--earist-secondary)">
              {nextResponsibility}
            </p>
          </div>

          {data.reviewContext.tasks.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <FileText
                className="h-6 w-6 text-(--earist-body-text)/40"
                aria-hidden="true"
              />
              <p className="text-sm text-(--earist-body-text)">
                No manuscript review is currently pending.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {data.reviewContext.tasks.map((task) => (
                  <ReviewTaskRow
                    key={`${task.stage}-${task.thesisId}`}
                    task={task}
                    onReview={(selected) =>
                      setReviewTarget({
                        stage: selected.stage,
                        thesisId: selected.thesisId,
                        studentName: selected.student.name,
                      })
                    }
                  />
                ))}
              </div>
              <Link
                href="/panelist/adviser-reviews"
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Open Adviser Reviews
              </Link>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-(--earist-secondary)">
            Research Documents
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.researchDocuments.length === 0 ? (
            <p className="text-sm text-(--earist-body-text)">
              No research documents are available yet.
            </p>
          ) : (
            documentGroups.map((group) => (
              <div key={group.stage} className="space-y-2">
                <p className="text-xs font-semibold tracking-wide text-(--earist-body-text) uppercase">
                  {workspaceStageLabel(group.stage)}
                </p>
                <div className="space-y-2">
                  {group.documents.map((document) => (
                    <div
                      key={document.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-(--earist-border-gray) p-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-(--earist-primary)">
                          {researchDocumentKindLabel(document.kind)}
                        </p>
                        <p className="mt-0.5 text-xs text-(--earist-body-text)">
                          Uploaded {formatWorkspaceDate(document.uploadedAt)}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">
                          {document.isCurrent ? "Current" : "Previous version"}
                        </Badge>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setViewerDoc({
                              id: document.id,
                              title: researchDocumentKindLabel(document.kind),
                            })
                          }
                        >
                          View document
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-(--earist-secondary)">
            Defense History
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.defenseHistory.length === 0 ? (
            <p className="text-sm text-(--earist-body-text)">
              No concluded defenses are available yet.
            </p>
          ) : (
            data.defenseHistory.map((entry) => (
              <div
                key={entry.scheduleId}
                className="space-y-3 rounded-lg border border-(--earist-border-gray) p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-(--earist-primary)">
                    {entry.stage
                      ? `${workspaceStageLabel(entry.stage)} Defense`
                      : "Defense"}
                  </p>
                  <Badge variant="outline">
                    {defenseVerdictLabel(entry.verdict)}
                  </Badge>
                </div>
                <dl className="grid gap-2 sm:grid-cols-2">
                  <Meta
                    label="Defense date"
                    value={formatWorkspaceDate(entry.defenseDate)}
                  />
                  <Meta
                    label="Concluded"
                    value={formatWorkspaceDate(entry.concludedAt)}
                  />
                </dl>
                <div className="flex flex-wrap items-center gap-2">
                  {entry.manuscript ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setViewerDoc({
                          id: entry.manuscript!.id,
                          title: researchDocumentKindLabel(
                            entry.manuscript!.kind,
                          ),
                        })
                      }
                    >
                      View manuscript
                    </Button>
                  ) : (
                    <span className="text-xs font-medium text-(--earist-body-text)">
                      Historical manuscript version not linked
                    </span>
                  )}
                  {entry.committeeReport ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setReportEntry(entry)}
                    >
                      View Committee Report
                    </Button>
                  ) : (
                    <span className="text-xs text-(--earist-body-text)">
                      Committee Report unavailable
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {viewerDoc ? (
        <DocumentViewer
          open
          onOpenChange={(open) => {
            if (!open) setViewerDoc(null);
          }}
          fetchUrl={`/api/documents/thesis-document/${viewerDoc.id}/file`}
          title={viewerDoc.title}
        />
      ) : null}

      {reviewTarget ? (
        <AdviserReviewActionPanel
          open
          onOpenChange={(open) => {
            if (!open) setReviewTarget(null);
          }}
          stage={reviewTarget.stage}
          thesisId={reviewTarget.thesisId}
          studentName={reviewTarget.studentName}
        />
      ) : null}

      <Dialog
        open={reportEntry !== null}
        onOpenChange={(open) => {
          if (!open) setReportEntry(null);
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Committee Report</DialogTitle>
            <DialogDescription>
              {reportEntry?.stage
                ? `${workspaceStageLabel(reportEntry.stage)} Defense`
                : "Defense"}
              {reportEntry?.committeeReport?.finalizedAt
                ? ` · Finalized ${formatWorkspaceDate(
                    reportEntry.committeeReport.finalizedAt,
                  )}`
                : ""}
            </DialogDescription>
          </DialogHeader>
          {reportEntry?.committeeReport?.bodyDocument ? (
            <ReportDocumentView
              doc={normalizeReportDocument(
                reportEntry.committeeReport.bodyDocument,
              )}
            />
          ) : (
            <pre className="text-sm break-words whitespace-pre-wrap text-(--earist-secondary)">
              {reportEntry?.committeeReport?.text ?? "No report content."}
            </pre>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
