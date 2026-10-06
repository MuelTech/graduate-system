"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { apiClientRequest, ApiError } from "@/lib/api.client";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type {
  AdminApplicantDetail,
  AdminApplicantStage,
  ExamApplicationDetail,
} from "@/types";
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Clock,
  RefreshCw,
  Users,
} from "lucide-react";

/* --------------------------------------------------------------- formatting */

const MISSING = "—";

function formatDate(iso: string | null | undefined): string {
  if (!iso) return MISSING;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return MISSING;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return MISSING;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return MISSING;
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatTime(iso: string | null | undefined): string {
  if (!iso) return MISSING;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return MISSING;
  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function alignmentIsComplete(status: string | null | undefined): boolean {
  return status === "ALIGNED" || status === "CLEARED";
}

const STAGE_LABEL: Record<AdminApplicantStage, string> = {
  ALIGNMENT: "Program Alignment",
  EXAM: "Entrance Examination",
  COR: "COR / Enrollment",
};

const PROGRAM_TYPE_LABEL: Record<string, string> = {
  MASTERS: "Master's",
  DOCTORAL: "Doctoral",
};

const WAIVER_STATUS_LABEL: Record<string, string> = {
  PENDING: "Pending",
  VALIDATED: "Validated",
  REJECTED: "Rejected",
};

function alignmentLabel(status: string | null): string {
  switch (status) {
    case "ALIGNED":
      return "Aligned";
    case "CLEARED":
      return "Cleared";
    case "PENDING_WAIVER":
      return "Bridging waiver pending";
    default:
      return "Alignment status unavailable";
  }
}

/** Concise, human-readable current admission condition (no raw enums). */
function currentStateLabel(a: AdminApplicantDetail): string {
  if (a.admissionStage === "ALIGNMENT") {
    return a.alignmentStatus === "PENDING_WAIVER"
      ? "Bridging waiver pending"
      : "Alignment status unavailable";
  }
  if (a.admissionStage === "EXAM") {
    return examStateLabel(a.examStatus);
  }
  switch (a.corStatus) {
    case "NONE":
      return "Exam passed — awaiting COR upload";
    case "PENDING":
      return "COR awaiting verification";
    case "REJECTED":
      return "COR rejected — awaiting resubmission";
    case "VERIFIED":
      return "COR verified";
    default:
      return "COR / enrollment in progress";
  }
}

function examStateLabel(status: string): string {
  switch (status) {
    case "NOT_SCHEDULED":
      return "Ready to schedule entrance exam";
    case "PENDING":
      return "Entrance exam scheduled";
    case "APPROVED":
      return "Entrance exam approved";
    case "TAKEN":
      return "Entrance exam awaiting grading";
    case "APPEALED":
      return "Exam appeal awaiting review";
    case "PASSED":
      return "Entrance exam passed";
    case "FAILED":
      return "Entrance exam failed";
    case "DISQUALIFIED":
      return "Disqualified from entrance exam";
    default:
      return "Entrance examination in progress";
  }
}

/**
 * Entrance Examination section wording, gated by the canonical admission stage.
 * The exam is not actionable until alignment is complete (Playbook §7 semantics),
 * so an incomplete alignment must not read as "ready to schedule".
 */
function examSectionState(a: AdminApplicantDetail): string {
  if (a.hasPassedExam) return "Entrance exam passed";
  if (!alignmentIsComplete(a.alignmentStatus)) {
    return "Waiting for program alignment";
  }
  return examStateLabel(a.examStatus);
}

/**
 * COR / Enrollment section wording, gated by the authoritative PASSED exam.
 * COR review becomes relevant only after the entrance exam is passed.
 */
function corSectionState(a: AdminApplicantDetail): string {
  if (!a.hasPassedExam) {
    return "Available after the entrance exam is passed";
  }
  return corStateLabel(a.corStatus);
}

function corStateLabel(status: string): string {
  switch (status) {
    case "NONE":
      return "Awaiting COR upload";
    case "PENDING":
      return "Awaiting verification";
    case "REJECTED":
      return "Rejected — awaiting resubmission";
    case "VERIFIED":
      return "Verified";
    default:
      return "COR / enrollment in progress";
  }
}

function labelFor<T extends string>(
  map: Record<string, string>,
  value: T | string | null | undefined,
  fallback = MISSING,
): string {
  if (!value) return fallback;
  return map[value] ?? value;
}

/* -------------------------------------------------------------- small parts */

type StepState = "COMPLETE" | "CURRENT" | "WAITING";

const STEP_STATE_WORD: Record<StepState, string> = {
  COMPLETE: "complete",
  CURRENT: "current",
  WAITING: "waiting",
};

function StepMarker({ state }: { state: StepState }) {
  if (state === "COMPLETE") {
    return (
      <CheckCircle2
        className="h-4 w-4 shrink-0 text-(--earist-success)"
        aria-hidden="true"
      />
    );
  }
  if (state === "CURRENT") {
    return (
      <CircleDot
        className="h-4 w-4 shrink-0 text-(--earist-primary)"
        aria-hidden="true"
      />
    );
  }
  return (
    <Clock
      className="h-4 w-4 shrink-0 text-(--earist-body-text)/50"
      aria-hidden="true"
    />
  );
}

function AdmissionProgress({ applicant }: { applicant: AdminApplicantDetail }) {
  const alignmentComplete = alignmentIsComplete(applicant.alignmentStatus);
  const steps: { key: string; label: string; state: StepState }[] = [
    {
      key: "alignment",
      label: "Alignment",
      state: alignmentComplete ? "COMPLETE" : "CURRENT",
    },
    {
      key: "exam",
      label: "Entrance Exam",
      state: !alignmentComplete
        ? "WAITING"
        : applicant.hasPassedExam
          ? "COMPLETE"
          : "CURRENT",
    },
    {
      key: "cor",
      label: "COR",
      state: applicant.hasPassedExam ? "CURRENT" : "WAITING",
    },
  ];

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      {steps.map((step, index) => (
        <span key={step.key} className="inline-flex items-center gap-1.5">
          {index > 0 && (
            <ChevronRight
              className="h-3 w-3 text-(--earist-body-text)/40"
              aria-hidden="true"
            />
          )}
          <StepMarker state={step.state} />
          <span
            className={cn(
              "text-xs",
              step.state === "CURRENT"
                ? "font-semibold text-(--earist-primary)"
                : "text-(--earist-body-text)",
            )}
          >
            {step.label}
          </span>
          <span className="sr-only">{STEP_STATE_WORD[step.state]}</span>
        </span>
      ))}
    </div>
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

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="min-w-0 space-y-1">
          <CardTitle className="text-base font-semibold text-(--earist-secondary)">
            {title}
          </CardTitle>
          {description ? (
            <p className="text-xs text-(--earist-body-text)">{description}</p>
          ) : null}
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function ModuleLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
    >
      {label}
      <ChevronRight className="ml-1 h-3.5 w-3.5" aria-hidden="true" />
    </Link>
  );
}

/* ------------------------------------------------------------ async states */

function DetailSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <Skeleton className="h-4 w-48" />
      <div className="space-y-2">
        <Skeleton className="h-8 w-64 max-w-full" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <Skeleton className="h-28 w-full rounded-xl" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
        <div>
          <Skeleton className="h-72 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}

function StateFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { label: "Applicants", href: "/admin/users/applicants" },
          { label: "Applicant" },
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
      <Users className="h-8 w-8 text-(--earist-body-text)/40" aria-hidden="true" />
      <div className="space-y-1">
        <p className="text-sm font-semibold text-(--earist-primary)">
          Applicant not found
        </p>
        <p className="max-w-sm text-sm text-(--earist-body-text)">
          This applicant record does not exist or is no longer available.
        </p>
      </div>
      <Link
        href="/admin/users/applicants"
        className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
      >
        Back to Applicants
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
          Unable to load applicant
        </p>
        <p className="max-w-sm text-sm text-(--earist-body-text)">
          Something went wrong while loading this applicant record. Please try
          again.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button variant="outline" size="sm" onClick={onRetry} disabled={retrying}>
          <RefreshCw
            className={cn("mr-2 h-4 w-4", retrying && "animate-spin")}
            aria-hidden="true"
          />
          Retry
        </Button>
        <Link
          href="/admin/users/applicants"
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
        >
          Back to Applicants
        </Link>
      </div>
    </StateFrame>
  );
}

/* --------------------------------------------------- journey sub-sections */

function AlignmentSection({ applicant }: { applicant: AdminApplicantDetail }) {
  const alignmentComplete = alignmentIsComplete(applicant.alignmentStatus);
  const waiver = applicant.bridgingWaiver;

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="text-base font-semibold text-(--earist-secondary)">
          Program Alignment
        </h3>
        {!alignmentComplete && (
          <ModuleLink
            href="/admin/exam/waiver"
            label="Open Waiver Validation"
          />
        )}
      </div>

      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <DataRow label="Current state">
          {alignmentLabel(applicant.alignmentStatus)}
        </DataRow>
        {waiver ? (
          <>
            <DataRow label="Bridging waiver">
              {labelFor(WAIVER_STATUS_LABEL, waiver.status, "Status unavailable")}
            </DataRow>
            {waiver.validatedAt ? (
              <DataRow label="Validated on">
                {formatDateTime(waiver.validatedAt)}
              </DataRow>
            ) : null}
            {waiver.validatedBy ? (
              <DataRow label="Validated by">
                {`${waiver.validatedBy.firstName} ${waiver.validatedBy.lastName}`}
              </DataRow>
            ) : null}
            {waiver.adminNotes ? (
              <div className="sm:col-span-2">
                <DataRow label="Administrative note">
                  {waiver.adminNotes}
                </DataRow>
              </div>
            ) : null}
          </>
        ) : null}
      </dl>
    </section>
  );
}

function ExamSection({ applicant }: { applicant: AdminApplicantDetail }) {
  const latestExam: ExamApplicationDetail | undefined =
    applicant.examApplications[0];
  const slot = latestExam?.examSlot ?? null;
  const showLink =
    applicant.admissionStage === "EXAM" ||
    applicant.examStatus !== "NOT_SCHEDULED";

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="text-base font-semibold text-(--earist-secondary)">
          Entrance Examination
        </h3>
        {showLink && (
          <ModuleLink href="/admin/exam/applications" label="Open Exam Applications" />
        )}
      </div>

      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <DataRow label="Current state">
          {examSectionState(applicant)}
        </DataRow>
        {slot ? (
          <>
            <DataRow label="Scheduled date">{formatDate(slot.examDate)}</DataRow>
            <DataRow label="Scheduled time">{formatTime(slot.examTime)}</DataRow>
          </>
        ) : null}
      </dl>
    </section>
  );
}

function CorSection({ applicant }: { applicant: AdminApplicantDetail }) {
  const currentCor = applicant.corUploads[0] ?? null;
  const corRecord = currentCor?.corRecord ?? null;
  const showLink =
    applicant.admissionStage === "COR" || applicant.corStatus !== "NONE";

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="text-base font-semibold text-(--earist-secondary)">
          COR / Enrollment
        </h3>
        {showLink && (
          <ModuleLink href="/admin/exam/cor" label="Open COR Validation" />
        )}
      </div>

      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <DataRow label="Current state">
          {corSectionState(applicant)}
        </DataRow>
        {currentCor?.uploadedAt ? (
          <DataRow label="Latest upload">{formatDateTime(currentCor.uploadedAt)}</DataRow>
        ) : null}
        {corRecord?.isVerified ? (
          <>
            {corRecord.registrationNumber ? (
              <DataRow label="Registration no.">
                {corRecord.registrationNumber}
              </DataRow>
            ) : null}
            {corRecord.academicYear ? (
              <DataRow label="Academic year">{corRecord.academicYear}</DataRow>
            ) : null}
            {corRecord.semester ? (
              <DataRow label="Semester">{corRecord.semester}</DataRow>
            ) : null}
          </>
        ) : null}
        {applicant.corStatus === "REJECTED" && currentCor?.rejectionReason ? (
          <div className="sm:col-span-2">
            <DataRow label="Rejection reason">
              {currentCor.rejectionReason}
            </DataRow>
          </div>
        ) : null}
      </dl>
    </section>
  );
}

/* ------------------------------------------------------------------- page */

export default function ApplicantDetailPage() {
  const params = useParams();
  const applicantId = params.id as string;

  const { data, isLoading, isError, error, isFetching, refetch } =
    useQuery<AdminApplicantDetail>({
      queryKey: ["adminApplicantDetail", applicantId],
      queryFn: () => apiClientRequest(`/admin/applicants/${applicantId}`),
      retry: false,
    });

  if (isLoading) {
    return <DetailSkeleton />;
  }

  const statusCode = error instanceof ApiError ? error.statusCode : undefined;
  if (isError && statusCode === 404) {
    return <NotFoundState />;
  }

  if (isError || !data) {
    return <ErrorState onRetry={() => refetch()} retrying={isFetching} />;
  }

  const applicant = data;
  const fullName = `${applicant.firstName} ${applicant.lastName}`;
  const programName = applicant.program?.programName ?? MISSING;
  const programType = applicant.program?.programType ?? null;
  const isDoctoral = programType === "DOCTORAL";

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { label: "Applicants", href: "/admin/users/applicants" },
          { label: fullName },
        ]}
      />

      <PageHeader
        title={fullName}
        description={`${applicant.pinnacleApplicantId || "No Pinnacle ID"} · ${programName}`}
      />

      {/* Current Admission State */}
      <Card>
        <CardContent>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
            <div className="min-w-0 space-y-1">
              <p className="text-xs font-semibold text-(--earist-body-text)">
                Current Admission State
              </p>
              <p className="text-lg font-semibold text-(--earist-primary)">
                {STAGE_LABEL[applicant.admissionStage]}
              </p>
              <p className="text-sm text-(--earist-body-text)">
                {currentStateLabel(applicant)}
              </p>
            </div>
            <div className="sm:shrink-0">
              <AdmissionProgress applicant={applicant} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main record area */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main column — Admission Journey */}
        <div className="space-y-6 lg:col-span-2">
          <SectionCard
            title="Admission Journey"
            description="Where this applicant is across alignment, entrance examination, and COR."
          >
            <div className="space-y-6">
              <AlignmentSection applicant={applicant} />
              <Separator />
              <ExamSection applicant={applicant} />
              <Separator />
              <CorSection applicant={applicant} />
            </div>
          </SectionCard>
        </div>

        {/* Context column */}
        <aside>
          <SectionCard title="Applicant Details">
            <div className="space-y-5">
              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-(--earist-secondary)">
                  Personal Information
                </h3>
                <dl className="grid grid-cols-1 gap-3">
                  <DataRow label="Pinnacle Applicant ID">
                    {applicant.pinnacleApplicantId || MISSING}
                  </DataRow>
                  <DataRow label="Email">{applicant.email || MISSING}</DataRow>
                  <DataRow label="Cellphone">
                    {applicant.cellphone || MISSING}
                  </DataRow>
                  <DataRow label="Date of Birth">
                    {formatDate(applicant.dateOfBirth)}
                  </DataRow>
                  <DataRow label="Registered">
                    {formatDate(applicant.createdAt)}
                  </DataRow>
                </dl>
              </section>

              <Separator />

              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-(--earist-secondary)">
                  Academic Background
                </h3>
                <dl className="grid grid-cols-1 gap-3">
                  <DataRow label="Applying for">{programName}</DataRow>
                  <DataRow label="Program level">
                    {labelFor(PROGRAM_TYPE_LABEL, programType, MISSING)}
                  </DataRow>
                  {isDoctoral ? (
                    <DataRow label="Previous Master's program">
                      {applicant.previousMastersProgram?.programName ?? MISSING}
                    </DataRow>
                  ) : (
                    <DataRow label="Previous academic program">
                      {applicant.undergraduateProgram?.programName ?? MISSING}
                    </DataRow>
                  )}
                </dl>
              </section>
            </div>
          </SectionCard>
        </aside>
      </div>
    </div>
  );
}
