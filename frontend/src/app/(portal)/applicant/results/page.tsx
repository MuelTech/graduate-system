"use client";

import Link from "next/link";
import {
  ResultBreakdown,
  type ExamResult,
} from "@/components/exam-content/result-breakdown";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import {
  CheckCircle2,
  XCircle,
  Mail,
  ExternalLink,
  ArrowRight,
  ArrowLeft,
  Upload,
  ClipboardList,
  AlertTriangle,
} from "lucide-react";
import { apiClientRequest, ApiError } from "@/lib/api.client";

export default function ApplicantResultsPage() {
  const { data: session } = useSession(); // Retrieve session state
  const {
    data: result,
    isLoading,
    error,
  } = useQuery<ExamResult & { examDate: string }>({
    queryKey: ["examResult", session?.user?.id || session?.user?.email], // Ensures cache isolation
    queryFn: async () =>
      apiClientRequest("/exam/result", { method: "GET", cache: "no-store" }),
  });

  if (isLoading) {
    return (
      <div className="p-8 text-center text-(--earist-primary)">
        Loading your results...
      </div>
    );
  }
  const isFinalResult =
    result?.status === "passed" || result?.status === "failed";
  if (error || !isFinalResult) {
    const isExpectedEmptyState =
      !error ||
      (error instanceof ApiError &&
        (error.statusCode === 404 || error.statusCode === 409));
    const errorMsg = isExpectedEmptyState
      ? error?.message ||
        "Your examination result is not yet available. It may still be awaiting evaluation."
      : "We could not load your examination results. Please try again later.";

    return (
      <div className="space-y-6">
        {/* Page Header (preserved for consistency) */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#333333]">
            Examination Results
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            View your entrance examination results
          </p>
        </div>

        <div className="rounded-xl border border-gray-100 bg-white p-8 text-center shadow-sm">
          <div
            className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full ${
              isExpectedEmptyState
                ? "bg-[#e02b20]/10"
                : "bg-red-50 text-red-600"
            }`}
          >
            {isExpectedEmptyState ? (
              <ClipboardList className="h-8 w-8 text-[#e02b20]" />
            ) : (
              <AlertTriangle className="h-8 w-8" />
            )}
          </div>
          <h3 className="mb-2 text-lg font-bold text-[#333333]">
            {isExpectedEmptyState
              ? "Results Not Available"
              : "Error Loading Results"}
          </h3>
          <p className="mb-4 text-sm text-gray-600">{errorMsg}</p>
          {isExpectedEmptyState && (
            <Link
              href="/applicant/dashboard"
              className="inline-flex items-center gap-1 text-sm font-semibold text-[#e02b20] transition-colors hover:underline"
            >
              <ArrowLeft className="h-4 w-4" /> Back to Dashboard
            </Link>
          )}
        </div>
      </div>
    );
  }
  const reconsidered = result.effectiveStatus === "passed_reconsidered" && result.institutionalDecision?.decision === "PASSED_RECONSIDERED";
  const effectivePass = result.status === "passed" || reconsidered;
  const formattedDate = new Date(result.examDate).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[#333333]">
          Examination Results
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Exam taken on {formattedDate}
        </p>
      </div>

      {/* Result Header — Pass/Fail Badge */}
      <Card>
        <CardContent className="py-6">
          <div className="flex flex-col items-center text-center">
            {reconsidered ? (
              <><Badge className="mb-2 bg-green-100 px-4 py-1 text-base text-green-700">PASSED — RECONSIDERED</Badge><p className="text-sm">The original computed examination result remains FAILED. A separate institutional reconsideration decision grants a pass for admission.</p><p className="text-sm">Decision: {new Date(result.institutionalDecision!.decidedAt).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}</p></>
            ) : result.status === "passed" ? (
              <>
                <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-green-50">
                  <CheckCircle2 className="h-10 w-10 text-green-600" />
                </div>
                <Badge className="mb-2 bg-green-100 px-4 py-1 text-base text-green-700">
                  PASSED
                </Badge>
                <p className="text-sm text-gray-600">
                  Congratulations! You have passed the entrance examination.
                </p>
              </>
            ) : result.status === "failed" ? (
              <>
                <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
                  <XCircle className="h-10 w-10 text-red-600" />
                </div>
                <Badge className="mb-2 bg-red-100 px-4 py-1 text-base text-red-700">
                  FAILED
                </Badge>
                <p className="text-sm text-gray-600">
                  You did not meet the passing score for this examination.
                </p>
              </>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {/* Score Breakdown Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-bold text-[#333333]">
            Score Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResultBreakdown result={result!} />
        </CardContent>
      </Card>

      {/* Pass Path — Instructions */}
      {effectivePass && (
        <Card>
          <CardContent className="py-4">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <p className="mb-2 text-sm font-semibold text-amber-800">
                Congratulations! Next Steps:
              </p>
              <ol className="mb-4 list-decimal space-y-1 pl-5 text-sm text-amber-700">
                <li>Proceed to Pinnacle to complete your enrollment.</li>
                <li>
                  Download your Certificate of Registration (COR) from Pinnacle.
                </li>
                <li>Upload your COR to this portal for Admin verification.</li>
              </ol>
              <div className="flex flex-wrap gap-2">
                <a
                  href="https://earistweb.pinnacle.com.ph/aims/students/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-700"
                >
                  Go to Pinnacle
                  <ExternalLink className="h-3 w-3" />
                </a>
                <Link
                  href="/applicant/cor-upload"
                  className="inline-flex items-center gap-1 rounded-lg bg-[#e02b20] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#c62828]"
                >
                  <Upload className="mr-1 h-3 w-3" />
                  Upload COR
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Fail Path — Re-application Info */}
      {result.status === "failed" && !reconsidered && (
        <Card>
          <CardContent className="py-4">
            <div className="rounded-lg border border-gray-100 bg-gray-50/70 p-4">
              <p className="mb-2 text-sm font-semibold text-[#333333]">
                Re-application Information
              </p>
              <p className="mb-3 text-sm text-gray-600">
                You may re-apply for the entrance examination per institutional
                policy. Please contact the Graduate School Office for guidance
                on the re-application process.
              </p>
              <Link
                href="/applicant/dashboard"
                className="inline-flex items-center gap-1 text-sm font-semibold text-[#e02b20] transition-colors hover:underline"
              >
                Back to Dashboard <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Email Notice */}
      <div className="flex items-start gap-2 rounded-lg border border-gray-100 bg-white p-3.5 shadow-xs">
        <Mail className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
        <p className="text-xs text-gray-500">
          Result notifications use your registered email address.
        </p>
      </div>
    </div>
  );
}
