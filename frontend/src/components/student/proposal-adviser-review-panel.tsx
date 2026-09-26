"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClientRequest, ApiError } from "@/lib/api.client";
import { studentThesisJourneyQueryKey } from "@/lib/student-thesis-journey";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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

const reviewQueryKey = ["student", "proposal-adviser-review"] as const;

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
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

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

  const submitManuscript = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      formData.append("document", file!);
      return apiClientRequest("/thesis/proposal-adviser-review/manuscript", {
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
      setError((e.message || "Failed to submit manuscript") + extra);
    },
  });

  if (isLoading && !data) {
    return (
      <Card>
        <CardContent className="pt-6 text-sm text-(--earist-body-text)">
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
        <CardTitle className="text-sm font-semibold text-(--earist-secondary)">
          2. Adviser Review — Proposal Manuscript
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

        {data?.activeAdviser && (
          <p className="text-(--earist-body-text)">
            Active Adviser:{" "}
            <span className="font-medium">{data.activeAdviser.name}</span>
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

        {status === "AWAITING_REVIEW" && (
          <p className="text-(--earist-body-text)">
            Proposal manuscript submitted for Adviser review. This is not the
            Proposal application to Admin yet.
          </p>
        )}

        {data?.manuscript && (
          <p className="flex items-center gap-2 text-xs text-(--earist-body-text)">
            <FileText className="h-4 w-4" />
            Current manuscript uploaded
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

        {canUpload && (
          <div className="space-y-2">
            {!file ? (
              <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-(--earist-border-gray) p-4 hover:border-(--earist-primary)">
                <Upload className="mb-1 h-6 w-6 text-(--earist-body-text)/40" />
                <p className="text-sm text-(--earist-primary)">
                  Upload Proposal Chapters 1–3
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
                  ? "Resubmit revised manuscript"
                  : "Submit for Adviser review"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
