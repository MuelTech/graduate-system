"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClientRequest, ApiError } from "@/lib/api.client";
import { PH_MOBILE_REGEX, toPhilippineMobileValue } from "@/lib/phone";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import type {
  AdminApplicantDetail,
  AdminApplicantStage,
  ExamApplicationDetail,
} from "@/types";
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

const STAGE_LABEL: Record<AdminApplicantStage, string> = {
  EXAM: "Entrance Examination",
  COR: "COR / Enrollment",
};

const PROGRAM_TYPE_LABEL: Record<string, string> = {
  MASTERS: "Master's",
  DOCTORAL: "Doctoral",
};

function examStateLabel(status: string): string {
  switch (status) {
    case "NOT_SCHEDULED":
      return "Ready to schedule";
    case "PENDING":
      return "Exam scheduled";
    case "APPROVED":
      return "Approved for exam";
    case "TAKEN":
      return "Awaiting grading";
    case "APPEALED":
      return "Appeal under review";
    case "PASSED":
      return "Passed";
    case "FAILED":
      return "Failed";
    case "DISQUALIFIED":
      return "Disqualified";
    case "MISSED":
      return "Missed schedule";
    case "CANCELLED":
      return "Schedule cancelled";
    default:
      return "In progress";
  }
}

function corStateLabel(status: string, hasPassedExam: boolean): string {
  if (!hasPassedExam) return "Available after passing exam";
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
      return "In progress";
  }
}

function examBadgeTone(status: string, hasPassedExam: boolean): string {
  if (hasPassedExam || status === "PASSED") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (status === "FAILED" || status === "DISQUALIFIED") {
    return "border-red-200 bg-red-50 text-red-700";
  }
  if (status === "TAKEN" || status === "APPEALED") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }
  return "border-gray-200 bg-gray-50 text-[#333333]";
}

function corBadgeTone(status: string, hasPassedExam: boolean): string {
  if (!hasPassedExam) return "border-gray-200 bg-gray-50 text-gray-500";
  if (status === "VERIFIED") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (status === "REJECTED") {
    return "border-red-200 bg-red-50 text-red-700";
  }
  if (status === "PENDING") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }
  return "border-gray-200 bg-gray-50 text-[#333333]";
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

function DetailSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <Skeleton className="h-4 w-48" />
      <div className="space-y-2">
        <Skeleton className="h-8 w-64 max-w-full" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <Skeleton className="h-24 w-full rounded-xl" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
        <div className="space-y-6 lg:col-span-5">
          <Skeleton className="h-64 w-full rounded-xl" />
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
          { label: "Applicants", href: "/admin/users/applicants" },
          { label: "Applicant Profile" },
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

export default function ApplicantDetailPage() {
  const params = useParams();
  const router = useRouter();
  const applicantId = params.id as string;
  const queryClient = useQueryClient();

  const [editOpen, setEditOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [toggleActiveOpen, setToggleActiveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [formError, setFormError] = useState("");
  const [formState, setFormState] = useState({
    firstName: "",
    lastName: "",
    pinnacleApplicantId: "",
    email: "",
    cellphone: "",
    programId: "",
  });

  const detailQuery = useQuery<AdminApplicantDetail>({
    queryKey: ["adminApplicantDetail", applicantId],
    queryFn: () => apiClientRequest(`/admin/applicants/${applicantId}`),
    retry: false,
  });

  const programsQuery = useQuery<{ graduatePrograms: ProgramOption[] }>({
    queryKey: ["graduateProgramsPublic"],
    queryFn: () => apiClientRequest("/programs"),
    staleTime: 5 * 60 * 1000,
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({
      queryKey: ["adminApplicantDetail", applicantId],
    });
    queryClient.invalidateQueries({ queryKey: ["adminApplicants"] });
  };

  const updateMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiClientRequest(`/admin/applicants/${applicantId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      invalidateAll();
    },
    onError: (err: Error) => {
      setFormError(err.message);
      toast.error(err.message);
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: () =>
      apiClientRequest(`/admin/applicants/${applicantId}/reset-password`, {
        method: "POST",
      }),
    onSuccess: (res: { message?: string }) => {
      toast.success(res?.message ?? "Applicant password reset.");
      setResetOpen(false);
      invalidateAll();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: () =>
      apiClientRequest(`/admin/applicants/${applicantId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      toast.success("Applicant account deleted.");
      queryClient.invalidateQueries({ queryKey: ["adminApplicants"] });
      router.replace("/admin/users/applicants");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (detailQuery.isLoading) {
    return <DetailSkeleton />;
  }

  const statusCode =
    detailQuery.error instanceof ApiError
      ? detailQuery.error.statusCode
      : undefined;

  if (detailQuery.isError && statusCode === 404) {
    return (
      <StateFrame>
        <p className="text-base font-semibold text-[#8b1a1a]">
          Applicant not found
        </p>
        <p className="max-w-sm text-sm text-gray-500">
          This applicant record does not exist or may have been deleted.
        </p>
        <Link
          href="/admin/users/applicants"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          Back to Applicants
        </Link>
      </StateFrame>
    );
  }

  if (detailQuery.isError || !detailQuery.data) {
    return (
      <StateFrame>
        <p className="text-base font-semibold text-[#8b1a1a]">
          Unable to load applicant
        </p>
        <p className="max-w-sm text-sm text-gray-500">
          Something went wrong while loading this applicant record. Please try
          again.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => detailQuery.refetch()}
            disabled={detailQuery.isFetching}
          >
            <RefreshCw
              className={cn(
                "mr-2 h-4 w-4",
                detailQuery.isFetching && "animate-spin",
              )}
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

  const applicant = detailQuery.data;
  const fullName = `${applicant.firstName} ${applicant.lastName}`.trim();
  const programName = applicant.program?.programName ?? MISSING;
  const programType = applicant.program?.programType ?? null;
  const isActive = applicant.isActive ?? true;
  const canChangeProgram = applicant.canChangeProgram ?? false;
  const canDelete = applicant.canDelete ?? false;
  const latestExam: ExamApplicationDetail | undefined =
    applicant.examApplications[0];
  const examSlot = latestExam?.examSlot ?? null;
  const currentCor = applicant.corUploads[0] ?? null;
  const corRecord = currentCor?.corRecord ?? null;

  const programs = programsQuery.data?.graduatePrograms ?? [];
  const selectedEditProgram = programs.find(
    (p) => p.id === formState.programId,
  );

  const openEditDialog = () => {
    setFormError("");
    setFormState({
      firstName: applicant.firstName,
      lastName: applicant.lastName,
      pinnacleApplicantId: applicant.pinnacleApplicantId,
      email: applicant.email,
      cellphone: toPhilippineMobileValue(applicant.cellphone ?? ""),
      programId: applicant.program?.id ?? "",
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
    if (!formState.pinnacleApplicantId.trim()) {
      return setFormError("Applicant ID is required.");
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formState.email.trim())) {
      return setFormError("Please enter a valid email address.");
    }
    if (!PH_MOBILE_REGEX.test(formState.cellphone.trim())) {
      return setFormError(
        "Please enter a valid 10-digit Philippine mobile number starting with 9 (e.g., +63 9171234567).",
      );
    }

    const payload: Record<string, unknown> = {
      firstName: formState.firstName.trim(),
      lastName: formState.lastName.trim(),
      pinnacleApplicantId: formState.pinnacleApplicantId.trim(),
      email: formState.email.trim(),
      cellphone: formState.cellphone.trim(),
    };
    if (canChangeProgram && formState.programId) {
      payload.programId = formState.programId;
    }

    updateMutation.mutate(payload, {
      onSuccess: () => {
        toast.success("Applicant details updated.");
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
              ? "Applicant account activated."
              : "Applicant account deactivated.",
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
          { label: "Applicants", href: "/admin/users/applicants" },
          { label: fullName || "Applicant Profile" },
        ]}
      />

      <PageHeader
        title={fullName}
        description={`${applicant.pinnacleApplicantId || "No Applicant ID"} · ${programName}`}
        actions={
          <Button variant="outline" size="sm" onClick={openEditDialog}>
            Edit Details
          </Button>
        }
      />

      {/* Executive Summary Bar */}
      <Card className="border-gray-200/80 border-t-4 border-t-[#8b1a1a] shadow-xs">
        <CardContent className="p-0">
          <div className="grid grid-cols-1 divide-y divide-gray-100 sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
            <div className="space-y-1.5 p-4 sm:p-5">
              <p className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
                Admission Stage
              </p>
              <p className="text-sm font-semibold text-[#262220]">
                {STAGE_LABEL[applicant.admissionStage]}
              </p>
            </div>
            <div className="space-y-1.5 p-4 sm:p-5">
              <p className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
                Entrance Examination
              </p>
              <Badge
                variant="outline"
                className={cn(
                  "font-medium",
                  examBadgeTone(applicant.examStatus, applicant.hasPassedExam),
                )}
              >
                {applicant.hasPassedExam
                  ? "Passed"
                  : examStateLabel(applicant.examStatus)}
              </Badge>
            </div>
            <div className="space-y-1.5 p-4 sm:p-5">
              <p className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
                COR Verification
              </p>
              <Badge
                variant="outline"
                className={cn(
                  "font-medium",
                  corBadgeTone(applicant.corStatus, applicant.hasPassedExam),
                )}
              >
                {corStateLabel(applicant.corStatus, applicant.hasPassedExam)}
              </Badge>
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
                {applicant.mustChangePassword && (
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
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Applicant Details & Account Controls */}
        <div className="space-y-6 lg:col-span-5">
          <SectionCard title="Applicant Information">
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <DataItem label="Full Name">{fullName || MISSING}</DataItem>
              <DataItem label="Applicant ID">
                <span className="font-mono">
                  {applicant.pinnacleApplicantId || MISSING}
                </span>
              </DataItem>
              <DataItem label="Email Address">
                <span className="break-all">{applicant.email || MISSING}</span>
              </DataItem>
              <DataItem label="Mobile Number">
                {applicant.cellphone || MISSING}
              </DataItem>
              <DataItem label="Date Registered">
                {formatDate(applicant.createdAt)}
              </DataItem>
              <DataItem label="Program Level">
                {programType ? (PROGRAM_TYPE_LABEL[programType] ?? programType) : MISSING}
              </DataItem>
              <div className="sm:col-span-2">
                <DataItem label="Intended Program">{programName}</DataItem>
              </div>
            </dl>
          </SectionCard>

          <SectionCard
            title="Account Access & Recovery"
            description="Manage portal sign-in access and temporary password resets."
          >
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50/70 p-3.5">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium text-[#262220]">
                    Portal Sign-In Access
                  </p>
                  <p className="text-xs text-gray-500">
                    {isActive
                      ? "Applicant can currently sign in to the portal."
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
                    Resets password to LAST NAME in ALL CAPS; requires change on
                    next login. Email dispatch is deferred.
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
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-sm font-medium text-[#262220]">
                      Remove Applicant Account
                    </p>
                    <p className="text-xs leading-relaxed text-gray-500">
                      {canDelete
                        ? "Allowed only before an entrance examination attempt or verified COR exists. Any unstarted slot booking will be released."
                        : applicant.deleteBlockedReason ||
                          "This applicant already has examination or COR records and cannot be deleted."}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    disabled={!canDelete || deleteMutation.isPending}
                    onClick={() => setDeleteOpen(true)}
                  >
                    Delete Applicant
                  </Button>
                </div>
              </div>
            </div>
          </SectionCard>
        </div>

        {/* Right: Admission Progress & Records */}
        <div className="lg:col-span-7">
          <SectionCard
            title="Admission Progress & Records"
            description="Current status across the online Entrance Examination and COR verification."
          >
            <div className="space-y-6">
              {/* Step 1: Entrance Exam */}
              <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3">
                  <div>
                    <p className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
                      Step 1
                    </p>
                    <h3 className="text-sm font-semibold text-[#262220]">
                      Entrance Examination
                    </h3>
                  </div>
                  {(applicant.admissionStage === "EXAM" ||
                    applicant.examStatus !== "NOT_SCHEDULED") && (
                    <Link
                      href="/admin/exam/applications"
                      className={cn(
                        buttonVariants({ variant: "outline", size: "sm" }),
                      )}
                    >
                      Open Examinee Records
                    </Link>
                  )}
                </div>

                <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <DataItem label="Exam Status">
                    {applicant.hasPassedExam
                      ? "Passed"
                      : examStateLabel(applicant.examStatus)}
                  </DataItem>
                  <DataItem label="Scheduled Date">
                    {examSlot ? formatDate(examSlot.examDate) : MISSING}
                  </DataItem>
                  <DataItem label="Scheduled Time">
                    {examSlot ? formatTime(examSlot.examTime) : MISSING}
                  </DataItem>
                </dl>
              </div>

              {/* Step 2: COR Verification */}
              <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3">
                  <div>
                    <p className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
                      Step 2
                    </p>
                    <h3 className="text-sm font-semibold text-[#262220]">
                      COR Verification &amp; Promotion
                    </h3>
                  </div>
                  {(applicant.admissionStage === "COR" ||
                    applicant.corStatus !== "NONE") && (
                    <Link
                      href="/admin/exam/cor"
                      className={cn(
                        buttonVariants({ variant: "outline", size: "sm" }),
                      )}
                    >
                      Open COR Verification
                    </Link>
                  )}
                </div>

                <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <DataItem label="COR State">
                    {corStateLabel(applicant.corStatus, applicant.hasPassedExam)}
                  </DataItem>
                  <DataItem label="Latest Upload">
                    {currentCor?.uploadedAt
                      ? formatDateTime(currentCor.uploadedAt)
                      : MISSING}
                  </DataItem>
                  {corRecord?.isVerified && (
                    <>
                      <DataItem label="Registration No.">
                        {corRecord.registrationNumber || MISSING}
                      </DataItem>
                      <DataItem label="Academic Term">
                        {[corRecord.academicYear, corRecord.semester]
                          .filter(Boolean)
                          .join(" · ") || MISSING}
                      </DataItem>
                    </>
                  )}
                  {applicant.corStatus === "REJECTED" &&
                    currentCor?.rejectionReason && (
                      <div className="sm:col-span-2">
                        <DataItem label="Rejection Reason">
                          {currentCor.rejectionReason}
                        </DataItem>
                      </div>
                    )}
                </dl>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>

      {/* Edit Applicant Details Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Applicant Details</DialogTitle>
            <DialogDescription>
              Update applicant identity, contact information, and program
              selection. Changes are recorded in the audit log.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEditSubmit} className="space-y-4">
            {formError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {formError}
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label
                  htmlFor="edit-first-name"
                  className="block text-xs font-semibold tracking-wider text-gray-600 uppercase"
                >
                  First Name *
                </label>
                <Input
                  id="edit-first-name"
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
                  htmlFor="edit-last-name"
                  className="block text-xs font-semibold tracking-wider text-gray-600 uppercase"
                >
                  Last Name *
                </label>
                <Input
                  id="edit-last-name"
                  value={formState.lastName}
                  onChange={(e) =>
                    setFormState((s) => ({ ...s, lastName: e.target.value }))
                  }
                  className="h-10"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="edit-applicant-id"
                className="block text-xs font-semibold tracking-wider text-gray-600 uppercase"
              >
                Applicant ID *
              </label>
              <Input
                id="edit-applicant-id"
                value={formState.pinnacleApplicantId}
                onChange={(e) =>
                  setFormState((s) => ({
                    ...s,
                    pinnacleApplicantId: e.target.value,
                  }))
                }
                className="h-10"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="edit-email"
                className="block text-xs font-semibold tracking-wider text-gray-600 uppercase"
              >
                Email Address *
              </label>
              <Input
                id="edit-email"
                type="email"
                value={formState.email}
                onChange={(e) =>
                  setFormState((s) => ({ ...s, email: e.target.value }))
                }
                className="h-10"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="edit-cellphone"
                className="block text-xs font-semibold tracking-wider text-gray-600 uppercase"
              >
                Mobile Number (+63) *
              </label>
              <PhMobileInput
                id="edit-cellphone"
                value={formState.cellphone}
                onChange={(v) =>
                  setFormState((s) => ({ ...s, cellphone: v }))
                }
                required
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="edit-program"
                className="block text-xs font-semibold tracking-wider text-gray-600 uppercase"
              >
                Intended Program *
              </label>
              <Select
                value={formState.programId || null}
                disabled={!canChangeProgram || programsQuery.isLoading}
                onValueChange={(value) =>
                  setFormState((s) => ({ ...s, programId: value ?? "" }))
                }
              >
                <SelectTrigger
                  id="edit-program"
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
                  Intended program cannot be changed once an entrance examination
                  booking or record exists.
                </p>
              )}
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
                ? "Deactivate applicant account?"
                : "Reactivate applicant account?"}
            </DialogTitle>
            <DialogDescription>
              {isActive
                ? "The applicant will no longer be able to sign in until an administrator reactivates this account. Existing examination records remain preserved."
                : "This restores portal sign-in access for this applicant."}
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

      {/* Reset Password Confirmation */}
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset applicant password?</DialogTitle>
            <DialogDescription>
              This sets a temporary password equal to{" "}
              <strong className="text-[#262220]">
                {applicant.lastName.trim().toUpperCase()}
              </strong>{" "}
              (LAST NAME in ALL CAPS) and requires the applicant to choose a new
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

      {/* Delete Applicant Confirmation */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete applicant account?</DialogTitle>
            <DialogDescription>
              Permanently remove{" "}
              <strong className="text-[#262220]">{fullName}</strong> (
              {applicant.pinnacleApplicantId || applicant.email}). Any pending
              unstarted exam slot reservation will be released automatically.
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              Cancel
            </DialogClose>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending || !canDelete}
              onClick={() => deleteMutation.mutate()}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete Permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
