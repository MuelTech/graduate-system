"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { apiClientRequest, ApiError } from "@/lib/api.client";
import {
  adviserReviewStatusLabel,
  adviserWorkspaceQueryKey,
  formatWorkspaceDate,
  openReviewLabel,
  workspaceStageLabel,
} from "@/lib/adviser-workspace";
import {
  requestStatusLabel,
  resolvePanelistRequestUiState,
  type PanelistAdviserRequestDto,
} from "@/lib/panelist-adviser-requests";
import type {
  AdviserActiveAdviseeDto,
  AdviserWorkspaceDto,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  FileText,
  Inbox,
  RefreshCw,
  Users,
} from "lucide-react";

const EMPTY_MESSAGES = {
  active: "No active advisees yet.",
  requests: "No incoming adviser requests.",
  reviews: "No manuscript reviews need your attention.",
} as const;

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

function EmptyState({
  icon: Icon,
  message,
}: {
  icon: typeof Users;
  message: string;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-2 py-8 text-center">
        <Icon
          className="h-7 w-7 text-(--earist-body-text)/40"
          aria-hidden="true"
        />
        <p className="text-sm text-(--earist-body-text)">{message}</p>
      </CardContent>
    </Card>
  );
}

function WorkspaceSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      <Skeleton className="h-9 w-full max-w-md rounded-lg" />
      {Array.from({ length: 3 }).map((_, index) => (
        <Card key={index}>
          <CardHeader>
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-3 w-64 max-w-full" />
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function requestBadgeClass(state: ReturnType<typeof resolvePanelistRequestUiState>) {
  switch (state) {
    case "ACTIONABLE":
      return "border-amber-300 bg-amber-50 text-amber-800";
    case "DECLINED":
    case "CONFORMED_DEAN_REJECTED":
      return "border-red-300 bg-red-50 text-red-800";
    case "CONFORMED_DEAN_APPROVED":
      return "border-emerald-300 bg-emerald-50 text-emerald-800";
    default:
      return "border-(--earist-border-gray) bg-(--earist-surface-gray) text-(--earist-secondary)";
  }
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

function ActiveAdviseeCard({ advisee }: { advisee: AdviserActiveAdviseeDto }) {
  const reviewLabel =
    openReviewLabel(advisee.review.stages) ??
    (advisee.review.hasOpenTask ? "Review pending" : null);

  return (
    <Card>
      <CardHeader className="gap-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <CardTitle className="text-base font-semibold text-(--earist-primary)">
            {advisee.student.name}
          </CardTitle>
          {reviewLabel ? (
            <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800">
              {reviewLabel}
            </Badge>
          ) : null}
        </div>
        <p className="text-xs text-(--earist-body-text)">
          {advisee.student.studentNumber || "—"}
          <span aria-hidden="true"> · </span>
          {advisee.student.program || "—"}
        </p>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-3 sm:grid-cols-2">
          <Meta
            label="Research stage"
            value={workspaceStageLabel(advisee.research.currentStage)}
          />
          <Meta
            label="Adviser since"
            value={formatWorkspaceDate(advisee.assignedDate)}
          />
          {advisee.research.workingTitle ? (
            <div className="sm:col-span-2">
              <Meta label="Current title" value={advisee.research.workingTitle} />
            </div>
          ) : null}
        </dl>
      </CardContent>
    </Card>
  );
}

function IncomingRequestCard({ request }: { request: PanelistAdviserRequestDto }) {
  const state = resolvePanelistRequestUiState(request);

  return (
    <Card>
      <CardHeader className="gap-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <CardTitle className="text-base font-semibold text-(--earist-primary)">
            {request.student.name}
          </CardTitle>
          <Badge variant="outline" className={requestBadgeClass(state)}>
            {requestStatusLabel(state)}
          </Badge>
        </div>
        <p className="text-xs text-(--earist-body-text)">
          {request.student.studentNumber || "—"}
          <span aria-hidden="true"> · </span>
          {request.student.program || "—"}
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <dl className="grid gap-3 sm:grid-cols-2">
          <Meta
            label="Request date"
            value={formatWorkspaceDate(request.requestDate)}
          />
          {request.officialTitle ? (
            <Meta label="Title Defense title" value={request.officialTitle} />
          ) : null}
        </dl>
        {request.reason ? (
          <div className="rounded-lg border border-(--earist-border-gray) bg-(--earist-surface-gray) p-3">
            <p className="text-xs font-medium text-(--earist-body-text)">
              Student remarks
            </p>
            <p className="mt-1 text-sm break-words text-(--earist-secondary)">
              {request.reason}
            </p>
          </div>
        ) : null}
        <Link
          href="/panelist/adviser-requests"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          Review request
        </Link>
      </CardContent>
    </Card>
  );
}

function ReviewTaskCard({ task }: { task: AdviserWorkspaceReviewTaskDto }) {
  return (
    <Card>
      <CardHeader className="gap-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <CardTitle className="text-base font-semibold text-(--earist-primary)">
            {task.student.name}
          </CardTitle>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="outline">{workspaceStageLabel(task.stage)}</Badge>
            <Badge variant="outline" className={reviewBadgeClass(task.reviewStatus)}>
              {adviserReviewStatusLabel(task.reviewStatus)}
            </Badge>
          </div>
        </div>
        <p className="text-xs text-(--earist-body-text)">
          {task.student.studentNumber || "—"}
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <dl className="grid gap-3 sm:grid-cols-2">
          <Meta
            label="Manuscript updated"
            value={formatWorkspaceDate(task.manuscriptUploadedAt)}
          />
        </dl>
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
        <Link
          href="/panelist/adviser-reviews"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          Review manuscript
        </Link>
      </CardContent>
    </Card>
  );
}

export default function MyAdviseesPage() {
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useQuery<AdviserWorkspaceDto>({
    queryKey: adviserWorkspaceQueryKey,
    queryFn: async () =>
      (await apiClientRequest(
        "/thesis/adviser/workspace",
      )) as AdviserWorkspaceDto,
    refetchOnWindowFocus: true,
  });

  const integrityMessage =
    error instanceof ApiError && error.statusCode === 409
      ? error.message
      : null;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <PageHeader
        title="My Advisees"
        description="View your advisees, incoming requests, and manuscript review tasks."
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isRefetching}
          >
            <RefreshCw
              className={cn("mr-2 h-4 w-4", isRefetching && "animate-spin")}
            />
            Refresh
          </Button>
        }
      />

      {isLoading ? <WorkspaceSkeleton /> : null}

      {!isLoading && isError ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Unable to load your advisees.</AlertTitle>
          <AlertDescription>
            {integrityMessage ?? "Please try again."}
          </AlertDescription>
          <div className="col-start-2 mt-2">
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
          </div>
        </Alert>
      ) : null}

      {!isLoading && !isError && data ? (
        <Tabs defaultValue="active" className="space-y-4">
          <TabsList className="grid h-auto w-full grid-cols-1 gap-1 p-1 sm:grid-cols-3">
            <TabsTrigger value="active" className="h-9 gap-2 py-1.5">
              Active Advisees
              <Badge variant="secondary">{data.activeAdvisees.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="requests" className="h-9 gap-2 py-1.5">
              Incoming Requests
              <Badge variant="secondary">{data.incomingRequests.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="reviews" className="h-9 gap-2 py-1.5">
              Review Tasks
              <Badge variant="secondary">{data.reviewTasks.length}</Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="space-y-3">
            {data.activeAdvisees.length === 0 ? (
              <EmptyState icon={Users} message={EMPTY_MESSAGES.active} />
            ) : (
              data.activeAdvisees.map((advisee) => (
                <ActiveAdviseeCard key={advisee.assignmentId} advisee={advisee} />
              ))
            )}
          </TabsContent>

          <TabsContent value="requests" className="space-y-3">
            {data.incomingRequests.length === 0 ? (
              <EmptyState icon={Inbox} message={EMPTY_MESSAGES.requests} />
            ) : (
              data.incomingRequests.map((request) => (
                <IncomingRequestCard key={request.id} request={request} />
              ))
            )}
          </TabsContent>

          <TabsContent value="reviews" className="space-y-3">
            {data.reviewTasks.length === 0 ? (
              <EmptyState icon={FileText} message={EMPTY_MESSAGES.reviews} />
            ) : (
              data.reviewTasks.map((task) => (
                <ReviewTaskCard
                  key={`${task.stage}-${task.thesisId}`}
                  task={task}
                />
              ))
            )}
          </TabsContent>
        </Tabs>
      ) : null}
    </div>
  );
}
