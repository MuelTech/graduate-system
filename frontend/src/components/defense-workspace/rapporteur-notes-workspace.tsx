"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClientRequest, ApiError } from "@/lib/api.client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Save } from "lucide-react";

export function RapporteurNotesWorkspace({
  scheduleId,
  initialNotes,
}: {
  scheduleId: string;
  initialNotes: string | null;
}) {
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState(initialNotes ?? "");
  const dirtyRef = useRef(false);
  const [dirty, setDirty] = useState(false);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );

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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-sm">
          Defense Notes (Draft)
          {dirty && (
            <span className="text-xs font-normal text-amber-700">
              Unsaved changes
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-(--earist-body-text)">
          Workspace draft notes only. Official RAP finalization becomes available
          after the evaluation/conclusion workflow.
        </p>
        <Textarea
          rows={10}
          value={notes}
          onChange={(e) => {
            setNotes(e.target.value);
            dirtyRef.current = true;
            setDirty(true);
            setState("idle");
          }}
          placeholder="Minutes, recommendations, and session notes…"
        />
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            disabled={saveNotes.isPending}
            onClick={() => saveNotes.mutate()}
          >
            <Save className="mr-2 h-4 w-4" />
            Save Notes Draft
          </Button>
          <span className="text-xs text-(--earist-body-text)">
            {state === "saving"
              ? "Saving..."
              : state === "saved"
                ? "Saved"
                : state === "error"
                  ? "Error saving notes"
                  : ""}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
