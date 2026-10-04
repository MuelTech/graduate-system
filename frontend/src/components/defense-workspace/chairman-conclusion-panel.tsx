"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClientRequest } from "@/lib/api.client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { DefenseWorkspace } from "@/types/defense-workspace";

const OUTCOMES = [
  { value: "PASSED", label: "PASSED" },
  { value: "REVISION_REQUIRED", label: "REVISION_REQUIRED" },
  { value: "FAILED", label: "FAILED" },
] as const;

export function ChairmanConclusionPanel({
  scheduleId,
  workspace,
  detailedSummaryReady,
  detailedSummaryLoading,
  detailedSummaryError,
}: {
  scheduleId: string;
  workspace: DefenseWorkspace;
  /**
   * CP7-FIX3: true only when Proposal/Final detailed Summary loaded successfully
   * and data.ready === true. Title does not require this gate.
   */
  detailedSummaryReady?: boolean;
  detailedSummaryLoading?: boolean;
  detailedSummaryError?: boolean;
}) {
  const queryClient = useQueryClient();
  const [outcome, setOutcome] = useState<string>("");
  const [selectedTitleId, setSelectedTitleId] = useState<string>("");
  const [finalRemarks, setFinalRemarks] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const isTitle = workspace.schedule.defenseType === "TITLE_DEFENSE";
  const concluded = workspace.conclusionsPresent;
  const notesReady = Boolean(workspace.rapporteurNotesFinalizedAt);
  const summaryReady = workspace.oralSummary?.ready ?? false;
  const evals = workspace.evaluationProgress;
  const evalsComplete =
    evals.evaluatorAssignments > 0 &&
    evals.finalizedEvaluations >= evals.evaluatorAssignments;

  const sessionStatus = workspace.schedule.sessionStatus;
  const titleReadyForConclusion =
    isTitle &&
    (sessionStatus === "IN_PROGRESS" || sessionStatus === "AWAITING_CONCLUSION");
  const canStartTitleDefense = workspace.capabilities.canStartTitleDefense;

  /**
   * Human-readable label for a proposed-title id. Base UI's SelectValue renders
   * the raw value (a UUID) unless given a mapping, so the trigger must resolve it
   * here while the controlled/submitted value stays the title id.
   */
  const selectedTitleLabel = (titleId: string) => {
    const index = workspace.proposedTitles.findIndex((t) => t.id === titleId);
    const title = index >= 0 ? workspace.proposedTitles[index] : null;
    return title
      ? `Title ${index + 1}: ${title.titleText.slice(0, 80)}`
      : null;
  };

  // CP7-FIX3: Proposal/Final formal result requires successful detailed Summary load.
  // 2026-10-04 Title correction: the Chairman records the panel-agreed result
  // independently of Rapporteur notes/RAP finalization, but only once the defense
  // has actually started (not while merely SCHEDULED).
  const canSubmit =
    !concluded &&
    Boolean(outcome) &&
    (isTitle
      ? titleReadyForConclusion &&
        (outcome !== "PASSED" || Boolean(selectedTitleId))
      : notesReady &&
        summaryReady &&
        evalsComplete &&
        detailedSummaryReady === true &&
        !detailedSummaryLoading &&
        !detailedSummaryError);

  const conclude = useMutation({
    mutationFn: async () =>
      apiClientRequest(`/thesis/defense/${scheduleId}/conclusion`, {
        method: "POST",
        body: JSON.stringify({
          outcome,
          selectedTitleId: isTitle && outcome === "PASSED" ? selectedTitleId : null,
          finalRemarks: finalRemarks.trim() || null,
        }),
      }),
    onSuccess: async () => {
      setConfirmOpen(false);
      await queryClient.invalidateQueries({
        queryKey: ["defenseWorkspace", scheduleId],
      });
    },
    onError: (e: Error) => {
      console.error(e.message);
    },
  });

  const startDefense = useMutation({
    mutationFn: async () =>
      apiClientRequest(`/thesis/defense/${scheduleId}/start`, {
        method: "POST",
        body: JSON.stringify({}),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["defenseWorkspace", scheduleId],
      });
    },
    onError: (e: Error) => {
      console.error(e.message);
    },
  });

  if (concluded) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Formal Result</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            Formal result recorded:{" "}
            <span className="font-semibold">{workspace.formalResult}</span>
          </p>
          <p className="text-xs text-(--earist-body-text)">
            RAP status: {workspace.rapStatus ?? "—"}
            {workspace.rapStatus === "FINALIZED"
              ? " — finalized."
              : " — awaiting required evaluator signatures."}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (isTitle && canStartTitleDefense) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Title Defense Deliberation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-(--earist-body-text)">
            This session is scheduled. Start the Title Defense to begin panel
            deliberation. The formal result can be recorded once deliberation is
            in progress; Rapporteur minutes are not required first.
          </p>
          <Button
            type="button"
            disabled={startDefense.isPending}
            onClick={() => startDefense.mutate()}
            className="bg-(--earist-primary) hover:bg-(--earist-primary)/90"
          >
            Start Title Defense
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Formal Academic Result</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isTitle && !notesReady ? (
          <p className="text-sm text-amber-800">
            Waiting for Rapporteur to finalize defense notes.
          </p>
        ) : (
          <>
            {!isTitle && (
              <div className="rounded border border-(--earist-border-gray) p-3 text-xs text-(--earist-body-text)">
                <p>
                  Evaluations finalized: {evals.finalizedEvaluations} /{" "}
                  {evals.evaluatorAssignments}
                </p>
                <p>
                  Summary:{" "}
                  {summaryReady
                    ? `Ready — overall average ${workspace.oralSummary?.overallAverage ?? "—"}`
                    : "Not ready"}
                </p>
                <p>
                  Detailed Summary:{" "}
                  {detailedSummaryError
                    ? "unavailable (retry required)"
                    : detailedSummaryLoading
                      ? "loading"
                      : detailedSummaryReady
                        ? "reviewed/available"
                        : summaryReady
                          ? "unavailable"
                          : "not ready"}
                </p>
                {!isTitle && detailedSummaryError && (
                  <p className="mt-1 text-red-700">
                    Unable to load Summary. Formal result is disabled until a
                    successful load.
                  </p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="outcome">Defense Outcome (required)</Label>
              <Select
                value={outcome}
                onValueChange={(v) => setOutcome(v ?? "")}
              >
                <SelectTrigger id="outcome">
                  <SelectValue placeholder="Select formal result…" />
                </SelectTrigger>
                <SelectContent>
                  {OUTCOMES.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-(--earist-body-text)">
                No result is suggested from scores. Choose explicitly — the
                system never auto-PASS/FAIL from averages.
              </p>
            </div>

            {isTitle && outcome === "PASSED" && (
              <div className="space-y-2">
                <Label htmlFor="title">Official Selected Title</Label>
                <Select
                  value={selectedTitleId}
                  onValueChange={(v) => setSelectedTitleId(v ?? "")}
                >
                  <SelectTrigger id="title">
                    <SelectValue placeholder="Select one proposed title…">
                      {selectedTitleId
                        ? selectedTitleLabel(selectedTitleId)
                        : undefined}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {workspace.proposedTitles.map((t, i) => (
                      <SelectItem key={t.id} value={t.id}>
                        Title {i + 1}: {t.titleText.slice(0, 80)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="remarks">Chairman Remarks (optional)</Label>
              <Textarea
                id="remarks"
                rows={3}
                value={finalRemarks}
                onChange={(e) => setFinalRemarks(e.target.value)}
                placeholder="Optional formal remarks…"
              />
            </div>

            {confirmOpen ? (
              <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm">
                <p className="font-medium text-amber-900">
                  Confirm formal result
                </p>
                <ul className="mt-2 space-y-1 text-xs text-amber-900">
                  <li>Student: {workspace.student.name}</li>
                  <li>Defense: {workspace.schedule.defenseType}</li>
                  {!isTitle && (
                    <>
                      <li>
                        Evaluators finalized: {evals.finalizedEvaluations} /{" "}
                        {evals.evaluatorAssignments}
                      </li>
                      <li>
                        Overall defense average:{" "}
                        {workspace.oralSummary?.overallAverage ?? "—"}
                      </li>
                      <li>
                        Generated Summary:{" "}
                        {detailedSummaryReady
                          ? "reviewed/available"
                          : detailedSummaryLoading
                            ? "loading"
                            : "unavailable"}
                      </li>
                    </>
                  )}
                  <li>Selected result: {outcome}</li>
                  {isTitle && outcome === "PASSED" && (
                    <li>Selected title required</li>
                  )}
                  <li className="font-semibold">
                    This action is irreversible. No result is recommended from
                    scores.
                  </li>
                </ul>
                <div className="mt-3 flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={conclude.isPending || !canSubmit}
                    onClick={() => conclude.mutate()}
                    className="bg-(--earist-primary) hover:bg-(--earist-primary)/90"
                  >
                    Confirm
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setConfirmOpen(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                type="button"
                disabled={!canSubmit}
                onClick={() => setConfirmOpen(true)}
                className="bg-(--earist-primary) hover:bg-(--earist-primary)/90"
              >
                Review & Record Formal Result
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
