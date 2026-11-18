"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClientRequest } from "@/lib/api.client";
import { compExamStatusLabel } from "@/lib/student-dashboard";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { SignatureVaultCard } from "@/components/profile/signature-vault-card";
import {
  CircleAlert,
  GraduationCap,
  Mail,
  Phone,
  RefreshCw,
  User,
  UserCheck,
} from "lucide-react";

interface PersonSummary {
  id: string;
  email?: string | null;
  title?: string | null;
  firstName: string;
  lastName: string;
  suffix?: string | null;
}

interface StudentProfileResponse {
  id: string;
  studentNumber?: string | null;
  pinnacleApplicantId?: string | null;
  cellphone?: string | null;
  admissionStatus?: string | null;
  curriculumType?: string | null;
  enrollmentDate?: string | null;
  residencyStartDate?: string | null;
  corExtractedYearLevel?: string | null;
  corExtractedScholarship?: string | null;
  user?: PersonSummary;
  program?: {
    programName: string;
    programType: "MASTERS" | "DOCTORAL" | string;
    department?: string | null;
    maxResidencyYears?: number | null;
  } | null;
  residencyTracking?: {
    startDate?: string | null;
    maxYears?: number | null;
  } | null;
  compExamRecords?: Array<{
    status?: string | null;
  }>;
  adviserAssignments?: Array<{
    adviser?: PersonSummary | null;
  }>;
  thesisRecords?: Array<{
    assignment?: {
      adviser?: PersonSummary | null;
    } | null;
  }>;
}

function formatPersonName(person?: PersonSummary | null, fallback = "—"): string {
  if (!person) return fallback;
  const formatted = [
    person.title,
    person.firstName,
    person.lastName,
    person.suffix,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();
  return formatted || fallback;
}

function formatDateValue(raw?: string | null): string {
  if (!raw) return "Not recorded";
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return "Not recorded";
  return parsed.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function admissionStatusBadge(status?: string | null) {
  switch (String(status ?? "").toUpperCase()) {
    case "ENROLLED":
      return {
        label: "Enrolled",
        className: "border border-emerald-200 bg-emerald-50 text-emerald-700",
      };
    case "GRADUATED":
      return {
        label: "Graduated",
        className: "border border-blue-200 bg-blue-50 text-blue-700",
      };
    case "DISMISSED":
      return {
        label: "Dismissed",
        className: "border border-red-200 bg-red-50 text-red-700",
      };
    default:
      return {
        label: status || "Applicant",
        className: "border border-amber-200 bg-amber-50 text-amber-700",
      };
  }
}

export default function StudentProfilePage() {
  const {
    data: profile,
    isLoading,
    isError,
    isFetching,
    refetch,
  } = useQuery<StudentProfileResponse>({
    queryKey: ["student", "journey-overview"],
    queryFn: async () =>
      (await apiClientRequest("/student/journey")) as StudentProfileResponse,
  });

  const activeAdviser =
    profile?.adviserAssignments?.[0]?.adviser ??
    profile?.thesisRecords?.[0]?.assignment?.adviser ??
    null;

  const compExamStatus = profile?.compExamRecords?.[0]?.status ?? null;
  const admissionBadge = admissionStatusBadge(profile?.admissionStatus);

  const residencyStart =
    profile?.residencyTracking?.startDate ??
    profile?.residencyStartDate ??
    profile?.enrollmentDate ??
    null;
  const maxResidencyYears =
    profile?.residencyTracking?.maxYears ??
    profile?.program?.maxResidencyYears ??
    null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Profile"
        description="View your student information, enrollment details, and official e-signature vault."
      />

      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2" aria-busy="true">
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-48" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-4 w-60" />
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-52" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-48" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-4 w-64" />
              <Skeleton className="h-4 w-44" />
              <Skeleton className="h-4 w-56" />
            </CardContent>
          </Card>
        </div>
      ) : isError || !profile ? (
        <Card className="max-w-2xl">
          <CardContent className="flex flex-col items-start gap-3 py-6">
            <p className="flex items-center gap-2 text-sm text-gray-600">
              <CircleAlert
                className="h-4 w-4 text-[#e02b20]"
                aria-hidden="true"
              />
              Unable to load your student profile.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isFetching}
              onClick={() => void refetch()}
            >
              <RefreshCw
                className={cn("mr-1.5 h-3.5 w-3.5", isFetching && "animate-spin")}
                aria-hidden="true"
              />
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Personal & Contact Information */}
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-base font-bold text-[#333333]">
                <User className="h-4 w-4 text-[#e02b20]" aria-hidden="true" />
                Personal &amp; Contact Information
              </CardTitle>
              {profile.studentNumber && (
                <Badge className="border border-gray-200 bg-gray-100 text-[#333333]">
                  {profile.studentNumber}
                </Badge>
              )}
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <p className="text-xs font-medium text-gray-500">Full Name</p>
                <p className="font-semibold text-[#333333]">
                  {formatPersonName(profile.user, "Student")}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-medium text-gray-500">
                    Student Number
                  </p>
                  <p className="font-medium text-[#333333]">
                    {profile.studentNumber || "Pending assignment"}
                  </p>
                </div>
                {profile.pinnacleApplicantId && (
                  <div>
                    <p className="text-xs font-medium text-gray-500">
                      Applicant Reference ID
                    </p>
                    <p className="font-medium text-[#333333]">
                      {profile.pinnacleApplicantId}
                    </p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <p className="flex items-center gap-1 text-xs font-medium text-gray-500">
                    <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                    Email Address
                  </p>
                  <p className="break-all font-medium text-[#333333]">
                    {profile.user?.email || "—"}
                  </p>
                </div>
                <div>
                  <p className="flex items-center gap-1 text-xs font-medium text-gray-500">
                    <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                    Mobile Number
                  </p>
                  <p className="font-medium text-[#333333]">
                    {profile.cellphone || "Not specified"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Academic & Enrollment Profile */}
          <Card>
            <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-base font-bold text-[#333333]">
                <GraduationCap
                  className="h-4 w-4 text-[#e02b20]"
                  aria-hidden="true"
                />
                Academic &amp; Enrollment Profile
              </CardTitle>
              <div className="flex flex-wrap gap-1.5">
                <Badge className={admissionBadge.className}>
                  {admissionBadge.label}
                </Badge>
                {profile.curriculumType && (
                  <Badge variant="outline">
                    {profile.curriculumType === "NEW"
                      ? "New Curriculum"
                      : "Old Curriculum"}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <p className="text-xs font-medium text-gray-500">
                  Graduate Program
                </p>
                <p className="font-semibold text-[#333333]">
                  {profile.program?.programName || "Not specified"}
                </p>
                {(profile.program?.programType ||
                  profile.program?.department) && (
                  <p className="text-xs text-gray-500">
                    {profile.program?.programType === "DOCTORAL"
                      ? "Doctoral Program"
                      : "Master's Program"}
                    {profile.program?.department
                      ? ` · ${profile.program.department}`
                      : ""}
                  </p>
                )}
              </div>

              {(profile.corExtractedYearLevel ||
                profile.corExtractedScholarship) && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {profile.corExtractedYearLevel && (
                    <div>
                      <p className="text-xs font-medium text-gray-500">
                        COR Year Level
                      </p>
                      <p className="font-medium text-[#333333]">
                        {profile.corExtractedYearLevel}
                      </p>
                    </div>
                  )}
                  {profile.corExtractedScholarship && (
                    <div>
                      <p className="text-xs font-medium text-gray-500">
                        Scholarship (from COR)
                      </p>
                      <p className="font-medium text-[#333333]">
                        {profile.corExtractedScholarship}
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 rounded-xl border border-gray-100 bg-gray-50/70 p-3.5 sm:grid-cols-2">
                <div>
                  <p className="flex items-center gap-1 text-xs font-medium text-gray-500">
                    <UserCheck
                      className="h-3.5 w-3.5 text-[#e02b20]"
                      aria-hidden="true"
                    />
                    Thesis / Dissertation Adviser
                  </p>
                  <p className="mt-0.5 font-semibold text-[#333333]">
                    {activeAdviser
                      ? formatPersonName(activeAdviser)
                      : "Not yet assigned"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500">
                    Comprehensive Examination
                  </p>
                  <p className="mt-0.5 font-semibold text-[#333333]">
                    {compExamStatusLabel(compExamStatus)}
                  </p>
                </div>
              </div>

              {(residencyStart || maxResidencyYears) && (
                <p className="text-xs text-gray-500">
                  {residencyStart
                    ? `Enrollment / Residency Start: ${formatDateValue(residencyStart)}`
                    : ""}
                  {residencyStart && maxResidencyYears ? " · " : ""}
                  {maxResidencyYears
                    ? `Maximum Residency: ${maxResidencyYears} years`
                    : ""}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <SignatureVaultCard />
    </div>
  );
}
