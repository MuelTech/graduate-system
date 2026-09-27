"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClientRequest, ApiError } from "@/lib/api.client";
import { studentThesisJourneyQueryKey } from "@/lib/student-thesis-journey";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2, Clock, FileText, Send, Upload } from "lucide-react";

type FinalReviewStatus =
  | "NONE"
  | "AWAITING_REVIEW"
  | "CHANGES_REQUESTED"
  | "ISSUED";

type FinalAdviserReview = {
  thesisId: string | null;
  reviewStatus: FinalReviewStatus;
  reviewRemarks: string | null;
  manuscript: { documentId: string; uploadedAt: string | null } | null;
  certification: {
    issued: boolean;
    adviserName: string | null;
    signedAt: string | null;
  } | null;
  strikeRequired: boolean;
  strikeEligible: boolean;
  proposalStageComplete: boolean;
};

const reviewQueryKey = ["student", "final-adviser-review"] as const;

function statusLabel(status: FinalReviewStatus): string {
  switch (status) {
    case "AWAITING_REVIEW":
      return "Final manuscript awaiting Adviser review";
    case "CHANGES_REQUESTED":
      return "Changes requested by Adviser";
    case "ISSUED":
      return "Final Adviser Certification issued";
    default:
      return "Ready to upload Final manuscript";
  }
}

export function FinalAdviserReviewPanel() {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const prevStatusRef = useRef<FinalReviewStatus | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: reviewQueryKey,
    queryFn: async () =>
      (await apiClientRequest("/thesis/final-adviser-review")) as FinalAdviserReview,
    refetchInterval: (q) => {
      const st = (q.state.data as FinalAdviserReview | undefined)?.reviewStatus;
      return st === "AWAITING_REVIEW" || st === "CHANGES_REQUESTED" ? 30_000 : false;
    },
    refetchOnWindowFocus: true,
  });

  const currentStatus = data?.reviewStatus ?? null;
  useEffect(() => {
    const prev = prevStatusRef.current;
    if (prev === currentStatus) return;
    prevStatusRef.current = currentStatus;
    if (currentStatus === "ISSUED" && prev !== null && prev !== "ISSUED") {
      void queryClient.invalidateQueries({
        queryKey: ["thesisEligibility", "FINAL_DEFENSE"],
      });
      void queryClient.invalidateQueries({
        queryKey: studentThesisJourneyQueryKey,
      });
    }
  }, [currentStatus, queryClient]);

  const submitManuscript = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      formData.append("document", file!);
      return apiClientRequest("/thesis/final-adviser-review/manuscript", {
        method: "POST",
        body: formData,
      });
    },
    onSuccess: async () => {
      setError(null);
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      await queryClient.invalidateQueries({ queryKey: reviewQueryKey });
      await queryClient.invalidateQueries({
        queryKey: studentThesisJourneyQueryKey,
      });
    },
    onError: (e: Error) => {
      const extra =
        e instanceof ApiError && e.missing?.length
          ? ` ${e.missing.map((m) => m.message).join(" ")}`
          : "";
      setError((e.message || "Failed to submit Final manuscript") + extra);
    },
  });

  if (isLoading && !data) {
    return (
      <Card>
        <CardContent className="pt-6 text-sm text-(--earist-body-text)">
          Loading Final Adviser review status…
        </CardContent>
      </Card>
    );
  }

  const status = data?.reviewStatus ?? "NONE";
  const canUpload = status === "NONE" || status === "CHANGES_REQUESTED";
  const blockedByProposal = data && !data.proposalStageComplete;
  const blockedByStrike =
    data?.strikeRequired === true && data.strikeEligible === false;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold text-(--earist-secondary)">
          1. Final Manuscript / Adviser Review
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex items-center gap-2">
          {status === "ISSUED" ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-700" />
          ) : (
            <Clock className="h-5 w-5 text-amber-600" />
          )}
          <p className="font-medium text-(--earist-primary)">
            {statusLabel(status)}
          </p>
        </div>

        {blockedByProposal && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Proposal stage incomplete</AlertTitle>
            <AlertDescription>
              Proposal Defense must be formally PASSED with a finalized Proposal
              RAP before Final manuscript review.
            </AlertDescription>
          </Alert>
        )}

        {blockedByStrike && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>STRIKE / plagiarism</AlertTitle>
            <AlertDescription>
              Required STRIKE / plagiarism clearance is still pending.{" "}
              <a href="/student/thesis/strike" className="underline">
                View STRIKE status
              </a>
            </AlertDescription>
          </Alert>
        )}

        {status === "CHANGES_REQUESTED" && data?.reviewRemarks && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Adviser remarks</AlertTitle>
            <AlertDescription>{data.reviewRemarks}</AlertDescription>
          </Alert>
        )}

        {status === "ISSUED" && data?.certification && (
          <div className="space-y-1 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
            <p className="font-medium text-emerald-800">
              Final Adviser Certification: Issued
            </p>
            <p className="text-xs text-emerald-800">
              Certified by {data.certification.adviserName}
              {data.certification.signedAt
                ? ` on ${new Date(data.certification.signedAt).toLocaleDateString()}`
                : ""}
            </p>
          </div>
        )}

        {status === "AWAITING_REVIEW" && (
          <p className="text-(--earist-body-text)">
            Final manuscript submitted for Adviser review. This is not the Final
            application to Admin yet.
          </p>
        )}

        {data?.manuscript && (
          <p className="flex items-center gap-2 text-xs text-(--earist-body-text)">
            <FileText className="h-4 w-4" />
            Current Final manuscript uploaded
            {data.manuscript.uploadedAt
              ? ` ${new Date(data.manuscript.uploadedAt).toLocaleDateString()}`
              : ""}
          </p>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Submission failed</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {canUpload && !blockedByProposal && !blockedByStrike && (
          <div className="space-y-2">
            {!file ? (
              <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-(--earist-border-gray) p-4 hover:border-(--earist-primary)">
                <Upload className="mb-1 h-6 w-6 text-(--earist-body-text)/40" />
                <p className="text-sm text-(--earist-primary)">
                  Upload complete Final manuscript (Ch. 1–5)
                </p>
                <p className="text-xs text-(--earist-body-text)">PDF, DOC, DOCX</p>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".pdf,.doc,.docx"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setFile(f);
                  }}
                />
              </label>
            ) : (
              <div className="flex items-center justify-between rounded border border-(--earist-border-gray) p-2">
                <span className="truncate text-xs">{file.name}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setFile(null);
                    if (inputRef.current) inputRef.current.value = "";
                  }}
                >
                  Remove
                </Button>
              </div>
            )}
            <Button
              type="button"
              disabled={!file || submitManuscript.isPending}
              onClick={() => submitManuscript.mutate()}
              className="bg-(--earist-primary) hover:bg-(--earist-primary)/90"
            >
              <Send className="mr-2 h-4 w-4" />
              {submitManuscript.isPending
                ? "Submitting…"
                : status === "CHANGES_REQUESTED"
                  ? "Resubmit revised Final manuscript"
                  : "Submit for Adviser review"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
