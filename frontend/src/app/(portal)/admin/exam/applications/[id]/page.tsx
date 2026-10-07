"use client";

import { useState } from "react";
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
import { Input } from "@/components/ui/input";
import { ExamStateBadge } from "@/components/admin/exam/exam-state-badge";
import {
  deriveExamState,
  EXAM_STATE_LABEL,
  EXAM_STATE_DESCRIPTION,
  formatExamDate,
  formatExamTime,
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

const MISSING = "—";

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

function DataRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0 space-y-0.5">
      <dt className="text-sm text-(--earist-body-text)">{label}</dt>
      <dd className="text-sm font-medium break-words text-foreground">
        {children}
      </dd>
    </div>
  );
}

function ScoreValue({
  value,
  max,
}: {
  value: number | null;
  max: number | null;
}) {
  if (value === null) {
    return <span className="text-sm text-(--earist-body-text)">{MISSING}</span>;
  }
  return (
    <span className="text-lg font-semibold text-(--earist-primary)">
      {value}
      {max !== null ? (
        <span className="text-sm font-normal text-(--earist-body-text)">
          {" "}
          / {max}
        </span>
      ) : null}
    </span>
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

/* --------------------------------------------------------------- assessment */

function AssessmentUnavailable({ state }: { state: string }) {
  const message =
    state === "SCHEDULED"
      ? "Scores will become available after the applicant completes the entrance examination."
      : state === "APPEAL_PENDING"
        ? "Assessment is not available while a missed-exam appeal is pending."
        : state === "DISQUALIFIED"
          ? "Assessment is not available for a disqualified record."
          : "Assessment is not available for the current exam state.";

  return (
    <div className="rounded-lg border border-(--earist-border-gray) bg-(--earist-surface-gray) p-4">
      <p className="text-sm font-medium text-(--earist-secondary)">
        {state === "SCHEDULED"
          ? "Assessment not available yet"
          : "Assessment not available"}
      </p>
      <p className="mt-1 text-sm text-(--earist-body-text)">{message}</p>
    </div>
  );
}

/* -------------------------------------------------------------------- page */

export default function ExamRecordDetailPage() {
  const params = useParams();
  const applicationId = params.id as string;
  const queryClient = useQueryClient();

  const [essayScore, setEssayScore] = useState("");

  const recordQuery = useQuery<ExamRecordDetail>({
    queryKey: ["examRecord", applicationId],
    queryFn: () => apiClientRequest(`/exam/applications/${applicationId}`),
    retry: false,
  });

  const gradeMutation = useMutation({
    mutationFn: () =>
      apiClientRequest(`/exam/scores/${applicationId}/grade`, {
        method: "POST",
        body: JSON.stringify({ essayScore: Number(essayScore) }),
      }),
    onSuccess: () => {
      toast.success("Essay grade saved.");
      setEssayScore("");
      queryClient.invalidateQueries({
        queryKey: ["examRecord", applicationId],
      });
      queryClient.invalidateQueries({ queryKey: ["examRecords"] });
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to save essay grade."),
  });

  const emailMutation = useMutation({
    mutationFn: () =>
      apiClientRequest(`/exam/scores/${applicationId}/send-email`, {
        method: "POST",
      }),
    onSuccess: () => toast.success("Result email queued."),
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
  const state = deriveExamState(record.status);
  const fullName = `${record.student.user.firstName} ${record.student.user.lastName}`.trim();
  const pinnacleId = record.student.pinnacleApplicantId || "No Pinnacle ID";
  const programName = record.program.programName;
  const essayMax = record.program.examEssayTotal;
  const mcqMax = record.program.examMcqTotal;
  const schedule = `${formatExamDate(record.slot.examDate)} · ${formatExamTime(
    record.slot.examTime,
  )}`;

  const isCompleted = state === "PASSED" || state === "FAILED";
  const isGrading = state === "NEEDS_GRADING";

  // Essay-score validation (client-side; the backend remains authoritative).
  const trimmedScore = essayScore.trim();
  const numericScore = Number(trimmedScore);
  const essayValidationError =
    trimmedScore === ""
      ? null
      : !Number.isFinite(numericScore)
        ? "Enter a valid number."
        : numericScore < 0
          ? "Score cannot be negative."
          : essayMax !== null && numericScore > essayMax
            ? `Score cannot exceed ${essayMax}.`
            : null;
  const canSave =
    trimmedScore !== "" &&
    essayValidationError === null &&
    !gradeMutation.isPending;

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

      {/* Current Exam State */}
      <Card>
        <CardContent className="space-y-3">
          <p className="text-xs font-semibold text-(--earist-body-text)">
            Current Exam State
          </p>
          <p className="text-lg font-semibold text-(--earist-primary)">
            {EXAM_STATE_LABEL[state]}
          </p>
          <p className="max-w-2xl text-sm text-(--earist-body-text)">
            {EXAM_STATE_DESCRIPTION[state]}
          </p>
          <p className="text-sm text-(--earist-body-text)">{schedule}</p>
        </CardContent>
      </Card>

      {/* Exam Information */}
      <SectionCard title="Exam Information">
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <DataRow label="Program">{programName}</DataRow>
          <DataRow label="Exam Date">
            {formatExamDate(record.slot.examDate)}
          </DataRow>
          <DataRow label="Exam Time">
            {formatExamTime(record.slot.examTime)}
          </DataRow>
          <DataRow label="Exam State">{EXAM_STATE_LABEL[state]}</DataRow>
        </dl>
      </SectionCard>

      {/* Assessment */}
      <SectionCard title="Assessment">
        {isGrading ? (
          <div className="space-y-5">
            <div className="rounded-lg border border-(--earist-border-gray) bg-(--earist-surface-gray) p-4">
              <p className="text-xs text-(--earist-body-text)">Multiple Choice</p>
              <ScoreValue
                value={record.score?.multipleChoiceScore ?? null}
                max={mcqMax}
              />
              <p className="mt-1 text-xs text-(--earist-body-text)">
                Auto-graded
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-(--earist-secondary)">
                Essay Response
              </h3>
              {record.essayAnswers.length === 0 ? (
                <p className="text-sm text-(--earist-body-text)">
                  No essay response recorded.
                </p>
              ) : (
                <ol className="space-y-4">
                  {record.essayAnswers.map((answer, index) => (
                    <li key={answer.questionId} className="space-y-1.5">
                      <p className="text-sm font-medium text-(--earist-secondary)">
                        Question {index + 1}
                      </p>
                      <p className="text-sm break-words text-(--earist-body-text)">
                        {answer.questionText}
                      </p>
                      <div className="rounded-lg border border-(--earist-border-gray) bg-(--earist-surface-gray) p-3">
                        <p className="text-sm break-words whitespace-pre-wrap text-foreground">
                          {answer.essayAnswer?.trim()
                            ? answer.essayAnswer
                            : "No response submitted."}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>

            <div className="space-y-2">
              <label
                htmlFor="essay-score"
                className="block text-sm font-medium text-(--earist-secondary)"
              >
                Essay Score
              </label>
              <div className="flex items-center gap-2">
                <Input
                  id="essay-score"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={essayMax ?? undefined}
                  step="1"
                  value={essayScore}
                  onChange={(event) => setEssayScore(event.target.value)}
                  className="w-28 text-center"
                  aria-invalid={essayValidationError !== null}
                  aria-describedby={
                    essayValidationError ? "essay-score-error" : undefined
                  }
                  placeholder="0"
                />
                {essayMax !== null ? (
                  <span className="text-sm text-(--earist-body-text)">
                    / {essayMax}
                  </span>
                ) : null}
              </div>
              {essayValidationError ? (
                <p
                  id="essay-score-error"
                  className="text-xs text-destructive"
                  role="alert"
                >
                  {essayValidationError}
                </p>
              ) : null}
            </div>

            <Button
              onClick={() => gradeMutation.mutate()}
              disabled={!canSave}
            >
              {gradeMutation.isPending ? "Saving…" : "Save Essay Grade"}
            </Button>
          </div>
        ) : isCompleted ? (
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <DataRow label="Multiple Choice">
              <ScoreValue
                value={record.score?.multipleChoiceScore ?? null}
                max={mcqMax}
              />
              <span className="ml-2 text-xs text-(--earist-body-text)">
                Auto-graded
              </span>
            </DataRow>
            <DataRow label="Essay">
              <ScoreValue
                value={record.score?.essayScore ?? null}
                max={essayMax}
              />
            </DataRow>
            <DataRow label="Total">
              <span className="text-lg font-semibold text-(--earist-primary)">
                {record.score?.totalScore ?? MISSING}
              </span>
            </DataRow>
            <DataRow label="Result">
              <ExamStateBadge state={state} />
            </DataRow>
            <DataRow label="Graded by">
              {record.score?.gradedBy
                ? `${record.score.gradedBy.firstName} ${record.score.gradedBy.lastName}`
                : "Not recorded"}
            </DataRow>
          </dl>
        ) : (
          <AssessmentUnavailable state={state} />
        )}
      </SectionCard>

      {/* Result Notification */}
      {isCompleted ? (
        <SectionCard
          title="Result Notification"
          description="Queue the official result email to the applicant."
          action={
            <Button
              variant="outline"
              onClick={() => emailMutation.mutate()}
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

      {/* Missed Exam Appeal (read-only context) */}
      {state === "APPEAL_PENDING" ? (
        <SectionCard
          title="Missed Exam Appeal"
          description="Appeal actions are not available on this page yet."
        >
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <DataRow label="Status">Appeal Pending</DataRow>
            <DataRow label="Original Exam Schedule">{schedule}</DataRow>
          </dl>
        </SectionCard>
      ) : null}
    </div>
  );
}
