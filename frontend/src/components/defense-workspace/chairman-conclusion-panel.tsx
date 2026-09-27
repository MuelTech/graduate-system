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
}: {
  scheduleId: string;
  workspace: DefenseWorkspace;
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

  const canSubmit =
    !concluded &&
    notesReady &&
    outcome &&
    (isTitle
      ? outcome !== "PASSED" || selectedTitleId
      : summaryReady && evalsComplete);

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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Formal Academic Result</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!notesReady ? (
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
                    <SelectValue placeholder="Select one proposed title…" />
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
                    <li>
                      Summary average:{" "}
                      {workspace.oralSummary?.overallAverage ?? "—"}
                    </li>
                  )}
                  <li>Selected result: {outcome}</li>
                  {isTitle && outcome === "PASSED" && (
                    <li>Selected title required</li>
                  )}
                  <li className="font-semibold">
                    This action is irreversible.
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
