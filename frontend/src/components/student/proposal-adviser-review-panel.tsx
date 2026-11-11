"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiClientRequest, ApiError } from "@/lib/api.client";
import { studentThesisJourneyQueryKey } from "@/lib/student-thesis-journey";
import {
  createManuscriptSubmission,
  MANUSCRIPT_TITLE_MAX_LENGTH,
} from "@/lib/manuscript-submission";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AdviserCertificationRecords } from "@/components/shared/adviser-certification-records";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  FileText,
  Send,
  Upload,
} from "lucide-react";
import type {
  ProposalAdviserReview,
  ProposalReviewStatus,
} from "@/types/proposal-adviser-review";

export const proposalAdviserReviewQueryKey = ["student", "proposal-adviser-review"] as const;
const reviewQueryKey = proposalAdviserReviewQueryKey;

function statusLabel(status: ProposalReviewStatus): string {
  switch (status) {
    case "AWAITING_REVIEW":
      return "Awaiting Adviser review";
    case "CHANGES_REQUESTED":
      return "Changes requested by Adviser";
    case "ISSUED":
      return "Adviser Certification issued";
    default:
      return "Ready to upload Proposal manuscript";
  }
}

export function ProposalAdviserReviewPanel() {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [manuscriptTitle, setManuscriptTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const prevStatusRef = useRef<ProposalReviewStatus | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: reviewQueryKey,
    queryFn: async () =>
      (await apiClientRequest("/thesis/proposal-adviser-review")) as ProposalAdviserReview,
    // Cross-role freshness while waiting on Adviser
    refetchInterval: (q) => {
      const st = (q.state.data as ProposalAdviserReview | undefined)?.reviewStatus;
      return st === "AWAITING_REVIEW" || st === "CHANGES_REQUESTED" ? 30_000 : false;
    },
    refetchOnWindowFocus: true,
  });

  // CP3-FIX1: refresh Proposal eligibility only on meaningful transitions (e.g. → ISSUED)
  const currentStatus = data?.reviewStatus ?? null;
  useEffect(() => {
    const prevStatus = prevStatusRef.current;
    if (prevStatus === currentStatus) return;
    prevStatusRef.current = currentStatus;
    if (currentStatus === "ISSUED" && prevStatus !== null && prevStatus !== "ISSUED") {
      void queryClient.invalidateQueries({
        queryKey: ["thesisEligibility", "PROPOSAL_DEFENSE"],
      });
      void queryClient.invalidateQueries({
        queryKey: studentThesisJourneyQueryKey,
      });
    }
    if (
      currentStatus === "AWAITING_REVIEW" ||
      currentStatus === "CHANGES_REQUESTED"
    ) {
      void queryClient.invalidateQueries({
        queryKey: ["thesisEligibility", "PROPOSAL_DEFENSE"],
      });
    }
  }, [currentStatus, queryClient]);

  const submitManuscript = useMutation({
    mutationFn: async () => {
      const formData = createManuscriptSubmission(manuscriptTitle, file);
      return apiClientRequest("/thesis/proposal-adviser-review/manuscript", {
        method: "POST",
        body: formData,
      });
    },
    onSuccess: async () => {
      setError(null);
      setFile(null);
      setManuscriptTitle("");
      if (inputRef.current) inputRef.current.value = "";
      toast.success("Proposal manuscript submitted for Adviser review.");
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
      const fullError = (e.message || "Failed to submit manuscript") + extra;
      setError(fullError);
      toast.error(fullError);
    },
  });

  if (isLoading && !data) {
    return (
      <Card>
        <CardContent className="pt-6 text-sm text-gray-500">
          Loading Adviser review status…
        </CardContent>
      </Card>
    );
  }

  const status = data?.reviewStatus ?? "NONE";
  const canUpload =
    status === "NONE" || status === "CHANGES_REQUESTED";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-bold text-[#333333]">
          1. Manuscript Review — Proposal Manuscript
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="flex items-center gap-2">
          {status === "ISSUED" ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-700" />
          ) : (
            <Clock className="h-5 w-5 text-amber-600" />
          )}
          <p className="font-semibold text-[#333333]">
            {statusLabel(status)}
          </p>
        </div>

        {data?.activeAdviser && (
          <p className="text-gray-600">
            Active Adviser:{" "}
            <span className="font-semibold text-[#333333]">{data.activeAdviser.name}</span>
          </p>
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
              Adviser Certification: Issued
            </p>
            <p className="text-xs text-emerald-800">
              Certified by {data.certification.adviserName}
              {data.certification.signedAt
                ? ` on ${new Date(data.certification.signedAt).toLocaleDateString()}`
                : ""}
            </p>
          </div>
        )}

        {status === "ISSUED" && data?.thesisId && <AdviserCertificationRecords thesisId={data.thesisId} stage="PROPOSAL" />}

        {status === "AWAITING_REVIEW" && (
          <p className="text-gray-600">
            Proposal manuscript submitted for Adviser review. Once certified, you
            may submit your Proposal Defense application.
          </p>
        )}

        {data?.manuscript && (
          <div className="space-y-1 break-words rounded-lg border border-gray-100 bg-gray-50/60 p-3">
            <p className="text-xs font-semibold tracking-wider text-gray-500 uppercase">
              Thesis / Dissertation Title
            </p>
            <p className="font-medium text-[#333333]">{data.manuscript.manuscriptTitle || "Title not recorded for this manuscript."}</p>
            <p className="text-xs text-gray-500">
              {data.manuscript.originalFilename || "Filename unavailable"}
            </p>
            <p className="flex items-center gap-2 text-xs text-gray-500">
              <FileText className="h-4 w-4" />
              Current manuscript uploaded
              {data.manuscript.uploadedAt
                ? ` ${new Date(data.manuscript.uploadedAt).toLocaleDateString()}`
                : ""}
            </p>
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Submission failed</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {canUpload && (
          <div className="space-y-3">
            <label
              htmlFor="proposal-manuscript-title"
              className="block font-semibold text-[#333333]"
            >
              Thesis / Dissertation Title <span aria-hidden="true" className="text-[#e02b20]">*</span>
            </label>
            <Textarea
              id="proposal-manuscript-title"
              required
              value={manuscriptTitle}
              onChange={(event) => setManuscriptTitle(event.target.value)}
              maxLength={MANUSCRIPT_TITLE_MAX_LENGTH}
              disabled={submitManuscript.isPending}
              aria-describedby="proposal-manuscript-title-help"
              rows={3}
            />
            <p id="proposal-manuscript-title-help" className="text-xs text-gray-500">
              Enter the title for this manuscript. Include the title again with each revision.
            </p>
            {!file ? (
              <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-gray-50/40 p-5 transition-colors hover:border-[#e02b20] hover:bg-[#e02b20]/[0.02]">
                <Upload className="mb-1.5 h-6 w-6 text-gray-400" />
                <p className="text-sm font-medium text-[#333333]">
                  Upload Proposal Chapters 1–3
                </p>
                <p className="text-xs text-gray-400">PDF, DOC, DOCX</p>
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
              <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50/60 p-2.5">
                <span className="truncate text-xs font-medium text-[#333333]">{file.name}</span>
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
              disabled={!file || !manuscriptTitle.trim() || submitManuscript.isPending}
              onClick={() => submitManuscript.mutate()}
            >
              <Send className="mr-2 h-4 w-4" />
              {submitManuscript.isPending
                ? "Submitting…"
                : status === "CHANGES_REQUESTED"
                  ? "Resubmit revised manuscript"
                  : "Submit for Adviser review"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
