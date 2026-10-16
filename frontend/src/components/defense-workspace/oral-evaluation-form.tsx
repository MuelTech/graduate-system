"use client";

/**
 * CDW-4 FIX — My Evaluation (institutional individual evaluation).
 *
 * New records use the institutional 1.00–2.50 matrix (INSTITUTIONAL_MATRIX_V2):
 * the whole cell is the radio target, the Legend is always visible, Group I/II
 * AVERAGES are shown, and there is deliberately NO Overall value and NO Rating
 * input (the institutional Overall/Rating formulas are not yet confirmed).
 *
 * Legacy rows (LEGACY_POINTS_V1) are shown READ-ONLY with an explicit notice and
 * are never reinterpreted as institutional ratings.
 */

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, FileSignature, Save, Eye } from "lucide-react";

import { apiClientRequest, ApiError } from "@/lib/api.client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ESignaturePad } from "@/components/defense-workspace/e-signature-pad";
import type { OralEvaluation } from "@/types/defense-workspace";

import {
  INSTITUTIONAL_GROUP_I,
  INSTITUTIONAL_GROUP_II,
  INSTITUTIONAL_RATING_LEVELS,
  InstitutionalEvaluationMatrix,
  InstitutionalLegend,
} from "./institutional-evaluation-matrix";

const ALL_CRITERIA = [...INSTITUTIONAL_GROUP_I, ...INSTITUTIONAL_GROUP_II];

function evalQueryKey(scheduleId: string) {
  return ["oralEvaluation", scheduleId] as const;
}

function levelLabel(raw: string): string {
  const value = Number(raw);
  const level = INSTITUTIONAL_RATING_LEVELS.find((l) => l.value === value);
  if (!level) return raw;
  return `${level.value.toFixed(2)} ${level.code}`;
}

function initialMatrixValues(evaluation?: OralEvaluation): Record<string, string> {
  const next: Record<string, string> = {};
  for (const criterion of ALL_CRITERIA) {
    const raw = evaluation?.criteria?.[criterion.key];
    next[criterion.key] = raw === null || raw === undefined ? "" : String(raw);
  }
  return next;
}

export function OralEvaluationForm({ scheduleId }: { scheduleId: string }) {
  const { data: evaluation, isLoading } = useQuery({
    queryKey: evalQueryKey(scheduleId),
    queryFn: async () =>
      (await apiClientRequest(
        `/thesis/defense/${scheduleId}/evaluation/me`,
      )) as OralEvaluation,
  });

  if (isLoading && !evaluation) {
    return (
      <p className="rounded-lg border border-(--earist-border-gray) p-4 text-sm text-(--earist-body-text)">
        Loading evaluation…
      </p>
    );
  }

  // Remount per schedule so the server Draft seeds local form state exactly once.
  return (
    <EvaluationEditor
      key={scheduleId}
      scheduleId={scheduleId}
      evaluation={evaluation}
    />
  );
}

function EvaluationEditor({
  scheduleId,
  evaluation,
}: {
  scheduleId: string;
  evaluation?: OralEvaluation;
}) {
  if (evaluation && evaluation.scoringVersion === "LEGACY_POINTS_V1") {
    return <LegacyEvaluationNotice evaluation={evaluation} />;
  }
  return <MatrixEvaluationEditor scheduleId={scheduleId} evaluation={evaluation} />;
}

/** Legacy 10/15-point rows are read-only in the new workspace. */
function LegacyEvaluationNotice({ evaluation }: { evaluation: OralEvaluation }) {
  return (
    <section className="rounded-lg border border-amber-300 bg-amber-50 p-3">
      <p className="text-base font-semibold text-amber-900">
        Legacy scoring (10/15-point)
      </p>
      <p className="mt-1 text-[14px] text-amber-900">
        This evaluation was recorded under the previous 10/15-point model and is
        shown read-only. Its stored values are <strong>not</strong> the
        institutional 1.00–2.50 ratings and are not converted. New evaluations use
        the institutional matrix.
      </p>
      <dl className="mt-2 space-y-1 text-[14px] text-amber-950">
        {ALL_CRITERIA.map((criterion) => (
          <div key={criterion.key} className="flex items-center justify-between gap-3">
            <dt>{criterion.label}</dt>
            <dd className="font-medium">{evaluation.criteria?.[criterion.key] ?? "—"}</dd>
          </div>
        ))}
        <div className="flex items-center justify-between gap-3 border-t border-amber-200 pt-1">
          <dt className="font-semibold">Group I (points)</dt>
          <dd className="font-semibold">{evaluation.groupIValue ?? "—"}</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="font-semibold">Group II (points)</dt>
          <dd className="font-semibold">{evaluation.groupIIValue ?? "—"}</dd>
        </div>
      </dl>
      {evaluation.recommendations && (
        <p className="mt-2 text-[14px] whitespace-pre-wrap text-amber-950">
          Recommendations: {evaluation.recommendations}
        </p>
      )}
      {evaluation.isLocked && (
        <p className="mt-2 text-[13px] text-amber-800">
          Finalized{" "}
          {evaluation.finalizedAt
            ? new Date(evaluation.finalizedAt).toLocaleString()
            : ""}
        </p>
      )}
    </section>
  );
}

function MatrixEvaluationEditor({
  scheduleId,
  evaluation,
}: {
  scheduleId: string;
  evaluation?: OralEvaluation;
}) {
  const queryClient = useQueryClient();
  const [values, setValues] = useState<Record<string, string>>(() =>
    initialMatrixValues(evaluation),
  );
  const [recommendations, setRecommendations] = useState(
    evaluation?.recommendations ?? "",
  );
  const [signature, setSignature] = useState("");
  const [showReview, setShowReview] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const locked = evaluation?.isLocked === true;

  const selectedValues = (criteria: readonly { key: string }[]): number[] =>
    criteria
      .map((criterion) => values[criterion.key])
      .filter((raw) => raw !== undefined && raw !== "")
      .map(Number)
      .filter((value) => Number.isFinite(value));

  const previewAverage = (criteria: readonly { key: string }[]): number | null => {
    const nums = selectedValues(criteria);
    if (nums.length === 0) return null;
    return nums.reduce((a, b) => a + b, 0) / nums.length;
  };

  const groupIComplete =
    selectedValues(INSTITUTIONAL_GROUP_I).length === INSTITUTIONAL_GROUP_I.length;
  const groupIIComplete =
    selectedValues(INSTITUTIONAL_GROUP_II).length === INSTITUTIONAL_GROUP_II.length;
  const allCriteriaComplete = groupIComplete && groupIIComplete;

  // Server values are authoritative once present; otherwise show an explicitly
  // labelled incomplete local preview.
  const groupIPreview = previewAverage(INSTITUTIONAL_GROUP_I);
  const groupIIPreview = previewAverage(INSTITUTIONAL_GROUP_II);

  const buildCriteriaPayload = (): Record<string, number | null> => {
    const criteria: Record<string, number | null> = {};
    for (const criterion of ALL_CRITERIA) {
      const raw = values[criterion.key];
      criteria[criterion.key] = raw === undefined || raw === "" ? null : Number(raw);
    }
    return criteria;
  };

  const saveDraft = useMutation({
    mutationFn: async () =>
      apiClientRequest(`/thesis/defense/${scheduleId}/evaluation/draft`, {
        method: "PUT",
        body: JSON.stringify({
          criteria: buildCriteriaPayload(),
          recommendations,
        }),
      }),
    onSuccess: async () => {
      setMessage("Draft saved");
      setError(null);
      await queryClient.invalidateQueries({ queryKey: evalQueryKey(scheduleId) });
    },
    onError: (e: Error) => setError(e.message),
  });

  const finalize = useMutation({
    mutationFn: async () =>
      apiClientRequest(`/thesis/defense/${scheduleId}/evaluation/finalize`, {
        method: "POST",
        body: JSON.stringify({
          signatureData: signature,
          criteria: buildCriteriaPayload(),
          recommendations,
        }),
      }),
    onSuccess: async () => {
      setMessage("Evaluation finalized and locked");
      setError(null);
      setShowReview(false);
      await queryClient.invalidateQueries({ queryKey: evalQueryKey(scheduleId) });
      await queryClient.invalidateQueries({ queryKey: ["defenseWorkspace", scheduleId] });
    },
    onError: (e: Error) => {
      const extra =
        e instanceof ApiError && e.missing?.length
          ? ` ${e.missing.map((m) => m.message).join(" ")}`
          : "";
      setError((e.message || "Failed to finalize") + extra);
    },
  });

  return (
    <section className="flex min-h-0 flex-col rounded-lg border border-(--earist-border-gray)">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-(--earist-border-gray) px-3 py-2">
        <span className="text-base font-semibold text-(--earist-primary)">
          My Evaluation
        </span>
        <Badge
          className={
            locked
              ? "bg-emerald-100 text-emerald-800"
              : "bg-amber-100 text-amber-800"
          }
        >
          {locked ? "FINALIZED" : "DRAFT"}
        </Badge>
      </header>

      <div className="min-h-0 flex-1 space-y-4 p-3">
        {message && (
          <p className="flex items-center gap-2 text-[14px] text-emerald-700">
            <CheckCircle2 className="h-4 w-4" /> {message}
          </p>
        )}
        {error && (
          <p className="flex items-center gap-2 text-[14px] text-red-600">
            <AlertCircle className="h-4 w-4" /> {error}
          </p>
        )}

        <InstitutionalEvaluationMatrix
          values={values}
          disabled={locked}
          onChange={(key, value) => {
            setMessage(null);
            setValues((prev) => ({ ...prev, [key]: value }));
          }}
        />

        <div className="flex flex-wrap gap-x-6 gap-y-1 text-[14px] text-(--earist-body)">
          <span>
            Group I Average:{" "}
            <strong>
              {evaluation?.groupIValue != null
                ? evaluation.groupIValue.toFixed(2)
                : groupIPreview != null
                  ? groupIPreview.toFixed(2)
                  : "—"}
            </strong>
            {evaluation?.groupIValue == null && !groupIComplete && groupIPreview != null && (
              <span className="ml-1 text-[13px] text-(--earist-body-text)">
                (incomplete)
              </span>
            )}
          </span>
          <span>
            Group II Average:{" "}
            <strong>
              {evaluation?.groupIIValue != null
                ? evaluation.groupIIValue.toFixed(2)
                : groupIIPreview != null
                  ? groupIIPreview.toFixed(2)
                  : "—"}
            </strong>
            {evaluation?.groupIIValue == null && !groupIIComplete && groupIIPreview != null && (
              <span className="ml-1 text-[13px] text-(--earist-body-text)">
                (incomplete)
              </span>
            )}
          </span>
        </div>

        <InstitutionalLegend />

        <label className="block">
          <span className="mb-1 block text-[14px] font-medium text-(--earist-secondary)">
            Recommendations
          </span>
          <Textarea
            disabled={locked}
            rows={3}
            value={recommendations}
            onChange={(e) => {
              setMessage(null);
              setRecommendations(e.target.value);
            }}
          />
        </label>

        {locked && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-[14px] text-emerald-900">
            <p className="font-semibold">This evaluation is locked.</p>
            <p>
              Signed:{" "}
              {evaluation?.signedAt
                ? new Date(evaluation.signedAt).toLocaleString()
                : "—"}
            </p>
            <p>
              Finalized:{" "}
              {evaluation?.finalizedAt
                ? new Date(evaluation.finalizedAt).toLocaleString()
                : "—"}
            </p>
          </div>
        )}

        {showReview && !locked && (
          <div className="rounded-lg border border-(--earist-border-gray) p-3 text-[14px]">
            <p className="mb-2 font-semibold text-(--earist-primary)">
              Review Evaluation (irreversible after finalize)
            </p>
            <ul className="mb-2 list-disc space-y-1 pl-5 text-(--earist-body-text)">
              {ALL_CRITERIA.map((criterion) => (
                <li key={criterion.key}>
                  {criterion.label}: {values[criterion.key] ? levelLabel(values[criterion.key]) : "—"}
                </li>
              ))}
              <li>Group I Average: {groupIPreview != null ? groupIPreview.toFixed(2) : "—"}</li>
              <li>Group II Average: {groupIIPreview != null ? groupIIPreview.toFixed(2) : "—"}</li>
              <li>Recommendations: {recommendations || "—"}</li>
            </ul>
            {!allCriteriaComplete && (
              <p className="mb-2 font-medium text-amber-700">
                Incomplete — all nine criteria are required before finalization.
              </p>
            )}
            <ESignaturePad value={signature} onChange={setSignature} disabled={locked} />
            <div className="mt-2 flex gap-2">
              <Button
                type="button"
                disabled={
                  finalize.isPending ||
                  !signature.startsWith("data:image/png;base64,") ||
                  !allCriteriaComplete
                }
                onClick={() => finalize.mutate()}
              >
                <FileSignature className="mr-2 h-4 w-4" />
                Confirm Finalize
              </Button>
              <Button type="button" variant="ghost" onClick={() => setShowReview(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Sticky actions stay reachable while the criteria list scrolls. */}
      {!locked && (
        <footer className="sticky bottom-0 flex shrink-0 flex-wrap gap-2 border-t border-(--earist-border-gray) bg-white/95 px-3 py-2 backdrop-blur motion-reduce:backdrop-blur-none">
          <Button
            type="button"
            variant="outline"
            disabled={saveDraft.isPending}
            onClick={() => saveDraft.mutate()}
          >
            <Save className="mr-2 h-4 w-4" />
            {saveDraft.isPending ? "Saving…" : "Save Draft"}
          </Button>
          <Button type="button" variant="secondary" onClick={() => setShowReview(true)}>
            <Eye className="mr-2 h-4 w-4" />
            {"Review & Finalize"}
          </Button>
        </footer>
      )}
    </section>
  );
}
