"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { apiClientRequest, ApiError } from "@/lib/api.client";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { EssayEvaluationPanel } from "@/components/admin/exam/essay-evaluation-panel";
import { ResultBreakdown } from "@/components/exam-content/result-breakdown";
import { formatExamDate, formatExamTime } from "@/lib/exam-record-state";
import type { ExamRecordDetail } from "@/types";
import { AlertCircle, ArrowLeft, FileText, RefreshCw } from "lucide-react";

export default function FacultyEssayEvaluationDetailPage() {
  const params = useParams();
  const applicationId = params.id as string;

  const recordQuery = useQuery<ExamRecordDetail>({
    queryKey: ["examRecord", applicationId],
    queryFn: () => apiClientRequest(`/exam/applications/${applicationId}`),
    retry: false,
  });

  if (recordQuery.isLoading) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <Skeleton className="h-4 w-56" />
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  const statusCode =
    recordQuery.error instanceof ApiError
      ? recordQuery.error.statusCode
      : undefined;

  if (recordQuery.isError || !recordQuery.data) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <Breadcrumb
          items={[
            {
              label: "Essay Evaluations",
              href: "/faculty/essay-evaluations",
            },
            { label: "Evaluation Record" },
          ]}
        />
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            {statusCode === 404 ? (
              <FileText className="h-8 w-8 text-(--earist-body-text)/40" />
            ) : (
              <AlertCircle className="h-8 w-8 text-(--earist-secondary)" />
            )}
            <div className="space-y-1">
              <p className="text-sm font-semibold text-(--earist-primary)">
                {statusCode === 404
                  ? "Exam record not found"
                  : "Unable to load essay evaluation"}
              </p>
              <p className="max-w-sm text-sm text-(--earist-body-text)">
                {statusCode === 404
                  ? "This entrance exam record does not exist or is no longer available."
                  : "Something went wrong while loading this record. Please try again."}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {statusCode !== 404 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void recordQuery.refetch()}
                  disabled={recordQuery.isFetching}
                >
                  <RefreshCw
                    className={cn(
                      "mr-2 h-4 w-4",
                      recordQuery.isFetching && "animate-spin",
                    )}
                  />
                  Retry
                </Button>
              )}
              <Link
                href="/faculty/essay-evaluations"
                className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
              >
                Back to Essay Evaluations
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const record = recordQuery.data;
  const fullName =
    `${record.student.user.firstName} ${record.student.user.lastName}`.trim();
  const pinnacleId = record.student.pinnacleApplicantId || "No Pinnacle ID";
  const isEvaluated = record.essayEvaluation?.status === "COMPLETED";
  const isCompleted =
    record.status === "PASSED" || record.status === "FAILED";

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <Breadcrumb
        items={[
          { label: "Essay Evaluations", href: "/faculty/essay-evaluations" },
          { label: fullName || "Applicant Essay" },
        ]}
      />

      <PageHeader
        title={fullName || "Applicant Essay Evaluation"}
        description={`${pinnacleId} · ${record.program.programName}`}
        actions={
          <Link
            href="/faculty/essay-evaluations"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Back to List
          </Link>
        }
      />

      {/* Applicant & Exam Session Summary */}
      <Card>
        <CardContent className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-(--earist-body-text)">
                Examination Session
              </p>
              <p className="text-sm font-medium text-foreground">
                {record.slot?.examDate
                  ? `${formatExamDate(record.slot.examDate)} · ${formatExamTime(record.slot.examTime)}`
                  : "Schedule not recorded"}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Badge
                className={
                  isEvaluated
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-amber-100 text-amber-800"
                }
              >
                {isEvaluated ? "Essay Evaluated" : "Pending Essay Evaluation"}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Essay Evaluation Form / Result */}
      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="space-y-1 border-b border-(--earist-border-gray) pb-3">
            <h2 className="text-base font-semibold text-(--earist-primary)">
              Essay Question & Applicant Response
            </h2>
            <p className="text-xs text-(--earist-body-text)">
              Review the applicant&apos;s written response and record the essay
              score.
            </p>
          </div>

          <EssayEvaluationPanel
            key={applicationId}
            applicationId={applicationId}
            evaluation={record.essayEvaluation}
          />
        </CardContent>
      </Card>

      {/* Computed Result Breakdown (once evaluated) */}
      {isCompleted && record.result ? (
        <Card>
          <CardContent className="space-y-4 p-5">
            <div className="space-y-1 border-b border-(--earist-border-gray) pb-3">
              <h2 className="text-base font-semibold text-(--earist-primary)">
                Computed Examination Result
              </h2>
              <p className="text-xs text-(--earist-body-text)">
                Official score breakdown combining Multiple Choice and Essay
                evaluation.
              </p>
            </div>
            <ResultBreakdown result={record.result} showComputedResult={false} />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
