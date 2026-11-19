"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClientRequest, ApiError } from "@/lib/api.client";
import { PH_MOBILE_REGEX, toPhilippineMobileValue } from "@/lib/phone";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PhMobileInput } from "@/components/ui/ph-mobile-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
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
import { RefreshCw } from "lucide-react";

const MISSING = "—";

interface ProgramOption {
  id: string;
  programName: string;
  programType: string;
}

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

function toDateInputValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

const ADMISSION_STATUS_LABEL: Record<string, string> = {
  ENROLLED: "Enrolled",
  GRADUATED: "Graduated",
  DISMISSED: "Dismissed",
};

const ADMISSION_STATUS_TONE: Record<string, string> = {
  ENROLLED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  GRADUATED: "border-blue-200 bg-blue-50 text-blue-700",
  DISMISSED: "border-red-200 bg-red-50 text-red-700",
};

const COMP_EXAM_LABEL: Record<string, string> = {
  PENDING: "Pending",
  PASSED: "Passed",
  FAILED: "Failed",
};

const COMP_EXAM_TONE: Record<string, string> = {
  PASSED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  FAILED: "border-red-200 bg-red-50 text-red-700",
  PENDING: "border-amber-200 bg-amber-50 text-amber-800",
};

const JOURNEY_STATE_LABEL: Record<string, string> = {
  COMPLETED: "Completed",
  CURRENT: "Current",
  AVAILABLE: "Available",
  WAITING: "Waiting",
  LOCKED: "Locked",
};

const JOURNEY_STATE_TONE: Record<string, string> = {
  COMPLETED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  CURRENT: "border-[#8b1a1a]/30 bg-[#8b1a1a]/5 text-[#8b1a1a]",
  AVAILABLE: "border-sky-200 bg-sky-50 text-sky-700",
  WAITING: "border-amber-200 bg-amber-50 text-amber-800",
  LOCKED: "border-gray-200 bg-gray-50 text-gray-500",
};

const JOURNEY_MARKER_TONE: Record<string, string> = {
  COMPLETED: "bg-emerald-600 text-white",
  CURRENT: "bg-[#e02b20] text-white",
  AVAILABLE: "bg-sky-600 text-white",
  WAITING: "bg-amber-500 text-white",
  LOCKED: "bg-gray-200 text-gray-500",
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

function curriculumLabel(type: string | null | undefined): string {
  if (type === "NEW") return "New Curriculum";
  if (type === "OLD") return "Old Curriculum";
  return MISSING;
}

/* -------------------------------------------------------------- layout parts */

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
    <Card className="border-gray-200/80 shadow-xs">
      <CardContent className="space-y-5 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 pb-4">
          <div className="min-w-0 space-y-1">
            <h2 className="text-base font-semibold text-[#262220]">{title}</h2>
            {description ? (
              <p className="text-xs text-gray-500">{description}</p>
            ) : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

function DataItem({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0 space-y-1">
      <dt className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
        {label}
      </dt>
      <dd className="text-sm font-medium break-words text-[#262220]">
        {children}
      </dd>
    </div>
  );
}

function JourneyStepRow({
  step,
  index,
}: {
  step: JourneyStepView;
  index: number;
}) {
  const kind = defenseKindForStep(step.key);
  const session = step.defenseSession;
  const showBlocker = step.state === "LOCKED" && Boolean(step.lockReason);

  return (
    <li className="flex items-start gap-3.5">
      <span
        className={cn(
          "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
          JOURNEY_MARKER_TONE[step.state] ?? "bg-gray-200 text-gray-600",
        )}
      >
        {step.state === "COMPLETED" ? "✓" : index + 1}
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-[#262220]">
            {journeyLabelFor(step.key, step.label)}
          </p>
          <Badge
            variant="outline"
            className={cn(
              "font-medium",
              JOURNEY_STATE_TONE[step.state] ?? "border-gray-200 text-gray-600",
            )}
          >
            {JOURNEY_STATE_LABEL[step.state] ?? step.state}
          </Badge>
        </div>

        {showBlocker ? (
          <p className="text-xs text-amber-800">{step.lockReason}</p>
        ) : step.detail ? (
          <p className="text-sm break-words text-gray-600">{step.detail}</p>
        ) : null}

        {step.defenseStatus ? (
          <p className="text-xs text-gray-500">
            {defenseStatusHeading(step.defenseStatus, "Defense status")} —{" "}
            {defenseStatusDescription(step.defenseStatus, kind, null)}
          </p>
        ) : null}

        {session ? (
          <p className="text-xs text-gray-500">
            {session.sessionStatus
              ? `${sessionStatusLabel(session.sessionStatus)} · `
              : ""}
            {formatDefenseDate(session.defenseDate)} ·{" "}
            {formatDefenseTime(session.defenseTime)}
            {session.venueOrLink ? ` · ${session.venueOrLink}` : ""}
          </p>
        ) : null}

        {step.nextAction && step.state !== "COMPLETED" ? (
          <p className="text-xs text-gray-500">Next: {step.nextAction}</p>
        ) : null}
      </div>
    </li>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <Skeleton className="h-4 w-56" />
      <div className="space-y-2">
        <Skeleton className="h-8 w-64 max-w-full" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <Skeleton className="h-24 w-full rounded-xl" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-7">
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
        <div className="space-y-6 lg:col-span-5">
          <Skeleton className="h-44 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
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

/* -------------------------------------------------------------------- page */

export default function StudentDetailPage() {
  const params = useParams();
  const studentId = params.id as string;
  const queryClient = useQueryClient();

  const [compExamAction, setCompExamAction] = useState<
    "PASSED" | "FAILED" | null
  >(null);
  const [editOpen, setEditOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [toggleActiveOpen, setToggleActiveOpen] = useState(false);
  const [formError, setFormError] = useState("");
  const [formState, setFormState] = useState({
    firstName: "",
    lastName: "",
    suffix: "",
    studentNumber: "",
    email: "",
    cellphone: "",
    programId: "",
    curriculumType: "NONE" as "NONE" | "NEW" | "OLD",
    enrollmentDate: "",
    residencyStartDate: "",
    reason: "",
  });

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

  const programsQuery = useQuery<{ graduatePrograms: ProgramOption[] }>({
    queryKey: ["graduateProgramsPublic"],
    queryFn: () => apiClientRequest("/programs"),
    staleTime: 5 * 60 * 1000,
  });

  const invalidateStudent = () => {
    queryClient.invalidateQueries({
      queryKey: ["adminStudentDetail", studentId],
    });
    queryClient.invalidateQueries({
      queryKey: ["adminStudentJourney", studentId],
    });
    queryClient.invalidateQueries({ queryKey: ["adminStudents"] });
  };

  const markCompExamMutation = useMutation({
    mutationFn: (status: "PASSED" | "FAILED") =>
      apiClientRequest(`/admin/students/${studentId}/comprehensive-exam`, {
        method: "PUT",
        body: JSON.stringify({ status }),
      }),
    onSuccess: (data: { message?: string }) => {
      toast.success(data?.message ?? "Comprehensive exam status updated.");
      setCompExamAction(null);
      invalidateStudent();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiClientRequest(`/admin/students/${studentId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      invalidateStudent();
    },
    onError: (error: Error) => {
      setFormError(error.message);
      toast.error(error.message);
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: () =>
      apiClientRequest(`/admin/students/${studentId}/reset-password`, {
        method: "POST",
      }),
    onSuccess: (res: { message?: string }) => {
      toast.success(res?.message ?? "Student password reset.");
      setResetOpen(false);
      invalidateStudent();
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
    return (
      <StateFrame>
        <p className="text-base font-semibold text-[#8b1a1a]">
          Student not found
        </p>
        <p className="max-w-sm text-sm text-gray-500">
          This student record does not exist or is no longer available.
        </p>
        <Link
          href="/admin/users/students"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          Back to Students
        </Link>
      </StateFrame>
    );
  }

  if (studentQuery.isError || !studentQuery.data) {
    return (
      <StateFrame>
        <p className="text-base font-semibold text-[#8b1a1a]">
          Unable to load student
        </p>
        <p className="max-w-sm text-sm text-gray-500">
          Something went wrong while loading this student record. Please try
          again.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => studentQuery.refetch()}
            disabled={studentQuery.isFetching}
          >
            <RefreshCw
              className={cn(
                "mr-2 h-4 w-4",
                studentQuery.isFetching && "animate-spin",
              )}
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

  const student = studentQuery.data;
  const fullName = [student.firstName, student.lastName, student.suffix]
    .filter(Boolean)
    .join(" ")
    .trim();
  const programName = student.program?.programName ?? MISSING;
  const isActive = student.isActive ?? true;
  const canChangeProgram = student.canChangeProgram ?? false;
  const journey = journeyQuery.data;
  const currentStep =
    journey?.steps.find((step) => step.key === journey.currentStep) ?? null;

  const canRecordCompExam = student.admissionStatus === "ENROLLED";
  const programs = programsQuery.data?.graduatePrograms ?? [];
  const selectedEditProgram = programs.find(
    (p) => p.id === formState.programId,
  );

  const summaryNext =
    currentStep?.state === "LOCKED"
      ? currentStep.lockReason
      : (currentStep?.nextAction ?? null);

  const openEditDialog = () => {
    setFormError("");
    setFormState({
      firstName: student.firstName,
      lastName: student.lastName,
      suffix: student.suffix ?? "",
      studentNumber: student.studentNumber ?? "",
      email: student.email,
      cellphone: toPhilippineMobileValue(student.cellphone ?? ""),
      programId: student.program?.id ?? "",
      curriculumType:
        student.curriculumType === "NEW" || student.curriculumType === "OLD"
          ? student.curriculumType
          : "NONE",
      enrollmentDate: toDateInputValue(student.enrollmentDate),
      residencyStartDate: toDateInputValue(student.residency?.startDate),
      reason: "",
    });
    setEditOpen(true);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!formState.firstName.trim()) {
      return setFormError("First name is required.");
    }
    if (!formState.lastName.trim()) {
      return setFormError("Last name is required.");
    }
    if (!formState.studentNumber.trim()) {
      return setFormError("Student number is required.");
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formState.email.trim())) {
      return setFormError("Please enter a valid email address.");
    }
    if (!PH_MOBILE_REGEX.test(formState.cellphone.trim())) {
      return setFormError(
        "Please enter a valid 10-digit Philippine mobile number starting with 9 (e.g., +63 9171234567).",
      );
    }
    if (formState.reason.trim().length < 3) {
      return setFormError(
        "Please provide a brief correction reason for the audit log.",
      );
    }

    const payload: Record<string, unknown> = {
      firstName: formState.firstName.trim(),
      lastName: formState.lastName.trim(),
      suffix: formState.suffix.trim() || null,
      studentNumber: formState.studentNumber.trim(),
      email: formState.email.trim(),
      cellphone: formState.cellphone.trim(),
      curriculumType:
        formState.curriculumType === "NONE" ? null : formState.curriculumType,
      enrollmentDate: formState.enrollmentDate || null,
      residencyStartDate: formState.residencyStartDate || null,
      reason: formState.reason.trim(),
    };
    if (canChangeProgram && formState.programId) {
      payload.programId = formState.programId;
    }

    updateMutation.mutate(payload, {
      onSuccess: () => {
        toast.success("Student record updated.");
        setEditOpen(false);
      },
    });
  };

  const handleToggleActive = () => {
    updateMutation.mutate(
      { isActive: !isActive },
      {
        onSuccess: () => {
          toast.success(
            !isActive
              ? "Student portal access reactivated."
              : "Student portal access deactivated.",
          );
          setToggleActiveOpen(false);
        },
      },
    );
  };

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { label: "Students", href: "/admin/users/students" },
          { label: fullName || "Student Profile" },
        ]}
      />

      <PageHeader
        title={fullName || "Student"}
        description={`${student.studentNumber ?? "No student number"} · ${programName}`}
        actions={
          <Button variant="outline" size="sm" onClick={openEditDialog}>
            Edit Information
          </Button>
        }
      />

      {/* Executive Summary Bar */}
      <Card className="border-gray-200/80 border-t-4 border-t-[#8b1a1a] shadow-xs">
        <CardContent className="p-0">
          <div className="grid grid-cols-1 divide-y divide-gray-100 sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
            <div className="space-y-1.5 p-4 sm:p-5">
              <p className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
                Student Status
              </p>
              <Badge
                variant="outline"
                className={cn(
                  "font-medium",
                  ADMISSION_STATUS_TONE[student.admissionStatus] ??
                    "border-gray-200 text-gray-700",
                )}
              >
                {admissionStatusLabel(student.admissionStatus)}
              </Badge>
            </div>
            <div className="space-y-1.5 p-4 sm:p-5">
              <p className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
                Comprehensive Exam
              </p>
              {student.compExam ? (
                <Badge
                  variant="outline"
                  className={cn(
                    "font-medium",
                    COMP_EXAM_TONE[student.compExam.status] ??
                      "border-gray-200 text-gray-700",
                  )}
                >
                  {compExamLabel(student.compExam.status)}
                </Badge>
              ) : (
                <p className="text-sm font-medium text-gray-500">
                  Not recorded
                </p>
              )}
            </div>
            <div className="space-y-1.5 p-4 sm:p-5">
              <p className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
                Thesis Stage
              </p>
              <p className="text-sm font-semibold text-[#262220]">
                {journeyQuery.isLoading
                  ? "Loading..."
                  : currentStep
                    ? `${journeyLabelFor(currentStep.key, currentStep.label)} · ${JOURNEY_STATE_LABEL[currentStep.state] ?? currentStep.state}`
                    : journeyQuery.isError
                      ? "Unavailable"
                      : MISSING}
              </p>
            </div>
            <div className="space-y-1.5 p-4 sm:p-5">
              <p className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
                Portal Access
              </p>
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge
                  variant="outline"
                  className={
                    isActive
                      ? "border-emerald-200 bg-emerald-50 font-medium text-emerald-700"
                      : "border-red-200 bg-red-50 font-medium text-red-700"
                  }
                >
                  {isActive ? "Active" : "Inactive"}
                </Badge>
                {student.mustChangePassword && (
                  <Badge
                    variant="outline"
                    className="border-amber-200 bg-amber-50 font-medium text-amber-800"
                  >
                    Password reset pending
                  </Badge>
                )}
              </div>
            </div>
          </div>
          {summaryNext ? (
            <div className="border-t border-gray-100 bg-gray-50/50 px-5 py-2.5 text-xs text-gray-600">
              <span className="font-semibold text-[#262220]">
                {currentStep?.state === "LOCKED" ? "Blocked: " : "Next Step: "}
              </span>
              {summaryNext}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Student Information + Academic Journey */}
        <div className="space-y-6 lg:col-span-7">
          <SectionCard
            title="Student & Academic Information"
            description="Official identity, enrollment record, and residency standing."
          >
            <div className="space-y-6">
              <div>
                <h3 className="mb-3 text-xs font-semibold tracking-wider text-[#8b1a1a] uppercase">
                  Personal &amp; Contact
                </h3>
                <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <DataItem label="Full Name">{fullName || MISSING}</DataItem>
                  <DataItem label="Student Number">
                    <span className="font-mono">
                      {student.studentNumber ?? MISSING}
                    </span>
                  </DataItem>
                  <DataItem label="Applicant Reference ID">
                    <span className="font-mono">
                      {student.pinnacleApplicantId ?? "Not recorded (Pre-GSIS)"}
                    </span>
                  </DataItem>
                  <DataItem label="Mobile Number">
                    {student.cellphone ?? MISSING}
                  </DataItem>
                  <div className="sm:col-span-2">
                    <DataItem label="Email Address">
                      <span className="break-all">
                        {student.email || MISSING}
                      </span>
                    </DataItem>
                  </div>
                </dl>
              </div>

              <div className="border-t border-gray-100 pt-5">
                <h3 className="mb-3 text-xs font-semibold tracking-wider text-[#8b1a1a] uppercase">
                  Academic &amp; Residency
                </h3>
                <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <DataItem label="Official Program">{programName}</DataItem>
                  </div>
                  <DataItem label="Enrollment Date">
                    {formatDate(student.enrollmentDate)}
                  </DataItem>
                  <DataItem label="Curriculum Type">
                    {curriculumLabel(student.curriculumType)}
                  </DataItem>
                  <DataItem label="Active Adviser">
                    {student.adviserAssignment
                      ? student.adviserAssignment.adviserName
                      : "Not assigned"}
                  </DataItem>
                  <DataItem label="Maximum Residency">
                    {student.residency?.maxYears != null
                      ? `${student.residency.maxYears} years`
                      : MISSING}
                  </DataItem>
                  <DataItem label="Residency Start Date">
                    {student.residency?.startDate
                      ? formatDate(student.residency.startDate)
                      : MISSING}
                  </DataItem>
                  {student.adviserAssignment?.assignedDate ? (
                    <DataItem label="Adviser Assigned On">
                      {formatDate(student.adviserAssignment.assignedDate)}
                    </DataItem>
                  ) : null}
                </dl>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Academic Journey"
            description="Authoritative thesis and defense progression."
            action={
              <Link
                href="/admin/thesis/defense-records"
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                )}
              >
                Defense Records
              </Link>
            }
          >
            {journeyQuery.isLoading ? (
              <ul className="space-y-4" aria-busy="true">
                {Array.from({ length: 4 }).map((_, index) => (
                  <li key={index} className="flex gap-3">
                    <Skeleton className="h-6 w-6 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-3 w-64 max-w-full" />
                    </div>
                  </li>
                ))}
              </ul>
            ) : journeyQuery.isError ? (
              <div className="flex flex-col items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-6 py-8 text-center">
                <p className="text-sm font-semibold text-[#8b1a1a]">
                  Academic journey unavailable
                </p>
                <p className="max-w-sm text-xs text-gray-500">
                  Student details loaded, but the thesis journey could not be
                  retrieved.
                </p>
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
              <ol className="space-y-4">
                {journey.steps.map((step, index) => (
                  <JourneyStepRow key={step.key} step={step} index={index} />
                ))}
              </ol>
            ) : (
              <p className="text-sm text-gray-500">
                No thesis journey is available for this student yet.
              </p>
            )}
          </SectionCard>
        </div>

        {/* Right: Comprehensive Exam + Account Access */}
        <div className="space-y-6 lg:col-span-5">
          <SectionCard
            title="Comprehensive Examination"
            description="Record or update formal comprehensive examination standing."
          >
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <DataItem label="Current Standing">
                {student.compExam
                  ? compExamLabel(student.compExam.status)
                  : "Not recorded"}
              </DataItem>
              {student.compExam?.recordedAt ? (
                <DataItem label="Recorded Date">
                  {formatDate(student.compExam.recordedAt)}
                </DataItem>
              ) : null}
            </dl>

            {canRecordCompExam ? (
              <div className="flex flex-wrap gap-2 pt-1">
                <Button
                  size="sm"
                  className="bg-emerald-600 text-white hover:bg-emerald-700"
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
              <p className="text-xs text-gray-500">
                Examination recording is available for enrolled students only.
              </p>
            )}
          </SectionCard>

          <SectionCard
            title="Account Access & Security"
            description="Manage portal access and temporary credential recovery."
          >
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50/70 p-3.5">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium text-[#262220]">
                    Portal Sign-In Access
                  </p>
                  <p className="text-xs text-gray-500">
                    {isActive
                      ? "Student can currently sign in to the portal."
                      : "Account is deactivated and sign-in is blocked."}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setToggleActiveOpen(true)}
                  disabled={updateMutation.isPending}
                >
                  {isActive ? "Deactivate" : "Reactivate"}
                </Button>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50/70 p-3.5">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium text-[#262220]">
                    Temporary Password Reset
                  </p>
                  <p className="text-xs text-gray-500">
                    Resets password to LAST NAME in ALL CAPS and enforces password
                    change on next sign-in. Email dispatch is deferred.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setResetOpen(true)}
                  disabled={resetPasswordMutation.isPending}
                >
                  Reset Password
                </Button>
              </div>

              <div className="rounded-lg border border-gray-200/80 bg-white p-3.5">
                <p className="text-xs font-medium text-[#262220]">
                  Protected Academic Record
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-gray-500">
                  Enrolled student accounts cannot be deleted so official
                  defense records, COR verifications, and audit logs remain
                  intact. Use Deactivate above to suspend login access.
                </p>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>

      {/* Edit Student Information Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit Student Information</DialogTitle>
            <DialogDescription>
              Correct student identity, contact details, or academic metadata.
              All edits are recorded in the audit log with your reason.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEditSubmit} className="space-y-4">
            {formError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {formError}
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <label
                  htmlFor="stu-first-name"
                  className="block text-xs font-semibold tracking-wider text-gray-600 uppercase"
                >
                  First Name *
                </label>
                <Input
                  id="stu-first-name"
                  value={formState.firstName}
                  onChange={(e) =>
                    setFormState((s) => ({ ...s, firstName: e.target.value }))
                  }
                  className="h-10"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label
                  htmlFor="stu-last-name"
                  className="block text-xs font-semibold tracking-wider text-gray-600 uppercase"
                >
                  Last Name *
                </label>
                <Input
                  id="stu-last-name"
                  value={formState.lastName}
                  onChange={(e) =>
                    setFormState((s) => ({ ...s, lastName: e.target.value }))
                  }
                  className="h-10"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label
                  htmlFor="stu-suffix"
                  className="block text-xs font-semibold tracking-wider text-gray-600 uppercase"
                >
                  Suffix
                </label>
                <Input
                  id="stu-suffix"
                  placeholder="Jr., III"
                  value={formState.suffix}
                  onChange={(e) =>
                    setFormState((s) => ({ ...s, suffix: e.target.value }))
                  }
                  className="h-10"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label
                  htmlFor="stu-number"
                  className="block text-xs font-semibold tracking-wider text-gray-600 uppercase"
                >
                  Student Number *
                </label>
                <Input
                  id="stu-number"
                  value={formState.studentNumber}
                  onChange={(e) =>
                    setFormState((s) => ({
                      ...s,
                      studentNumber: e.target.value,
                    }))
                  }
                  className="h-10 font-mono"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label
                  htmlFor="stu-email"
                  className="block text-xs font-semibold tracking-wider text-gray-600 uppercase"
                >
                  Email Address *
                </label>
                <Input
                  id="stu-email"
                  type="email"
                  value={formState.email}
                  onChange={(e) =>
                    setFormState((s) => ({ ...s, email: e.target.value }))
                  }
                  className="h-10"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="stu-cellphone"
                className="block text-xs font-semibold tracking-wider text-gray-600 uppercase"
              >
                Mobile Number (+63) *
              </label>
              <PhMobileInput
                id="stu-cellphone"
                value={formState.cellphone}
                onChange={(v) => setFormState((s) => ({ ...s, cellphone: v }))}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="stu-program"
                className="block text-xs font-semibold tracking-wider text-gray-600 uppercase"
              >
                Graduate Program *
              </label>
              <Select
                value={formState.programId || null}
                disabled={!canChangeProgram || programsQuery.isLoading}
                onValueChange={(value) =>
                  setFormState((s) => ({ ...s, programId: value ?? "" }))
                }
              >
                <SelectTrigger
                  id="stu-program"
                  className="w-full py-2.5 text-left whitespace-normal data-[size=default]:h-auto data-[size=default]:min-h-10"
                >
                  <span className="flex-1 leading-snug text-[#262220]">
                    {selectedEditProgram
                      ? selectedEditProgram.programName
                      : programName}
                  </span>
                </SelectTrigger>
                <SelectContent
                  alignItemWithTrigger={false}
                  className="max-h-72 w-(--anchor-width)"
                >
                  {programs.map((p) => (
                    <SelectItem
                      key={p.id}
                      value={p.id}
                      className="items-start py-2 [&>*:first-child]:shrink [&>*:first-child]:whitespace-normal [&>*:first-child]:leading-snug [&>div]:shrink [&>div]:whitespace-normal [&>div]:leading-snug"
                    >
                      {p.programName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!canChangeProgram && (
                <p className="text-xs text-gray-500">
                  Program changes are locked once Title Defense is completed or
                  the student is no longer enrolled (Manual §7.14.3).
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <label
                  htmlFor="stu-curriculum"
                  className="block text-xs font-semibold tracking-wider text-gray-600 uppercase"
                >
                  Curriculum Type
                </label>
                <Select
                  value={formState.curriculumType}
                  onValueChange={(value) =>
                    setFormState((s) => ({
                      ...s,
                      curriculumType: (value as "NONE" | "NEW" | "OLD") ?? "NONE",
                    }))
                  }
                >
                  <SelectTrigger
                    id="stu-curriculum"
                    className="w-full data-[size=default]:h-10"
                  >
                    <span className="flex-1 text-left text-[#262220]">
                      {formState.curriculumType === "NEW"
                        ? "New Curriculum"
                        : formState.curriculumType === "OLD"
                          ? "Old Curriculum"
                          : "Not specified"}
                    </span>
                  </SelectTrigger>
                  <SelectContent
                    alignItemWithTrigger={false}
                    className="w-(--anchor-width)"
                  >
                    <SelectItem value="NONE">Not specified</SelectItem>
                    <SelectItem value="NEW">New Curriculum</SelectItem>
                    <SelectItem value="OLD">Old Curriculum</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label
                  htmlFor="stu-enrollment-date"
                  className="block text-xs font-semibold tracking-wider text-gray-600 uppercase"
                >
                  Enrollment Date
                </label>
                <Input
                  id="stu-enrollment-date"
                  type="date"
                  value={formState.enrollmentDate}
                  onChange={(e) =>
                    setFormState((s) => ({
                      ...s,
                      enrollmentDate: e.target.value,
                    }))
                  }
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5">
                <label
                  htmlFor="stu-residency-start"
                  className="block text-xs font-semibold tracking-wider text-gray-600 uppercase"
                >
                  Residency Start
                </label>
                <Input
                  id="stu-residency-start"
                  type="date"
                  value={formState.residencyStartDate}
                  onChange={(e) =>
                    setFormState((s) => ({
                      ...s,
                      residencyStartDate: e.target.value,
                    }))
                  }
                  className="h-10"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="stu-reason"
                className="block text-xs font-semibold tracking-wider text-gray-600 uppercase"
              >
                Reason for Correction *
              </label>
              <Textarea
                id="stu-reason"
                rows={2}
                placeholder="e.g., Corrected spelling of last name per COR / Registrar record"
                value={formState.reason}
                onChange={(e) =>
                  setFormState((s) => ({ ...s, reason: e.target.value }))
                }
                required
              />
            </div>

            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" />}>
                Cancel
              </DialogClose>
              <Button
                type="submit"
                className="bg-[#e02b20] text-white hover:bg-[#b71c1c]"
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Activate / Deactivate Confirmation */}
      <Dialog open={toggleActiveOpen} onOpenChange={setToggleActiveOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {isActive
                ? "Deactivate student portal access?"
                : "Reactivate student portal access?"}
            </DialogTitle>
            <DialogDescription>
              {isActive
                ? "The student will no longer be able to sign in until reactivated. Academic, thesis, and defense history remains preserved."
                : "This restores portal sign-in access for this student."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              Cancel
            </DialogClose>
            <Button
              variant={isActive ? "destructive" : "default"}
              onClick={handleToggleActive}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending
                ? "Updating..."
                : isActive
                  ? "Deactivate"
                  : "Reactivate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Student Password Confirmation */}
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset student password?</DialogTitle>
            <DialogDescription>
              This sets a temporary password equal to{" "}
              <strong className="text-[#262220]">
                {student.lastName.trim().toUpperCase()}
              </strong>{" "}
              (LAST NAME in ALL CAPS) and requires the student to set a new
              password on next sign-in. Automated email delivery is deferred until
              Email Integration is enabled.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              Cancel
            </DialogClose>
            <Button
              className="bg-[#e02b20] text-white hover:bg-[#b71c1c]"
              disabled={resetPasswordMutation.isPending}
              onClick={() => resetPasswordMutation.mutate()}
            >
              {resetPasswordMutation.isPending
                ? "Resetting..."
                : "Confirm Password Reset"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
