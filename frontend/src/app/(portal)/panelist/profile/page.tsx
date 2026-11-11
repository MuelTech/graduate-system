"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClientRequest } from "@/lib/api.client";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CircleAlert,
  RefreshCw,
  UserCheck,
  User,
  GraduationCap,
  ShieldCheck,
} from "lucide-react";

interface FacultyProfileResponse {
  id: string;
  isExternal: boolean;
  isAvailableAsAdviser: boolean;
  canEvaluateEssays?: boolean;
  highestEducationalAttainment?: string | null;
  officeAffiliation?: string | null;
  specialization?: string | null;
  user?: {
    id: string;
    title?: string | null;
    firstName: string;
    lastName: string;
    suffix?: string | null;
    email: string;
  };
}

function formatFacultyName(user?: FacultyProfileResponse["user"]) {
  if (!user) return "Faculty Member";
  return [user.title, user.firstName, user.lastName, user.suffix]
    .filter(Boolean)
    .join(" ");
}

export default function FacultyProfilePage() {
  const {
    data: profile,
    isLoading,
    isError,
    isFetching,
    refetch,
  } = useQuery<FacultyProfileResponse>({
    queryKey: ["panelistProfile"],
    queryFn: async () =>
      (await apiClientRequest("/panelists/me")) as FacultyProfileResponse,
  });

  const isExternal = profile?.isExternal === true;
  const canEvaluateEssays = profile?.canEvaluateEssays === true;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Profile"
        description="View your faculty profile and assigned academic access."
      />

      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2" aria-busy="true">
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-44" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-4 w-56" />
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-64" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-44" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-5 w-52" />
              <Skeleton className="h-5 w-48" />
            </CardContent>
          </Card>
        </div>
      ) : isError || !profile ? (
        <Card className="max-w-2xl">
          <CardContent className="flex flex-col items-start gap-2 py-6">
            <p className="flex items-center gap-2 text-sm text-gray-500">
              <CircleAlert
                className="h-4 w-4 text-[#e02b20]"
                aria-hidden="true"
              />
              Unable to load your faculty profile.
            </p>
            <button
              type="button"
              onClick={() => void refetch()}
              disabled={isFetching}
              className="inline-flex items-center text-sm font-semibold text-[#e02b20] hover:underline disabled:opacity-60"
            >
              <RefreshCw
                className={cn(
                  "mr-1.5 h-3.5 w-3.5",
                  isFetching && "animate-spin",
                )}
                aria-hidden="true"
              />
              Retry
            </button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Personal & Academic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base font-bold text-[#333333]">
                <User
                  className="h-4 w-4 text-[#e02b20]"
                  aria-hidden="true"
                />
                Faculty Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <p className="text-xs font-medium text-gray-500">Full Name</p>
                <p className="font-semibold text-[#333333]">
                  {formatFacultyName(profile.user)}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">
                  Email Address
                </p>
                <p className="font-medium text-[#333333]">
                  {profile.user?.email || "—"}
                </p>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-medium text-gray-500">
                    Highest Qualification
                  </p>
                  <p className="font-medium text-[#333333]">
                    {profile.highestEducationalAttainment || "Not specified"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500">
                    Specialization
                  </p>
                  <p className="font-medium text-[#333333]">
                    {profile.specialization || "Not specified"}
                  </p>
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">
                  Office / College Affiliation
                </p>
                <p className="font-medium text-[#333333]">
                  {profile.officeAffiliation || "Not specified"}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Classification & Assigned Access */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base font-bold text-[#333333]">
                <ShieldCheck
                  className="h-4 w-4 text-[#e02b20]"
                  aria-hidden="true"
                />
                Classification & Academic Access
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50/70 p-3.5">
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold text-[#333333]">
                    Faculty Classification
                  </p>
                  <p className="text-xs text-gray-500">
                    {isExternal
                      ? "External faculty member invited for defense committees"
                      : "Internal EARIST Graduate School faculty member"}
                  </p>
                </div>
                <Badge
                  className={
                    isExternal
                      ? "bg-purple-50 text-purple-700 border border-purple-200"
                      : "bg-blue-50 text-blue-700 border border-blue-200"
                  }
                >
                  {isExternal ? "External Faculty" : "Internal Faculty"}
                </Badge>
              </div>

              <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50/70 p-3.5">
                <div className="space-y-0.5">
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-[#333333]">
                    <UserCheck className="h-4 w-4 text-[#e02b20]" />
                    Thesis / Dissertation Adviser Eligibility
                  </p>
                  <p className="text-xs text-gray-500">
                    {isExternal
                      ? "External faculty cannot serve as thesis/dissertation advisers."
                      : "Managed by the Graduate School Administrator."}
                  </p>
                </div>
                <Badge
                  className={
                    isExternal
                      ? "bg-gray-100 text-gray-600"
                      : profile.isAvailableAsAdviser
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : "bg-gray-100 text-gray-600"
                  }
                >
                  {isExternal
                    ? "Not Applicable"
                    : profile.isAvailableAsAdviser
                      ? "Available"
                      : "Not Available"}
                </Badge>
              </div>

              <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50/70 p-3.5">
                <div className="space-y-0.5">
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-[#333333]">
                    <GraduationCap className="h-4 w-4 text-[#e02b20]" />
                    Entrance Exam Essay Evaluation
                  </p>
                  <p className="text-xs text-gray-500">
                    {canEvaluateEssays
                      ? "You are authorized to evaluate applicant entrance exam essays."
                      : "Assigned by the Administrator to designated Program Chairs / Evaluators."}
                  </p>
                </div>
                <Badge
                  className={
                    canEvaluateEssays
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : "bg-gray-100 text-gray-600"
                  }
                >
                  {canEvaluateEssays ? "Enabled" : "Not Enabled"}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
