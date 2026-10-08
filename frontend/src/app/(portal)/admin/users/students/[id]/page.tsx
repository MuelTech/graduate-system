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
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { AdminStudentDetail } from "@/types";
import type {
  JourneyStepView,
  StudentThesisJourney,
} from "@/types/student-thesis-journey";
import {
  defenseStatusDescription,
  defenseStatusHeading,
  formatDefenseDate,
  formatDefenseTime,
  journeyLabelFor,
  sessionStatusLabel,
} from "@/lib/student-thesis-journey";
import { toast } from "sonner";
import {
  AlertCircle,
  CheckCircle2,
  CircleDot,
  Clock,
  KeyRound,
  Lock,
  RefreshCw,
  Users,
} from "lucide-react";

const MISSING = "—";

/* --------------------------------------------------------------- formatting */

function formatDate(iso: string | null | undefined): string {
  if (!iso) return MISSING;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return MISSING;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/* ------------------------------------------------------------ presentation */

const ADMISSION_STATUS_LABEL: Record<string, string> = {
  ENROLLED: "Enrolled",
  GRADUATED: "Graduated",
  DISMISSED: "Dismissed",
};

const ADMISSION_STATUS_CLASS: Record<string, string> = {
  ENROLLED: "text-(--earist-success)",
  GRADUATED: "text-(--earist-secondary)",
  DISMISSED: "text-destructive",
};

const COMP_EXAM_LABEL: Record<string, string> = {
  PENDING: "Pending",
  PASSED: "Passed",
  FAILED: "Failed",
};

const ALIGNMENT_LABEL: Record<string, string> = {
  ALIGNED: "Aligned",
  PENDING_WAIVER: "Bridging waiver pending",
  CLEARED: "Cleared",
};

const JOURNEY_STATE_LABEL: Record<string, string> = {
  COMPLETED: "Completed",
  CURRENT: "Current",
  AVAILABLE: "Available",
  WAITING: "Waiting",
  LOCKED: "Locked",
};

const JOURNEY_STATE_CLASS: Record<string, string> = {
  COMPLETED: "text-(--earist-success)",
  CURRENT: "text-(--earist-primary)",
  AVAILABLE: "text-(--earist-secondary)",
  WAITING: "text-(--earist-warning)",
  LOCKED: "text-(--earist-body-text)",
};

function admissionStatusLabel(status: string): string {
  return ADMISSION_STATUS_LABEL[status] ?? status;
}

function compExamLabel(status: string): string {
  return COMP_EXAM_LABEL[status] ?? status;
}

function defenseKindForStep(
  key: JourneyStepView["key"],
): "Title" | "Proposal" | "Final" {
  if (key === "PROPOSAL_DEFENSE") return "Proposal";
  if (key === "FINAL_DEFENSE") return "Final";
  return "Title";
}

/* -------------------------------------------------------------- components */

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
      <dt className="text-xs text-(--earist-body-text)">{label}</dt>
      <dd className="text-sm font-medium break-words text-foreground">
        {children}
      </dd>
    </div>
  );
}

function AdmissionStatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant="outline"
      className={cn("font-medium", ADMISSION_STATUS_CLASS[status])}
    >
      {admissionStatusLabel(status)}
    </Badge>
  );
}

function JourneyStateIcon({ state }: { state: string }) {
  if (state === "COMPLETED") {
    return (
      <CheckCircle2
        className="h-4 w-4 text-(--earist-success)"
        aria-hidden="true"
      />
    );
  }
  if (state === "CURRENT") {
    return (
      <CircleDot
        className="h-4 w-4 text-(--earist-primary)"
        aria-hidden="true"
      />
    );
  }
  if (state === "AVAILABLE") {
    return (
      <CircleDot
        className="h-4 w-4 text-(--earist-secondary)"
        aria-hidden="true"
      />
    );
  }
  if (state === "WAITING") {
    return (
      <Clock className="h-4 w-4 text-(--earist-warning)" aria-hidden="true" />
    );
  }
  return (
    <Lock
      className="h-4 w-4 text-(--earist-body-text)/60"
      aria-hidden="true"
    />
  );
}

function JourneyStepRow({ step }: { step: JourneyStepView }) {
  const kind = defenseKindForStep(step.key);
  const session = step.defenseSession;
  const showBlocker = step.state === "LOCKED" && Boolean(step.lockReason);

  return (
    <li className="flex gap-3">
      <div className="mt-0.5 shrink-0">
        <JourneyStateIcon state={step.state} />
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-foreground">
            {journeyLabelFor(step.key, step.label)}
          </p>
          <Badge
            variant="outline"
            className={cn(
              "font-medium",
              JOURNEY_STATE_CLASS[step.state] ??
                "text-(--earist-body-text)",
            )}
          >
            {JOURNEY_STATE_LABEL[step.state] ?? step.state}
          </Badge>
        </div>

        {showBlocker ? (
          <p className="text-sm text-(--earist-warning)">{step.lockReason}</p>
        ) : step.detail ? (
          <p className="text-sm break-words text-(--earist-body-text)">
            {step.detail}
          </p>
        ) : null}

        {step.defenseStatus ? (
          <p className="text-xs text-(--earist-body-text)">
            {defenseStatusHeading(step.defenseStatus, "Defense status")} —{" "}
            {defenseStatusDescription(step.defenseStatus, kind, null)}
          </p>
        ) : null}

        {session ? (
          <p className="text-xs text-(--earist-body-text)">
            {session.sessionStatus
              ? `${sessionStatusLabel(session.sessionStatus)} · `
              : ""}
            {formatDefenseDate(session.defenseDate)} ·{" "}
            {formatDefenseTime(session.defenseTime)}
            {session.venueOrLink ? ` · ${session.venueOrLink}` : ""}
          </p>
        ) : null}

        {step.nextAction && step.state !== "COMPLETED" ? (
          <p className="text-xs text-(--earist-body-text)">
            Next: {step.nextAction}
          </p>
        ) : null}
      </div>
    </li>
  );
}

/* ------------------------------------------------------------ async states */

function DetailSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <Skeleton className="h-4 w-56" />
      <div className="space-y-2">
        <Skeleton className="h-8 w-64 max-w-full" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <Skeleton className="h-28 w-full rounded-xl" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Skeleton className="h-80 w-full rounded-xl" />
        </div>
        <div className="space-y-6">
          <Skeleton className="h-44 w-full rounded-xl" />
          <Skeleton className="h-36 w-full rounded-xl" />
        </div>
      </div>
      <Skeleton className="h-56 w-full rounded-xl" />
    </div>
  );
}

function StateFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { label: "Students", href: "/admin/users/students" },
          { label: "Student Profile" },
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
      <Users
        className="h-8 w-8 text-(--earist-body-text)/40"
        aria-hidden="true"
      />
      <div className="space-y-1">
        <p className="text-sm font-semibold text-(--earist-primary)">
          Student not found
        </p>
        <p className="max-w-sm text-sm text-(--earist-body-text)">
          This student record does not exist or is no longer available.
        </p>
      </div>
      <Link
        href="/admin/users/students"
        className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
      >
        Back to Students
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
          Unable to load student
        </p>
        <p className="max-w-sm text-sm text-(--earist-body-text)">
          Something went wrong while loading this student record. Please try
          again.
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
          href="/admin/users/students"
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
        >
          Back to Students
        </Link>
      </div>
    </StateFrame>
  );
}

/* -------------------------------------------------------------------- page */

export default function StudentDetailPage() {
  const params = useParams();
  const studentId = params.id as string;
  const queryClient = useQueryClient();

  const [compExamAction, setCompExamAction] = useState<
    "PASSED" | "FAILED" | null
  >(null);

  const studentQuery = useQuery<AdminStudentDetail>({
    queryKey: ["adminStudentDetail", studentId],
    queryFn: () => apiClientRequest(`/admin/students/${studentId}`),
    retry: false,
  });

  const journeyQuery = useQuery<StudentThesisJourney>({
    queryKey: ["adminStudentJourney", studentId],
    queryFn: () => apiClientRequest(`/admin/students/${studentId}/journey`),
    retry: false,
  });

  const markCompExamMutation = useMutation({
    mutationFn: (status: "PASSED" | "FAILED") =>
      apiClientRequest(`/admin/students/${studentId}/comprehensive-exam`, {
        method: "PUT",
        body: JSON.stringify({ status }),
      }),
    onSuccess: (data: { message?: string }) => {
      toast.success(data?.message ?? "Comprehensive exam status updated.");
      setCompExamAction(null);
      queryClient.invalidateQueries({
        queryKey: ["adminStudentDetail", studentId],
      });
      queryClient.invalidateQueries({
        queryKey: ["adminStudentJourney", studentId],
      });
      queryClient.invalidateQueries({ queryKey: ["adminStudents"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (studentQuery.isLoading) {
    return <DetailSkeleton />;
  }

  const statusCode =
    studentQuery.error instanceof ApiError
      ? studentQuery.error.statusCode
      : undefined;
  if (studentQuery.isError && statusCode === 404) {
    return <NotFoundState />;
  }

  if (studentQuery.isError || !studentQuery.data) {
    return (
      <ErrorState
        onRetry={() => studentQuery.refetch()}
        retrying={studentQuery.isFetching}
      />
    );
  }

  const student = studentQuery.data;
  const fullName = `${student.firstName} ${student.lastName}`.trim();
  const programName = student.program?.programName ?? MISSING;
  const journey = journeyQuery.data;
  const currentStep =
    journey?.steps.find((step) => step.key === journey.currentStep) ?? null;

  // Only active students may have a Comprehensive Exam recorded.
  const canRecordCompExam = student.admissionStatus === "ENROLLED";

  const summaryNext =
    currentStep?.state === "LOCKED"
      ? currentStep.lockReason
      : (currentStep?.nextAction ?? null);

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { label: "Students", href: "/admin/users/students" },
          { label: "Student Profile" },
        ]}
      />

      <PageHeader
        title={fullName || "Student"}
        description={`${student.studentNumber ?? "No student number"} · ${programName} · ${admissionStatusLabel(student.admissionStatus)}`}
      />

      {/* Current Academic State */}
      <Card>
        <CardContent className="space-y-4">
          <p className="text-xs font-semibold text-(--earist-body-text)">
            Current Academic State
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1">
              <p className="text-xs text-(--earist-body-text)">Student Status</p>
              <AdmissionStatusBadge status={student.admissionStatus} />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-(--earist-body-text)">
                Comprehensive Exam
              </p>
              <p className="text-sm font-medium text-foreground">
                {student.compExam
                  ? compExamLabel(student.compExam.status)
                  : "Not recorded"}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-(--earist-body-text)">
                Current Thesis Stage
              </p>
              <p className="text-sm font-medium text-foreground">
                {journeyQuery.isLoading
                  ? "Loading…"
                  : currentStep
                    ? `${journeyLabelFor(currentStep.key, currentStep.label)} · ${JOURNEY_STATE_LABEL[currentStep.state] ?? currentStep.state}`
                    : journeyQuery.isError
                      ? "Unavailable"
                      : MISSING}
              </p>
            </div>
          </div>
          {summaryNext ? (
            <p className="max-w-2xl text-sm text-(--earist-body-text)">
              {currentStep?.state === "LOCKED" ? "Blocked: " : "Next: "}
              {summaryNext}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Academic Journey — dominant content */}
        <div className="space-y-6 lg:col-span-2">
          <SectionCard
            title="Academic Journey"
            description="Authoritative progression derived from formal defense records."
            action={
              <Link
                href="/admin/thesis/defense-records"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                Defense Records
              </Link>
            }
          >
            {journeyQuery.isLoading ? (
              <ul className="space-y-4" aria-busy="true">
                {Array.from({ length: 5 }).map((_, index) => (
                  <li key={index} className="flex gap-3">
                    <Skeleton className="h-4 w-4 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-3 w-64 max-w-full" />
                    </div>
                  </li>
                ))}
              </ul>
            ) : journeyQuery.isError ? (
              <div className="flex flex-col items-center gap-3 rounded-lg border border-(--earist-border-gray) bg-(--earist-surface-gray) px-6 py-10 text-center">
                <AlertCircle
                  className="h-7 w-7 text-(--earist-secondary)"
                  aria-hidden="true"
                />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-(--earist-primary)">
                    Academic journey unavailable
                  </p>
                  <p className="max-w-sm text-sm text-(--earist-body-text)">
                    Student details loaded, but the thesis journey could not be
                    retrieved.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => journeyQuery.refetch()}
                  disabled={journeyQuery.isFetching}
                >
                  <RefreshCw
                    className={cn(
                      "mr-2 h-4 w-4",
                      journeyQuery.isFetching && "animate-spin",
                    )}
                    aria-hidden="true"
                  />
                  Retry
                </Button>
              </div>
            ) : journey && journey.steps.length > 0 ? (
              <ol className="space-y-5">
                {journey.steps.map((step) => (
                  <JourneyStepRow key={step.key} step={step} />
                ))}
              </ol>
            ) : (
              <p className="text-sm text-(--earist-body-text)">
                No thesis journey is available for this student yet.
              </p>
            )}
          </SectionCard>
        </div>

        {/* Supporting context */}
        <div className="space-y-6">
          <SectionCard title="Comprehensive Examination">
            <dl className="grid grid-cols-1 gap-3">
              <DataRow label="Status">
                {student.compExam
                  ? compExamLabel(student.compExam.status)
                  : "Not recorded"}
              </DataRow>
              {student.compExam?.recordedAt ? (
                <DataRow label="Record created">
                  {formatDate(student.compExam.recordedAt)}
                </DataRow>
              ) : null}
            </dl>

            {canRecordCompExam ? (
              <div className="flex flex-wrap gap-2 pt-1">
                <Button
                  size="sm"
                  className="bg-(--earist-success) text-white hover:bg-(--earist-success)/90"
                  onClick={() => setCompExamAction("PASSED")}
                  disabled={markCompExamMutation.isPending}
                >
                  Mark as Passed
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => setCompExamAction("FAILED")}
                  disabled={markCompExamMutation.isPending}
                >
                  Mark as Failed
                </Button>
              </div>
            ) : (
              <p className="text-xs text-(--earist-body-text)">
                Examination recording is available for enrolled students only.
              </p>
            )}
          </SectionCard>

          <SectionCard
            title="Account Support"
            description="Assistance for this student's portal account."
          >
            <DataRow label="Account Email">
              {student.email || MISSING}
            </DataRow>
            <Button
              variant="outline"
              size="sm"
              disabled
              title="Password recovery is not yet available"
              className="w-full sm:w-auto"
            >
              <KeyRound className="mr-2 h-4 w-4" aria-hidden="true" />
              Reset Student Password
            </Button>
            <p className="text-xs text-(--earist-body-text)">
              Password recovery will be available through an authorized
              administrator.
            </p>
          </SectionCard>
        </div>
      </div>

      {/* Student & Academic Details — full width, grouped for scanning */}
      <SectionCard title="Student & Academic Details">
        <div className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2 lg:grid-cols-3">
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-(--earist-body-text)">
              Personal Information
            </h3>
            <dl className="space-y-3">
              <DataRow label="Full Name">{fullName || MISSING}</DataRow>
              <DataRow label="Student Number">
                {student.studentNumber ?? MISSING}
              </DataRow>
              <DataRow label="Email Address">{student.email || MISSING}</DataRow>
              <DataRow label="Contact Number">
                {student.cellphone ?? MISSING}
              </DataRow>
            </dl>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-(--earist-body-text)">
              Academic Information
            </h3>
            <dl className="space-y-3">
              <DataRow label="Official Program">{programName}</DataRow>
              <DataRow label="Enrollment Date">
                {formatDate(student.enrollmentDate)}
              </DataRow>
              <DataRow label="Curriculum Type">
                {student.curriculumType ?? MISSING}
              </DataRow>
              {student.alignmentStatus ? (
                <DataRow label="Alignment Status">
                  {ALIGNMENT_LABEL[student.alignmentStatus] ??
                    student.alignmentStatus}
                </DataRow>
              ) : null}
            </dl>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-(--earist-body-text)">
              Adviser & Residency
            </h3>
            <dl className="space-y-3">
              <DataRow label="Active Adviser">
                {student.adviserAssignment
                  ? student.adviserAssignment.adviserName
                  : "Not assigned"}
              </DataRow>
              <DataRow label="Residency Start Date">
                {student.residency?.startDate
                  ? formatDate(student.residency.startDate)
                  : MISSING}
              </DataRow>
              <DataRow label="Maximum Residency Duration">
                {student.residency?.maxYears != null
                  ? `${student.residency.maxYears} years`
                  : MISSING}
              </DataRow>
            </dl>
          </section>
        </div>
      </SectionCard>

      {/* Comprehensive Exam confirmation */}
      <Dialog
        open={compExamAction !== null}
        onOpenChange={(open) => {
          if (!open) setCompExamAction(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Mark comprehensive exam as{" "}
              {compExamAction === "FAILED" ? "Failed" : "Passed"}?
            </DialogTitle>
            <DialogDescription>
              {compExamAction === "FAILED"
                ? "This records a failed comprehensive examination for this student."
                : "This records a passing comprehensive examination result for this student."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Cancel
            </DialogClose>
            <Button
              variant={compExamAction === "FAILED" ? "destructive" : "default"}
              disabled={markCompExamMutation.isPending}
              onClick={() => {
                if (compExamAction) markCompExamMutation.mutate(compExamAction);
              }}
            >
              {markCompExamMutation.isPending ? "Saving…" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
