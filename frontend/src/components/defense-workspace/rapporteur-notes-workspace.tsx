"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClientRequest } from "@/lib/api.client";
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
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );

  useEffect(() => {
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
      await queryClient.invalidateQueries({
        queryKey: ["defenseWorkspace", scheduleId],
      });
    },
    onError: () => setState("error"),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Defense Notes (Draft)</CardTitle>
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
