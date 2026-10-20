"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { apiClientRequest, ApiError } from "@/lib/api.client";
import {
  adviserAdviseeDetailQueryKey,
  adviserReviewStatusLabel,
  formatWorkspaceDate,
  nextAdviserResponsibility,
  workspaceStageLabel,
} from "@/lib/adviser-workspace";
import type {
  AdviserAdviseeDetailDto,
  AdviserWorkspaceReviewTaskDto,
} from "@/types/adviser-workspace";
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
import { Skeleton } from "@/components/ui/skeleton";
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

function ReviewTaskRow({ task }: { task: AdviserWorkspaceReviewTaskDto }) {
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
    </div>
  );
}

export default function AdviseeDetailPage() {
  const params = useParams<{ studentId: string }>();
  const studentId =
    typeof params?.studentId === "string" ? params.studentId : "";

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
    </div>
  );
}
