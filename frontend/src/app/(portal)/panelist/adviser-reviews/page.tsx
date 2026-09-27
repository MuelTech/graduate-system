"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClientRequest, ApiError } from "@/lib/api.client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  GraduationCap,
  RefreshCw,
} from "lucide-react";
import type {
  AdviserReviewQueueItem,
  ProposalAdviserReview,
} from "@/types/proposal-adviser-review";

const queueKey = ["panelist", "adviser-reviews"] as const;

type ReviewStage = "PROPOSAL" | "FINAL";

function taskKey(thesisId: string, stage: ReviewStage) {
  return [...queueKey, stage, thesisId] as const;
}

export default function ProposalAdviserReviewsPage() {
  const queryClient = useQueryClient();
  const [selectedThesisId, setSelectedThesisId] = useState<string | null>(null);
  const [selectedStage, setSelectedStage] = useState<ReviewStage>("PROPOSAL");
  const [remarks, setRemarks] = useState("");
  const [signature, setSignature] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data: queue, isLoading, refetch, isRefetching } = useQuery({
    queryKey: queueKey,
    queryFn: async () => {
      const [proposal, finalTasks] = await Promise.all([
        apiClientRequest("/thesis/proposal-adviser-review/tasks") as Promise<
          AdviserReviewQueueItem[]
        >,
        apiClientRequest("/thesis/final-adviser-review/tasks") as Promise<
          Array<AdviserReviewQueueItem & { stage?: string }>
        >,
      ]);
      return [
        ...proposal.map((t) => ({ ...t, stage: "PROPOSAL" as ReviewStage })),
        ...finalTasks.map((t) => ({ ...t, stage: "FINAL" as ReviewStage })),
      ];
    },
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  const { data: task } = useQuery({
    queryKey: taskKey(selectedThesisId ?? "none", selectedStage),
    queryFn: async () => {
      const path =
        selectedStage === "FINAL"
          ? `/thesis/final-adviser-review/tasks/${selectedThesisId}`
          : `/thesis/proposal-adviser-review/tasks/${selectedThesisId}`;
      return (await apiClientRequest(path)) as ProposalAdviserReview & {
        stage?: string;
      };
    },
    enabled: Boolean(selectedThesisId),
  });

  const reviewBase =
    selectedStage === "FINAL"
      ? "/thesis/final-adviser-review/tasks"
      : "/thesis/proposal-adviser-review/tasks";

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: queueKey });
    if (selectedThesisId) {
      await queryClient.invalidateQueries({
        queryKey: taskKey(selectedThesisId, selectedStage),
      });
    }
  };

  const requestChanges = useMutation({
    mutationFn: async () =>
      apiClientRequest(
        `${reviewBase}/${selectedThesisId}/request-changes`,
        {
          method: "POST",
          body: JSON.stringify({
            remarks,
            expectedReviewedDocumentId: task?.manuscript?.documentId ?? null,
          }),
        },
      ),
    onSuccess: async () => {
      setError(null);
      setRemarks("");
      await invalidate();
    },
    onError: async (e: Error) => {
      setError(e.message || "Failed to request changes");
      // Stale review state (409) — refresh so Adviser sees current manuscript.
      if (e instanceof ApiError && e.statusCode === 409) {
        await invalidate();
      }
    },
  });

  const certify = useMutation({
    mutationFn: async () =>
      apiClientRequest(`${reviewBase}/${selectedThesisId}/certify`, {
        method: "POST",
        body: JSON.stringify({
          signatureData: signature,
          remarks,
          expectedReviewedDocumentId: task?.manuscript?.documentId ?? null,
        }),
      }),
    onSuccess: async () => {
      setError(null);
      setSignature("");
      setRemarks("");
      await invalidate();
    },
    onError: async (e: Error) => {
      setError(e.message || "Failed to certify");
      // Stale review state (409) — do not auto-retry; Adviser must re-review.
      if (e instanceof ApiError && e.statusCode === 409) {
        await invalidate();
      }
    },
  });

  const finalTask = task as
    | (ProposalAdviserReview & {
        strikeRequired?: boolean;
        strikeEligible?: boolean;
      })
    | undefined;
  const actionsBlocked =
    selectedStage === "FINAL" &&
    finalTask?.strikeRequired === true &&
    finalTask?.strikeEligible !== true;

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-(--earist-primary)">
            Adviser Reviews
          </h2>
          <p className="text-sm text-(--earist-body-text)">
            Review manuscripts for students you actively advise. Only the current
            active adviser may review or certify.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isRefetching}
        >
          <RefreshCw
            className={`mr-2 h-4 w-4 ${isRefetching ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Action failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Review queue</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {isLoading && (
              <p className="text-sm text-(--earist-body-text)">Loading…</p>
            )}
            {!isLoading && (!queue || queue.length === 0) && (
              <p className="text-sm text-(--earist-body-text)">
                No manuscripts are currently awaiting your review.
              </p>
            )}
            {queue?.map((item) => (
              <button
                key={item.thesisId}
                type="button"
                onClick={() => {
                  setSelectedThesisId(item.thesisId);
                  setSelectedStage(
                    (item as { stage?: ReviewStage }).stage === "FINAL"
                      ? "FINAL"
                      : "PROPOSAL",
                  );
                  setRemarks(item.reviewRemarks || "");
                }}
                className={`w-full rounded-lg border p-3 text-left transition-colors ${
                  selectedThesisId === item.thesisId
                    ? "border-(--earist-primary) bg-(--earist-surface-gray)"
                    : "border-(--earist-border-gray) hover:border-(--earist-primary)"
                }`}
              >
                <p className="font-medium text-(--earist-primary)">
                  {item.student.name}
                  <span className="ml-2 rounded bg-(--earist-surface-gray) px-1.5 py-0.5 text-[10px] font-semibold text-(--earist-secondary)">
                    {(item as { stage?: ReviewStage }).stage === "FINAL"
                      ? "Final"
                      : "Proposal"}
                  </span>
                </p>
                <p className="text-xs text-(--earist-body-text)">
                  {item.student.studentNumber || "—"}
                </p>
                <p className="mt-1 text-xs text-(--earist-body-text)">
                  {item.officialTitle || "No official title"}
                </p>
                <p className="mt-1 text-xs font-medium text-amber-700">
                  {item.reviewStatus === "CHANGES_REQUESTED"
                    ? "Changes requested"
                    : "Awaiting review"}
                  {item.manuscriptUploadedAt
                    ? ` · updated ${new Date(item.manuscriptUploadedAt).toLocaleDateString()}`
                    : ""}
                </p>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Review workspace</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {!task && (
              <p className="text-(--earist-body-text)">
                Select a student from the queue to review their manuscript.
              </p>
            )}
            {task && (
              <>
                <div className="flex items-center gap-2">
                  <GraduationCap className="h-4 w-4 text-(--earist-primary)" />
                  <div>
                    <p className="font-medium">{task.student?.name}</p>
                    <p className="text-xs text-(--earist-body-text)">
                      {task.officialTitle || "No official title"}
                    </p>
                  </div>
                </div>
                <p className="text-xs uppercase tracking-wide text-(--earist-body-text)">
                  Stage:{" "}
                  <span className="font-semibold normal-case text-(--earist-primary)">
                    {selectedStage === "FINAL" ? "Final" : "Proposal"}
                  </span>
                  {" · "}Status:{" "}
                  <span className="font-medium normal-case">
                    {task.reviewStatus === "ISSUED"
                      ? "Certification issued"
                      : task.reviewStatus === "CHANGES_REQUESTED"
                        ? "Changes requested"
                        : task.manuscript
                          ? "Awaiting review"
                          : "No manuscript"}
                  </span>
                </p>
                {selectedStage === "FINAL" &&
                  (task as { strikeRequired?: boolean; strikeEligible?: boolean })
                    .strikeRequired === true &&
                  (task as { strikeEligible?: boolean }).strikeEligible !== true && (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>STRIKE pending</AlertTitle>
                      <AlertDescription>
                        Required STRIKE / plagiarism clearance is still pending.
                        Review actions are disabled until clearance is recorded.
                      </AlertDescription>
                    </Alert>
                  )}
                {task.manuscript && (
                  <a
                    href={`/api/documents/thesis-document/${task.manuscript.documentId}/file`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-(--earist-primary) underline"
                  >
                    <FileText className="h-4 w-4" />
                    {selectedStage === "FINAL"
                      ? "Open Final manuscript"
                      : "Open Proposal manuscript"}
                  </a>
                )}
                {task.certification?.issued && (
                  <Alert>
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertTitle>Certification issued</AlertTitle>
                    <AlertDescription>
                      Certified by {task.certification.adviserName}
                      {task.certification.signedAt
                        ? ` on ${new Date(task.certification.signedAt).toLocaleDateString()}`
                        : ""}
                    </AlertDescription>
                  </Alert>
                )}
                {!task.certification?.issued && task.manuscript && (
                  <>
                    <div>
                      <p className="mb-1 text-xs font-medium text-(--earist-secondary)">
                        Remarks
                      </p>
                      <Textarea
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                        placeholder="Comments for the student (required when requesting changes)"
                        rows={3}
                      />
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-medium text-(--earist-secondary)">
                        E-signature (required to certify)
                      </p>
                      <Textarea
                        value={signature}
                        onChange={(e) => setSignature(e.target.value)}
                        placeholder="Type your full name as e-signature"
                        rows={2}
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        disabled={
                          requestChanges.isPending ||
                          !remarks.trim() ||
                          !task.manuscript?.documentId ||
                          actionsBlocked
                        }
                        onClick={() => requestChanges.mutate()}
                      >
                        Request Changes
                      </Button>
                      <Button
                        type="button"
                        disabled={
                          certify.isPending ||
                          !signature.trim() ||
                          !task.manuscript?.documentId ||
                          actionsBlocked
                        }
                        className="bg-(--earist-primary) hover:bg-(--earist-primary)/90"
                        onClick={() => certify.mutate()}
                      >
                        Certify &amp; Sign
                      </Button>
                    </div>
                  </>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
