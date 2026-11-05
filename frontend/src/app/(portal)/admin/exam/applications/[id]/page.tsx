"use client";

import { useRef } from "react";
import { ResultBreakdown } from "@/components/exam-content/result-breakdown";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClientRequest, ApiError } from "@/lib/api.client";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Card, CardContent } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { ExamRecordActions } from "@/components/admin/exam/exam-record-actions";
import { EssayEvaluationPanel } from "@/components/admin/exam/essay-evaluation-panel";
import { StartAuthorization } from "@/components/admin/exam/start-authorization";
import {
  deriveExamState,
  EXAM_STATE_LABEL,
  EXAM_STATE_DESCRIPTION,
  EXAM_STATE_BADGE_CLASS,
} from "@/lib/exam-record-state";
import type { ExamRecordDetail } from "@/types";
import { toast } from "sonner";
import {
  AlertCircle,
  ChevronRight,
  FileText,
  RefreshCw,
  Send,
} from "lucide-react";

/* -------------------------------------------------------------- small parts */

function SectionCard({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 space-y-1">
            <h2 className="text-base font-semibold text-(--earist-secondary)">
              {title}
            </h2>
            {description ? (
              <p className="text-xs text-(--earist-body-text)">{description}</p>
            ) : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------ async states */

function DetailSkeleton() {
  return (
    <div
      className="mx-auto w-full max-w-6xl space-y-6"
      aria-busy="true"
      aria-live="polite"
    >
      <Skeleton className="h-4 w-56" />
      <div className="space-y-2">
        <Skeleton className="h-8 w-64 max-w-full" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <Skeleton className="h-28 w-full rounded-xl" />
      <Skeleton className="h-44 w-full rounded-xl" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}

function StateFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <Breadcrumb
        items={[
          { label: "Exam Records", href: "/admin/exam/applications" },
          { label: "Exam Record" },
        ]}
      />
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          {children}
        </CardContent>
      </Card>
    </div>
  );
}

function NotFoundState() {
  return (
    <StateFrame>
      <FileText
        className="h-8 w-8 text-(--earist-body-text)/40"
        aria-hidden="true"
      />
      <div className="space-y-1">
        <p className="text-sm font-semibold text-(--earist-primary)">
          Exam record not found
        </p>
        <p className="max-w-sm text-sm text-(--earist-body-text)">
          This entrance exam record does not exist or is no longer available.
        </p>
      </div>
      <Link
        href="/admin/exam/applications"
        className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
      >
        Back to Exam Records
      </Link>
    </StateFrame>
  );
}

function ErrorState({
  onRetry,
  retrying,
}: {
  onRetry: () => void;
  retrying: boolean;
}) {
  return (
    <StateFrame>
      <AlertCircle
        className="h-8 w-8 text-(--earist-secondary)"
        aria-hidden="true"
      />
      <div className="space-y-1">
        <p className="text-sm font-semibold text-(--earist-primary)">
          Unable to load exam record
        </p>
        <p className="max-w-sm text-sm text-(--earist-body-text)">
          Something went wrong while loading this record. Please try again.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          disabled={retrying}
        >
          <RefreshCw
            className={cn("mr-2 h-4 w-4", retrying && "animate-spin")}
            aria-hidden="true"
          />
          Retry
        </Button>
        <Link
          href="/admin/exam/applications"
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
        >
          Back to Exam Records
        </Link>
      </div>
    </StateFrame>
  );
}

/* -------------------------------------------------------------------- page */

export default function ExamRecordDetailPage() {
  const params = useParams();
  const applicationId = params.id as string;
  const queryClient = useQueryClient();

  const recordQuery = useQuery<ExamRecordDetail>({
    queryKey: ["examRecord", applicationId],
    queryFn: () => apiClientRequest(`/exam/applications/${applicationId}`),
    retry: false,
  });

  const emailBusy = useRef(false);
  const finalizeBusy = useRef(false);
  const finalizeMutation = useMutation({
    mutationFn: () =>
      apiClientRequest(`/exam/scores/${applicationId}/finalize`, {
        method: "POST",
        body: "{}",
      }),
    onSuccess: () => toast.success("Result finalized."),
    onError: (error: Error) => toast.error(error.message),
    onSettled: async () => {
      try {
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: ["examRecord", applicationId],
          }),
          queryClient.invalidateQueries({ queryKey: ["examRecords"] }),
        ]);
      } finally {
        finalizeBusy.current = false;
      }
    },
  });
  const emailMutation = useMutation({
    mutationFn: () =>
      apiClientRequest(`/exam/scores/${applicationId}/send-email`, {
        method: "POST",
      }),
    onSuccess: (response: { message: string }) =>
      toast.success(response.message),
    onSettled: () => {
      emailBusy.current = false;
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to queue result email."),
  });

  if (recordQuery.isLoading) {
    return <DetailSkeleton />;
  }

  const statusCode =
    recordQuery.error instanceof ApiError
      ? recordQuery.error.statusCode
      : undefined;
  if (recordQuery.isError && statusCode === 404) {
    return <NotFoundState />;
  }

  if (recordQuery.isError || !recordQuery.data) {
    return (
      <ErrorState
        onRetry={() => recordQuery.refetch()}
        retrying={recordQuery.isFetching}
      />
    );
  }

  const record = recordQuery.data;
  const state = deriveExamState(
    record.status,
    record.essayEvaluation?.status === "COMPLETED",
    record.effectiveStatus === "passed_reconsidered",
  );
  const fullName =
    `${record.student.user.firstName} ${record.student.user.lastName}`.trim();
  const pinnacleId = record.student.pinnacleApplicantId || "No Pinnacle ID";
  const programName = record.program.programName;
  const isCompleted = record.status === "PASSED" || record.status === "FAILED";
  const isTaken = record.status === "TAKEN";

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <Breadcrumb
        items={[
          { label: "Exam Records", href: "/admin/exam/applications" },
          { label: fullName || "Exam Record" },
        ]}
      />

      <PageHeader
        title={fullName || "Exam Record"}
        description={`${pinnacleId} · ${programName}`}
        actions={
          <Link
            href={`/admin/users/applicants/${record.student.id}`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            View Applicant Profile
            <ChevronRight className="ml-1 h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        }
      />

      <SectionCard title="Examination Result">
        <div className="space-y-1">
          {isCompleted && record.result && state !== "PASSED_RECONSIDERED" ? (
            <p className="text-xs text-muted-foreground">Computed Result</p>
          ) : null}
          <p
            className={cn(
              "text-xl font-semibold",
              EXAM_STATE_BADGE_CLASS[state],
            )}
          >
            {state === "PASSED_RECONSIDERED"
              ? "Final Decision: Passed — Reconsidered"
              : EXAM_STATE_LABEL[state]}
          </p>
          {!isCompleted && !isTaken ? (
            <p className="text-sm text-muted-foreground">
              {EXAM_STATE_DESCRIPTION[state]}
            </p>
          ) : null}
        </div>
        {isCompleted ? (
          record.result ? (
            <ResultBreakdown
              result={record.result}
              showComputedResult={state === "PASSED_RECONSIDERED"}
            />
          ) : (
            <p role="alert" className="text-sm">
              Result evidence requires staff review. Publication is unavailable.
            </p>
          )
        ) : null}
      </SectionCard>

      <div className="space-y-4">
        <StartAuthorization
          applicationId={applicationId}
          applicantName={fullName}
        />
        <ExamRecordActions record={record} section="appointment" />
      </div>

      {isTaken || isCompleted ? (
        <SectionCard title="Essay Evaluation">
          <EssayEvaluationPanel
            key={applicationId}
            applicationId={applicationId}
            evaluation={record.essayEvaluation}
          />
          {isTaken && record.essayEvaluation?.status === "COMPLETED" ? (
            <Button
              disabled={finalizeMutation.isPending}
              onClick={() => {
                if (finalizeBusy.current) return;
                finalizeBusy.current = true;
                finalizeMutation.mutate();
              }}
            >
              {finalizeMutation.isPending ? "Finalizing…" : "Finalize Result"}
            </Button>
          ) : null}
        </SectionCard>
      ) : null}

      <ExamRecordActions record={record} section="reconsideration" />

      {/* Result Notification */}
      {isCompleted && record.resultEmailEligible ? (
        <SectionCard
          title="Result Notification"
          description="Queue the official result email to the applicant."
          action={
            <Button
              variant="outline"
              onClick={() => {
                if (emailBusy.current) return;
                emailBusy.current = true;
                emailMutation.mutate();
              }}
              disabled={emailMutation.isPending}
            >
              <Send className="mr-2 h-4 w-4" aria-hidden="true" />
              {emailMutation.isPending ? "Queueing…" : "Send Result Email"}
            </Button>
          }
        >
          <p className="text-sm text-(--earist-body-text)">
            The result email is placed on the system email queue for delivery.
          </p>
        </SectionCard>
      ) : null}
    </div>
  );
}
