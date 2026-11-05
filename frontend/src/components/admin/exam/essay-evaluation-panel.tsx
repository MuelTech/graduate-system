"use client";

import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClientRequest } from "@/lib/api.client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SemanticText } from "@/components/exam-content/semantic-text";
import { StimulusRenderer } from "@/components/exam-content/stimulus-renderer";
import type { EssayEvaluation, ExamRecordDetail } from "@/types";
import type { ExamResult } from "@/components/exam-content/result-breakdown";
import { toast } from "sonner";

export function EssayEvaluationPanel({
  applicationId,
  evaluation,
}: {
  applicationId: string;
  evaluation: EssayEvaluation;
}) {
  const [score, setScore] = useState("");
  const saving = useRef(false);
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (): Promise<EssayEvaluation & { result: ExamResult }> =>
      apiClientRequest(`/exam/scores/${applicationId}/grade`, {
        method: "POST",
        body: JSON.stringify({ essayScore: Number(score) }),
      }),
    onSuccess: (saved) => {
      client.setQueryData<ExamRecordDetail>(
        ["examRecord", applicationId],
        (current) =>
          current
            ? {
                ...current,
                essayEvaluation: saved,
                result: saved.result,
                status: saved.result.status.toUpperCase(),
                resultEmailEligible: true,
                score: current.score
                  ? {
                      ...current.score,
                      status: saved.result.status.toUpperCase(),
                      multipleChoiceScore: Number(saved.result.mcqScore),
                      essayScore: Number(saved.result.essayScore),
                      totalScore: Number(saved.result.totalScore),
                    }
                  : null,
              }
            : current,
      );
      setScore("");
      toast.success("Essay evaluation saved and result computed.");
    },
    onError: (error: Error) =>
      toast.error(error.message || "Could not save the essay evaluation."),
    onSettled: async () => {
      // Recover an already-committed evaluation after conflicts or a lost response.
      try {
        await Promise.all([
          client.invalidateQueries({ queryKey: ["examRecord", applicationId] }),
          client.invalidateQueries({ queryKey: ["examRecords"] }),
        ]);
      } finally {
        saving.current = false;
      }
    },
  });
  if (
    !evaluation ||
    (evaluation.status !== "PENDING" && evaluation.status !== "COMPLETED")
  ) {
    return (
      <p role="status" className="text-sm text-(--earist-body-text)">
        {evaluation && "reason" in evaluation
          ? evaluation.reason
          : "Essay evaluation is unavailable. Staff review is required."}
      </p>
    );
  }
  const maximum = evaluation.maximumScore;
  const validMaximum =
    typeof maximum === "number" && Number.isFinite(maximum) && maximum > 0;
  const numericScore = Number(score);
  const error = !validMaximum
    ? "The recorded essay maximum requires staff review."
    : score.trim() === ""
      ? null
      : !Number.isFinite(numericScore)
        ? "Enter a valid number."
        : numericScore < 0
          ? "Score cannot be negative."
          : numericScore > maximum
            ? `Score cannot exceed ${maximum}.`
            : null;
  const canSave =
    evaluation.status === "PENDING" &&
    validMaximum &&
    score.trim() !== "" &&
    error === null &&
    !mutation.isPending;
  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-(--earist-secondary)">
          Question
        </h3>
        <p className="text-sm break-words whitespace-pre-wrap text-foreground">
          <SemanticText
            text={evaluation.question.questionText}
            emphasis={evaluation.question.questionTextEmphasis}
          />
        </p>
        <StimulusRenderer
          stimulusType={evaluation.question.stimulusType}
          stimulusMediaId={evaluation.question.stimulusMediaId}
          structuredStimulus={evaluation.question.structuredStimulus}
          structuredStimulusEmphasis={
            evaluation.question.structuredStimulusEmphasis
          }
        />
        <h3 className="text-sm font-semibold text-(--earist-secondary)">
          Applicant response
        </h3>
        <div className="rounded-lg border border-(--earist-border-gray) bg-(--earist-surface-gray) p-3">
          <p className="text-sm break-words whitespace-pre-wrap text-foreground">
            {evaluation.responseText?.trim()
              ? evaluation.responseText
              : "No response submitted."}
          </p>
        </div>
      </div>
      {evaluation.status === "COMPLETED" ? (
        <dl className="grid gap-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-muted-foreground">Score</dt>
            <dd className="font-medium">
              {evaluation.essayScore} / {maximum}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Evaluated by</dt>
            <dd className="break-words">
              {evaluation.evaluator
                ? `${evaluation.evaluator.firstName} ${evaluation.evaluator.lastName}`
                : "Not recorded"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Evaluated on</dt>
            <dd>
              {evaluation.evaluatedAt
                ? new Date(evaluation.evaluatedAt).toLocaleString("en-PH", {
                    timeZone: "Asia/Manila",
                    dateStyle: "medium",
                    timeStyle: "short",
                  })
                : "Not recorded"}
            </dd>
          </div>
        </dl>
      ) : (
        <div className="space-y-3">
          <label
            htmlFor="essay-score"
            className="block text-sm font-medium text-(--earist-secondary)"
          >
            Essay Score
          </label>
          <div className="flex items-center gap-2">
            <Input
              id="essay-score"
              type="number"
              inputMode="decimal"
              min={0}
              max={validMaximum ? maximum : undefined}
              step="any"
              value={score}
              onChange={(event) => setScore(event.target.value)}
              disabled={!validMaximum || mutation.isPending}
              className="w-28 text-center"
              aria-invalid={error !== null}
              aria-describedby={
                error ? "essay-score-error" : "essay-score-guidance"
              }
              placeholder="0"
            />
            {validMaximum ? <span>/ {maximum}</span> : null}
          </div>
          <p
            id="essay-score-guidance"
            className="text-xs text-(--earist-body-text)"
          >
            Saving records a final essay evaluation. Direct regrading is
            unavailable.
          </p>
          {error ? (
            <p
              id="essay-score-error"
              role="alert"
              className="text-xs text-destructive"
            >
              {error}
            </p>
          ) : null}
          <Button
            disabled={!canSave}
            onClick={() => {
              if (!canSave || saving.current) return;
              saving.current = true;
              mutation.mutate();
            }}
          >
            {mutation.isPending ? "Saving…" : "Save Essay Evaluation"}
          </Button>
        </div>
      )}
    </div>
  );
}
