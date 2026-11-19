"use client";

import { useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClientRequest } from "@/lib/api.client";
import { PH_MOBILE_REGEX, toPhilippineMobileValue } from "@/lib/phone";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhMobileInput } from "@/components/ui/ph-mobile-input";
import { toast } from "sonner";
import { Eye, EyeOff, RefreshCw } from "lucide-react";

const MISSING = "—";

interface ApplicantProfileData {
  firstName: string;
  lastName: string;
  email?: string | null;
  cellphone?: string | null;
  applicantId?: string | null;
  program: string;
  programType?: string | null;
  programCode?: string | null;
  currentStep: number;
  examStatus?: string;
  hasPassedExam?: boolean;
  examDate?: string | null;
  examTime?: string | null;
  registeredAt?: string | null;
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

function examStatusLabel(status?: string, hasPassed?: boolean): string {
  if (hasPassed || status === "PASSED") return "Passed";
  switch (status) {
    case "NOT_SCHEDULED":
      return "Ready to schedule";
    case "PENDING":
      return "Scheduled";
    case "APPROVED":
      return "Approved for examination";
    case "TAKEN":
      return "Submitted — awaiting result";
    case "APPEALED":
      return "Appeal under review";
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

function programTypeLabel(type?: string | null): string {
  if (type === "MASTERS") return "Master's";
  if (type === "DOCTORAL") return "Doctoral";
  return type || MISSING;
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

export default function ApplicantProfilePage() {
  const queryClient = useQueryClient();
  const [cellphoneDraft, setCellphoneDraft] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const profileQuery = useQuery<ApplicantProfileData>({
    queryKey: ["applicantProfile"],
    queryFn: () => apiClientRequest("/applicant/profile"),
    retry: false,
  });

  const updatePhoneMutation = useMutation({
    mutationFn: (cellphone: string) =>
      apiClientRequest("/applicant/profile", {
        method: "PATCH",
        body: JSON.stringify({ cellphone }),
      }),
    onSuccess: (res: { message?: string; cellphone?: string | null }) => {
      toast.success(res?.message ?? "Contact number updated.");
      setCellphoneDraft(null);
      queryClient.invalidateQueries({ queryKey: ["applicantProfile"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const changePasswordMutation = useMutation({
    mutationFn: (password: string) =>
      apiClientRequest("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ newPassword: password }),
      }),
    onSuccess: async () => {
      toast.success("Password updated. Please sign in with your new password.");
      await signOut({ callbackUrl: "/login?passwordChanged=true" });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (profileQuery.isLoading) {
    return (
      <div className="space-y-6" aria-busy="true">
        <div className="space-y-2">
          <Skeleton className="h-8 w-44" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <Skeleton className="h-80 w-full rounded-xl" />
          </div>
          <div className="space-y-6 lg:col-span-5">
            <Skeleton className="h-44 w-full rounded-xl" />
            <Skeleton className="h-56 w-full rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (profileQuery.isError || !profileQuery.data) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Profile"
          description="View your applicant information and manage account settings."
        />
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <p className="text-base font-semibold text-[#8b1a1a]">
              Unable to load profile
            </p>
            <p className="max-w-sm text-sm text-gray-500">
              Something went wrong while loading your applicant profile.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => profileQuery.refetch()}
              disabled={profileQuery.isFetching}
            >
              <RefreshCw
                className={cn(
                  "mr-2 h-4 w-4",
                  profileQuery.isFetching && "animate-spin",
                )}
                aria-hidden="true"
              />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const profile = profileQuery.data;
  const fullName = `${profile.firstName} ${profile.lastName}`.trim();
  const currentPhoneNormalized = toPhilippineMobileValue(
    profile.cellphone ?? "",
  );
  const cellphoneValue = cellphoneDraft ?? currentPhoneNormalized;
  const hasPhoneChanged =
    cellphoneDraft !== null && cellphoneDraft !== currentPhoneNormalized;

  const handlePhoneSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!PH_MOBILE_REGEX.test(cellphoneValue)) {
      toast.error(
        "Please enter a valid 10-digit Philippine mobile number starting with 9 (e.g., +63 9171234567).",
      );
      return;
    }
    updatePhoneMutation.mutate(cellphoneValue);
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }
    changePasswordMutation.mutate(newPassword);
  };

  const quickDestination = profile.hasPassedExam
    ? { href: "/applicant/cor-upload", label: "Go to COR Upload" }
    : profile.examStatus === "PENDING" || profile.examStatus === "APPROVED"
      ? { href: "/applicant/exam", label: "Go to Entrance Exam" }
      : { href: "/applicant/schedule", label: "Exam Schedule" };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Profile"
        description="View your registered applicant details, exam standing, and security settings."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Personal & Application Details */}
        <div className="lg:col-span-7">
          <SectionCard
            title="Applicant Information"
            description="Official details registered for your EARIST Graduate School Entrance Examination."
            action={
              <Badge
                variant="outline"
                className={
                  profile.hasPassedExam
                    ? "border-emerald-200 bg-emerald-50 font-medium text-emerald-700"
                    : "border-gray-200 bg-gray-50 font-medium text-[#262220]"
                }
              >
                {examStatusLabel(profile.examStatus, profile.hasPassedExam)}
              </Badge>
            }
          >
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <DataItem label="Full Name">{fullName || MISSING}</DataItem>
              <DataItem label="Applicant ID">
                <span className="font-mono">
                  {profile.applicantId || MISSING}
                </span>
              </DataItem>
              <DataItem label="Email Address">
                <span className="break-all">{profile.email || MISSING}</span>
              </DataItem>
              <DataItem label="Mobile Number">
                {profile.cellphone || MISSING}
              </DataItem>
              <DataItem label="Program Level">
                {programTypeLabel(profile.programType)}
              </DataItem>
              <DataItem label="Date Registered">
                {formatDate(profile.registeredAt)}
              </DataItem>
              <div className="sm:col-span-2">
                <DataItem label="Intended Graduate Program">
                  {profile.program || MISSING}
                </DataItem>
              </div>
            </dl>

            <div className="border-t border-gray-100 pt-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <p className="text-xs font-semibold tracking-wider text-gray-500 uppercase">
                    Entrance Examination Schedule
                  </p>
                  <p className="text-sm font-medium text-[#262220]">
                    {profile.examDate
                      ? `${formatDate(profile.examDate)} · ${formatTime(profile.examTime)}`
                      : "No active schedule selected yet"}
                  </p>
                </div>
                <Link
                  href={quickDestination.href}
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                  )}
                >
                  {quickDestination.label}
                </Link>
              </div>
            </div>

            <div className="rounded-lg border border-[#d4a843]/35 bg-[#FFF8F0] px-4 py-3 text-xs leading-relaxed text-[#4a4a5a]">
              To correct your registered name, email address, Applicant ID, or
              intended program, please contact the EARIST Graduate School
              Office.
            </div>
          </SectionCard>
        </div>

        {/* Right: Contact Update & Password */}
        <div className="space-y-6 lg:col-span-5">
          <SectionCard
            title="Contact Number"
            description="Keep your Philippine mobile number up to date."
          >
            <form onSubmit={handlePhoneSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="applicant-profile-phone"
                  className="block text-xs font-semibold tracking-wider text-gray-600 uppercase"
                >
                  Mobile Number (+63)
                </label>
                <PhMobileInput
                  id="applicant-profile-phone"
                  value={cellphoneValue}
                  onChange={setCellphoneDraft}
                  required
                />
                <p className="text-xs text-gray-500">
                  10 digits starting with 9 (e.g., +63 9171234567).
                </p>
              </div>
              <Button
                type="submit"
                size="sm"
                className="bg-[#e02b20] text-white hover:bg-[#b71c1c]"
                disabled={!hasPhoneChanged || updatePhoneMutation.isPending}
              >
                {updatePhoneMutation.isPending
                  ? "Saving..."
                  : "Save Contact Number"}
              </Button>
            </form>
          </SectionCard>

          <SectionCard
            title="Change Password"
            description="Updating your password signs you out across sessions so you can log in cleanly."
          >
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="applicant-new-password"
                  className="block text-xs font-semibold tracking-wider text-gray-600 uppercase"
                >
                  New Password
                </label>
                <div className="relative">
                  <Input
                    id="applicant-new-password"
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    minLength={6}
                    required
                    className="h-10 pr-10 [&::-ms-clear]:hidden [&::-ms-reveal]:hidden"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                    className="absolute top-1/2 right-3 -translate-y-1/2 text-gray-400 transition-colors hover:text-[#333333]"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="applicant-confirm-password"
                  className="block text-xs font-semibold tracking-wider text-gray-600 uppercase"
                >
                  Confirm New Password
                </label>
                <Input
                  id="applicant-confirm-password"
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  required
                  className="h-10 [&::-ms-clear]:hidden [&::-ms-reveal]:hidden"
                />
              </div>

              <Button
                type="submit"
                size="sm"
                variant="outline"
                disabled={
                  !newPassword ||
                  !confirmPassword ||
                  changePasswordMutation.isPending
                }
              >
                {changePasswordMutation.isPending
                  ? "Updating Password..."
                  : "Update Password"}
              </Button>
            </form>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
