"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClientRequest, ApiError } from "@/lib/api.client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Save, Lock } from "lucide-react";

export function RapporteurNotesWorkspace({
  scheduleId,
  initialNotes,
  notesFinalizedAt,
  canFinalize,
  evaluationProgress,
}: {
  scheduleId: string;
  initialNotes: string | null;
  notesFinalizedAt: string | null;
  canFinalize: boolean;
  evaluationProgress?: {
    evaluatorAssignments: number;
    finalizedEvaluations: number;
  };
}) {
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState(initialNotes ?? "");
  const dirtyRef = useRef(false);
  const [dirty, setDirty] = useState(false);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const [confirmFinalize, setConfirmFinalize] = useState(false);
  const finalized = Boolean(notesFinalizedAt);

  // CP6-FIX1: only hydrate when clean — never overwrite unsaved typing.
  useEffect(() => {
    if (dirtyRef.current) return;
    setNotes(initialNotes ?? "");
  }, [initialNotes]);

  const saveNotes = useMutation({
    mutationFn: async () =>
      apiClientRequest(
        `/thesis/defense/${scheduleId}/workspace/rapporteur-notes`,
        {
          method: "PUT",
          body: JSON.stringify({ notes }),
        },
      ),
    onMutate: () => setState("saving"),
    onSuccess: async () => {
      setState("saved");
      dirtyRef.current = false;
      setDirty(false);
      await queryClient.invalidateQueries({
        queryKey: ["defenseWorkspace", scheduleId],
      });
    },
    onError: (e: Error) => {
      setState("error");
      const msg =
        e instanceof ApiError && e.statusCode === 409
          ? e.message
          : "Error saving notes";
      console.error(msg);
    },
  });

  const finalizeNotes = useMutation({
    mutationFn: async () =>
      apiClientRequest(
        `/thesis/defense/${scheduleId}/rapporteur/finalize`,
        { method: "POST", body: JSON.stringify({}) },
      ),
    onSuccess: async () => {
      setConfirmFinalize(false);
      await queryClient.invalidateQueries({
        queryKey: ["defenseWorkspace", scheduleId],
      });
    },
    onError: (e: Error) => {
      console.error(e.message);
    },
  });

  const evalsComplete =
    !evaluationProgress ||
    evaluationProgress.finalizedEvaluations >=
      evaluationProgress.evaluatorAssignments;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-sm">
          {finalized ? "Defense Notes (Finalized)" : "Defense Notes (Draft)"}
          {dirty && !finalized && (
            <span className="text-xs font-normal text-amber-700">
              Unsaved changes
            </span>
          )}
          {finalized && (
            <span className="flex items-center gap-1 text-xs font-normal text-emerald-700">
              <Lock className="h-3 w-3" /> Locked
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-(--earist-body-text)">
          {finalized
            ? "Defense notes are finalized and immutable. They feed the official RAP after the Chairman records the formal result."
            : "Workspace draft notes. Finalize when deliberation/evaluation content is complete — finalization is irreversible."}
        </p>
        <Textarea
          rows={10}
          value={notes}
          disabled={finalized}
          onChange={(e) => {
            setNotes(e.target.value);
            dirtyRef.current = true;
            setDirty(true);
            setState("idle");
          }}
          placeholder="Minutes, recommendations, and session notes…"
        />
        {!finalized && (
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={saveNotes.isPending}
              onClick={() => saveNotes.mutate()}
            >
              <Save className="mr-2 h-4 w-4" />
              Save Notes Draft
            </Button>
            {canFinalize && (
              <Button
                type="button"
                disabled={
                  finalizeNotes.isPending ||
                  !notes.trim() ||
                  dirty ||
                  !evalsComplete
                }
                onClick={() => setConfirmFinalize(true)}
                className="bg-(--earist-primary) hover:bg-(--earist-primary)/90"
              >
                <Lock className="mr-2 h-4 w-4" />
                Finalize Defense Notes
              </Button>
            )}
            <span className="text-xs text-(--earist-body-text)">
              {state === "saving"
                ? "Saving..."
                : state === "saved"
                  ? "Saved"
                  : state === "error"
                    ? "Error saving notes"
                    : !evalsComplete
                      ? "Waiting for evaluator completion"
                      : dirty
                        ? "Save draft before finalizing"
                        : ""}
            </span>
          </div>
        )}
        {confirmFinalize && (
          <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm">
            <p className="font-medium text-amber-900">
              Finalize defense notes?
            </p>
            <p className="mt-1 text-xs text-amber-800">
              This is irreversible. Notes will be locked and used by the
              Chairman for the formal academic result and the official RAP.
            </p>
            <div className="mt-3 flex gap-2">
              <Button
                type="button"
                size="sm"
                disabled={finalizeNotes.isPending}
                onClick={() => finalizeNotes.mutate()}
                className="bg-(--earist-primary) hover:bg-(--earist-primary)/90"
              >
                Confirm Finalize
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setConfirmFinalize(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
