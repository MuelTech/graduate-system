"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useStudentThesisJourney } from "@/hooks/use-student-thesis-journey";
import {
  journeyRouteFor,
  journeyStepFor,
} from "@/lib/student-thesis-journey";
import {
  ThesisJourneyShell,
  JourneyStepStatusCard,
} from "@/components/student/thesis-journey-shell";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Info,
  Clock,
  ShieldCheck,
  FileCheck,
  FileText,
  RefreshCw,
  ExternalLink,
  AlertTriangle,
} from "lucide-react";
import { apiClientRequest } from "@/lib/api.client";

interface PlagiarismStatusPayload {
  hasThesis: boolean;
  thesisId?: string;
  stage?: string;
  status?: string;
  result?: {
    id: string;
    similarityPercentage: number;
    isEligible: boolean;
    filePath: string;
    submittedAt: string;
  } | null;
  currentManuscript?: {
    id: string;
    title: string | null;
    filename: string | null;
    uploadedAt: string;
  } | null;
}

export default function StudentStrikePage() {
  const {
    data: journey,
    isLoading: journeyLoading,
    isError: journeyError,
    refetch: refetchJourney,
    refreshStatus,
  } = useStudentThesisJourney();

  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fetch live StrikePlagiarism status from backend
  const {
    data: plagiarismData,
    isLoading: statusLoading,
    refetch: refetchPlagiarism,
  } = useQuery<PlagiarismStatusPayload>({
    queryKey: ["plagiarism", "my-status"],
    queryFn: async () => {
      const res = await apiClientRequest("/thesis/plagiarism/my-status");
      return res as PlagiarismStatusPayload;
    },
    refetchOnWindowFocus: true,
  });

  const strike = journeyStepFor(journey, "STRIKE");
  const strikeRequired = journey?.policy?.strikeRequired === true;
  const strikeCompleted = strike?.state === "COMPLETED";
  const finalStep = journeyStepFor(journey, "FINAL_DEFENSE");

  const thesisId = plagiarismData?.thesisId;
  const manuscript = plagiarismData?.currentManuscript;
  const result = plagiarismData?.result;

  const handleSubmitCheck = async () => {
    if (!thesisId) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const res: any = await apiClientRequest(`/thesis/plagiarism/${thesisId}/submit`, {
        method: "POST",
      });
      if (res?.documentId) {
        setActiveDocumentId(res.documentId);
      }
      await refetchPlagiarism();
      await refreshStatus();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to submit manuscript to StrikePlagiarism.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSyncResult = async () => {
    if (!thesisId || !activeDocumentId) return;
    setIsSyncing(true);
    setErrorMessage(null);
    try {
      await apiClientRequest(`/thesis/plagiarism/${thesisId}/sync/${activeDocumentId}`, {
        method: "POST",
      });
      await refetchPlagiarism();
      await refreshStatus();
    } catch (err: any) {
      setErrorMessage(err.message || "Analysis is still in progress or could not be synced.");
    } finally {
      setIsSyncing(false);
    }
  };

  if (journeyLoading || statusLoading) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-(--earist-primary)">
          STRIKE / Plagiarism
        </h2>
        <p className="text-sm text-(--earist-body-text)">Loading status…</p>
      </div>
    );
  }

  if (journeyError || !journey) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-(--earist-primary)">
          STRIKE / Plagiarism
        </h2>
        <Card>
          <CardContent className="space-y-3 pt-6">
            <p className="text-sm text-red-600">
              Unable to load STRIKE / plagiarism status.
            </p>
            <Button type="button" variant="outline" size="sm" onClick={() => refetchJourney()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <ThesisJourneyShell
      activeStep="STRIKE"
      title="STRIKE / Plagiarism"
      description="Automated manuscript plagiarism & AI similarity verification powered by StrikePlagiarism.com."
      journey={journey}
    >
      {strike?.state === "LOCKED" && (
        <JourneyStepStatusCard
          variant="locked"
          title="STRIKE / Plagiarism is Locked"
          badgeText="Locked"
          description={strike.lockReason || "This step is currently unavailable."}
          nextStepHref="/student/thesis"
          nextStepLabel="Back to Thesis Journey"
        />
      )}

      {strike && strike.state !== "LOCKED" && !strikeRequired && (
        <Card>
          <CardHeader className="border-b border-gray-100 pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-base font-bold text-[#333333]">
                <Info className="h-4 w-4 text-[#e02b20]" />
                Plagiarism Check Not Required
              </CardTitle>
              <Badge variant="outline">Not required</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 pt-4 text-sm text-[#333333]">
            <p className="text-gray-600">
              STRIKE / plagiarism checking is not required for your current
              workflow.
            </p>
            {strike.detail && (
              <p className="text-xs text-gray-500">{strike.detail}</p>
            )}
            {(finalStep?.state === "CURRENT" ||
              finalStep?.state === "AVAILABLE" ||
              finalStep?.state === "WAITING" ||
              finalStep?.state === "COMPLETED") && (
              <div>
                <Link
                  href={journeyRouteFor("FINAL_DEFENSE")}
                  className={buttonVariants()}
                >
                  Continue to Final Defense
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {strike && strike.state !== "LOCKED" && strikeRequired && (
        <div className="space-y-6">
          {/* Status Overview Card */}
          {strikeCompleted || result?.isEligible ? (
            <Card className="border-emerald-200 bg-emerald-50/30">
              <CardHeader className="border-b border-emerald-100 pb-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-emerald-600" />
                    <div>
                      <CardTitle className="text-base font-bold text-emerald-900">
                        STRIKE Plagiarism Clearance Verified
                      </CardTitle>
                      <CardDescription className="text-xs text-emerald-700">
                        Institutional similarity threshold requirement passed (&lt; 20.0%)
                      </CardDescription>
                    </div>
                  </div>
                  <Badge className="bg-emerald-600 text-white">Eligible</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                {result && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="rounded-md border border-emerald-200 bg-white p-3">
                      <div className="text-xs text-gray-500">Similarity Index</div>
                      <div className="text-2xl font-bold text-emerald-600">
                        {result.similarityPercentage}%
                      </div>
                      <div className="text-xs text-gray-400">Institutional limit: 20%</div>
                    </div>
                    <div className="rounded-md border border-emerald-200 bg-white p-3">
                      <div className="text-xs text-gray-500">Result Status</div>
                      <div className="text-sm font-semibold text-emerald-700 mt-1">
                        PASSED & CLEARED
                      </div>
                      <div className="text-xs text-gray-400">Recorded for Final Defense</div>
                    </div>
                    <div className="rounded-md border border-emerald-200 bg-white p-3">
                      <div className="text-xs text-gray-500">Checked On</div>
                      <div className="text-sm font-medium text-gray-700 mt-1">
                        {new Date(result.submittedAt).toLocaleDateString()}
                      </div>
                      <div className="text-xs text-gray-400">Powered by StrikePlagiarism</div>
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  {result?.id && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(`/api/documents/plagiarism-result/${result.id}`, "_blank")}
                      className="gap-2 border-emerald-300 text-emerald-800 hover:bg-emerald-50"
                    >
                      <FileText className="h-4 w-4" />
                      View Official STRIKE Similarity Report
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  )}

                  {finalStep && (
                    <Link
                      href={journeyRouteFor("FINAL_DEFENSE")}
                      className={buttonVariants({ className: "bg-emerald-700 hover:bg-emerald-800" })}
                    >
                      Continue to Final Defense
                    </Link>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="border-b border-gray-100 pb-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-amber-500" />
                    <div>
                      <CardTitle className="text-base font-bold text-[#333333]">
                        Plagiarism Verification Pending
                      </CardTitle>
                      <CardDescription className="text-xs text-gray-500">
                        Manuscript must be submitted to StrikePlagiarism with score below 20.0%
                      </CardDescription>
                    </div>
                  </div>
                  <Badge className="border-amber-200 bg-amber-50 text-amber-700">
                    Action Required
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pt-4 text-sm text-[#333333]">
                {errorMessage && (
                  <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
                    <div>{errorMessage}</div>
                  </div>
                )}

                {/* Current Manuscript Info */}
                {manuscript ? (
                  <div className="rounded-lg border border-gray-100 bg-gray-50/70 p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-semibold text-gray-700">
                        <FileCheck className="h-4 w-4 text-(--earist-primary)" />
                        Current Manuscript Ready for Verification
                      </div>
                      <span className="text-[11px] text-gray-400">
                        Uploaded {new Date(manuscript.uploadedAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="text-sm font-bold text-gray-800">
                      {manuscript.title || "Thesis Manuscript"}
                    </div>
                    <div className="text-xs text-gray-500">
                      File: {manuscript.filename || "manuscript.pdf"}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 text-xs text-amber-800">
                    No active manuscript document was found. Please ensure you have uploaded your thesis manuscript under Proposal/Final Defense documents.
                  </div>
                )}

                {/* Verification Actions */}
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <Button
                    type="button"
                    disabled={!manuscript || isSubmitting}
                    onClick={handleSubmitCheck}
                    className="gap-2 bg-(--earist-primary) hover:bg-[#800000]"
                  >
                    <ShieldCheck className="h-4 w-4" />
                    {isSubmitting ? "Submitting to StrikePlagiarism…" : "Run STRIKE Plagiarism Check"}
                  </Button>

                  {activeDocumentId && (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={isSyncing}
                      onClick={handleSyncResult}
                      className="gap-2"
                    >
                      <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
                      {isSyncing ? "Checking Report…" : "Check Analysis Status"}
                    </Button>
                  )}
                </div>

                <div className="text-xs text-gray-500 border-t border-gray-100 pt-3 space-y-1">
                  <p>• Automated verification analyzes internet sources, global academic repositories, and AI-generated content.</p>
                  <p>• Institutional guideline: Overall similarity index must be strictly less than 20.0% to qualify for Final Defense application.</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </ThesisJourneyShell>
  );
}
