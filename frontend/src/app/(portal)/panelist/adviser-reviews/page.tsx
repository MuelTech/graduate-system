"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClientRequest } from "@/lib/api.client";
import {
  adviserReviewBasePath,
  adviserReviewsQueueQueryKey,
  type AdviserReviewStageKey,
} from "@/lib/adviser-reviews";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AdviserReviewActionPanel } from "@/components/panelist/adviser-review-action-panel";
import { RefreshCw } from "lucide-react";
import type { AdviserReviewQueueItem } from "@/types/proposal-adviser-review";

type QueueItem = AdviserReviewQueueItem & { stage: AdviserReviewStageKey };

/**
 * Compatibility route retained for ADV-7. ADV-6 centralizes the actual review
 * action surface so this queue and My Advisees cannot drift.
 */
export default function ProposalAdviserReviewsPage() {
  const [selected, setSelected] = useState<QueueItem | null>(null);

  const { data: queue, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: adviserReviewsQueueQueryKey,
    queryFn: async () => {
      const [proposal, finalTasks] = await Promise.all([
        apiClientRequest(adviserReviewBasePath("PROPOSAL")) as Promise<
          AdviserReviewQueueItem[]
        >,
        apiClientRequest(adviserReviewBasePath("FINAL")) as Promise<
          Array<AdviserReviewQueueItem & { stage?: string }>
        >,
      ]);
      return [
        ...proposal.map((task) => ({ ...task, stage: "PROPOSAL" as const })),
        ...finalTasks.map((task) => ({ ...task, stage: "FINAL" as const })),
      ] as QueueItem[];
    },
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

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

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Review queue</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading && (
            <p className="text-sm text-(--earist-body-text)">Loading…</p>
          )}
          {!isLoading && isError && (
            <div className="space-y-2">
              <p className="text-sm text-(--earist-body-text)">
                Unable to load adviser reviews.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => refetch()}
              >
                Try again
              </Button>
            </div>
          )}
          {!isLoading && !isError && (!queue || queue.length === 0) && (
            <p className="text-sm text-(--earist-body-text)">
              No manuscripts are currently awaiting your review.
            </p>
          )}
          {queue?.map((item) => (
            <button
              key={`${item.stage}-${item.thesisId}`}
              type="button"
              onClick={() => setSelected(item)}
              className="w-full rounded-lg border border-(--earist-border-gray) p-3 text-left transition-colors hover:border-(--earist-primary)"
            >
              <p className="font-medium text-(--earist-primary)">
                {item.student.name}
                <span className="ml-2 rounded bg-(--earist-surface-gray) px-1.5 py-0.5 text-[10px] font-semibold text-(--earist-secondary)">
                  {item.stage === "FINAL" ? "Final" : "Proposal"}
                </span>
              </p>
              <p className="text-xs text-(--earist-body-text)">
                {item.student.studentNumber || "—"}
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

      {selected ? (
        <AdviserReviewActionPanel
          open
          onOpenChange={(open) => {
            if (!open) setSelected(null);
          }}
          stage={selected.stage}
          thesisId={selected.thesisId}
          studentName={selected.student.name}
        />
      ) : null}
    </div>
  );
}
