"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClientRequest, ApiError } from "@/lib/api.client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertCircle,
  CheckCircle2,
  FileSignature,
  Save,
  Eye,
} from "lucide-react";
import { ESignaturePad } from "@/components/defense-workspace/e-signature-pad";
import type { OralEvaluation } from "@/types/defense-workspace";

const GROUP_I = [
  { key: "timelinessRelevance", label: "Timeliness & Relevance", max: 10 },
  { key: "organization", label: "Organization", max: 10 },
  { key: "depthComprehensiveness", label: "Depth & Comprehensiveness", max: 15 },
  { key: "relevanceConclusions", label: "Relevance of Conclusions", max: 10 },
  { key: "evidenceOriginalThinking", label: "Evidence of Original Thinking", max: 15 },
] as const;

const GROUP_II = [
  { key: "presentation", label: "Presentation", max: 10 },
  { key: "masterySubject", label: "Mastery of Subject", max: 10 },
  { key: "communicationSkill", label: "Communication Skill", max: 10 },
  { key: "attitude", label: "Attitude / Receptiveness", max: 10 },
] as const;

const RATINGS = ["E", "HS", "VS", "S", "BS", "F"] as const;

function evalQueryKey(scheduleId: string) {
  return ["oralEvaluation", scheduleId] as const;
}

export function OralEvaluationForm({ scheduleId }: { scheduleId: string }) {
  const queryClient = useQueryClient();
  const [values, setValues] = useState<Record<string, string>>({});
  const [rating, setRating] = useState("");
  const [ratingTouched, setRatingTouched] = useState(false);
  const [recommendations, setRecommendations] = useState("");
  const [signature, setSignature] = useState("");
  const [dirty, setDirty] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: evaluation, isLoading } = useQuery({
    queryKey: evalQueryKey(scheduleId),
    queryFn: async () =>
      (await apiClientRequest(
        `/thesis/defense/${scheduleId}/evaluation/me`,
      )) as OralEvaluation,
  });

  // Restore server Draft without overwriting dirty local edits.
  useEffect(() => {
    if (!evaluation || dirty) return;
    const next: Record<string, string> = {};
    for (const [k, v] of Object.entries(evaluation.criteria ?? {})) {
      next[k] = v === null || v === undefined ? "" : String(v);
    }
    setValues(next);
    setRating(evaluation.rating ?? "");
    setRatingTouched(false);
    setRecommendations(evaluation.recommendations ?? "");
    setDirty(false);
  }, [evaluation]);

  const locked = evaluation?.isLocked === true;

  const parseCriteria = () => {
    const criteria: Record<string, number | null> = {};
    for (const item of [...GROUP_I, ...GROUP_II]) {
      const raw = values[item.key];
      if (raw === undefined || raw === "") continue;
      criteria[item.key] = Number(raw);
    }
    return criteria;
  };

  const localPreview = useMemo(() => {
    const g1 = GROUP_I.reduce((s, c) => s + (Number(values[c.key]) || 0), 0);
    const g2 = GROUP_II.reduce((s, c) => s + (Number(values[c.key]) || 0), 0);
    return { g1, g2, overall: g1 + g2 };
  }, [values]);

  const saveDraft = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        criteria: parseCriteria(),
      };
      // CP6-FIX1: explicit clear sends null; omitted preserves server value.
      if (ratingTouched) {
        body.rating = rating === "" ? null : rating;
      }
      if (recommendations !== (evaluation?.recommendations ?? "")) {
        body.recommendations = recommendations;
      }
      return apiClientRequest(`/thesis/defense/${scheduleId}/evaluation/draft`, {
        method: "PUT",
        body: JSON.stringify(body),
      });
    },
    onSuccess: async () => {
      setMessage("Draft saved");
      setError(null);
      setDirty(false);
      setRatingTouched(false);
      await queryClient.invalidateQueries({ queryKey: evalQueryKey(scheduleId) });
    },
    onError: (e: Error) => setError(e.message),
  });

  const finalize = useMutation({
    mutationFn: async () => {
      return apiClientRequest(
        `/thesis/defense/${scheduleId}/evaluation/finalize`,
        {
          method: "POST",
          body: JSON.stringify({
            signatureData: signature,
            criteria: parseCriteria(),
            ...(ratingTouched ? { rating: rating === "" ? null : rating } : {}),
            recommendations,
          }),
        },
      );
    },
    onSuccess: async () => {
      setMessage("Evaluation finalized and locked");
      setError(null);
      setShowReview(false);
      setDirty(false);
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

  const renderField = (item: { key: string; label: string; max: number }) => (
    <label key={item.key} className="block text-xs">
      <span className="mb-1 block font-medium text-(--earist-secondary)">
        {item.label}{" "}
        <span className="text-(--earist-body-text)">(max {item.max})</span>
      </span>
      <input
        type="number"
        min={0}
        max={item.max}
        disabled={locked}
        value={values[item.key] ?? ""}
        onChange={(e) => {
          setDirty(true);
          setValues((prev) => ({ ...prev, [item.key]: e.target.value }));
        }}
        className="w-full rounded border border-(--earist-border-gray) px-2 py-1.5 text-sm"
      />
    </label>
  );

  if (isLoading && !evaluation) {
    return (
      <Card>
        <CardContent className="pt-6 text-sm text-(--earist-body-text)">
          Loading evaluation…
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-sm">
          <span>My Evaluation</span>
          <Badge
            className={
              locked
                ? "bg-emerald-100 text-emerald-800"
                : "bg-amber-100 text-amber-800"
            }
          >
            {locked ? "FINALIZED" : "DRAFT"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {message && (
          <p className="flex items-center gap-2 text-xs text-emerald-700">
            <CheckCircle2 className="h-4 w-4" /> {message}
          </p>
        )}
        {error && (
          <p className="flex items-center gap-2 text-xs text-red-600">
            <AlertCircle className="h-4 w-4" /> {error}
          </p>
        )}

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-(--earist-body-text)">
            Group I
          </p>
          <div className="grid gap-2 sm:grid-cols-2">{GROUP_I.map(renderField)}</div>
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-(--earist-body-text)">
            Group II
          </p>
          <div className="grid gap-2 sm:grid-cols-2">{GROUP_II.map(renderField)}</div>
        </div>

        <div className="flex flex-wrap gap-3 text-xs">
          <span>
            Group I:{" "}
            <strong>{evaluation?.groupIValue ?? localPreview.g1}</strong>
          </span>
          <span>
            Group II:{" "}
            <strong>{evaluation?.groupIIValue ?? localPreview.g2}</strong>
          </span>
          <span>
            Overall:{" "}
            <strong>{evaluation?.overallValue ?? localPreview.overall}</strong>
          </span>
          <span className="text-(--earist-body-text)">
            (server values are authoritative)
          </span>
        </div>

        <label className="block text-xs">
          <span className="mb-1 block font-medium text-(--earist-secondary)">
            Rating (optional)
          </span>
          <select
            disabled={locked}
            value={rating}
            onChange={(e) => {
              setDirty(true);
              setRatingTouched(true);
              setRating(e.target.value);
            }}
            className="w-full rounded border border-(--earist-border-gray) px-2 py-1.5 text-sm"
          >
            <option value="">—</option>
            {RATINGS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-xs">
          <span className="mb-1 block font-medium text-(--earist-secondary)">
            Recommendations
          </span>
          <Textarea
            disabled={locked}
            rows={3}
            value={recommendations}
            onChange={(e) => {
              setDirty(true);
              setRecommendations(e.target.value);
            }}
          />
        </label>

        {locked ? (
          <div className="rounded border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
            <p className="font-semibold">This evaluation is locked.</p>
            <p>
              Signed: {evaluation?.signedAt ? new Date(evaluation.signedAt).toLocaleString() : "—"}
            </p>
            <p>
              Finalized:{" "}
              {evaluation?.finalizedAt
                ? new Date(evaluation.finalizedAt).toLocaleString()
                : "—"}
            </p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={saveDraft.isPending}
              onClick={() => saveDraft.mutate()}
            >
              <Save className="mr-2 h-4 w-4" />
              {saveDraft.isPending ? "Saving..." : "Save Draft"}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setShowReview(true)}>
              <Eye className="mr-2 h-4 w-4" />
              Review &amp; Finalize
            </Button>
          </div>
        )}

        {showReview && !locked && (
          <div className="rounded border border-(--earist-border-gray) p-3 text-xs">
            <p className="mb-2 font-semibold text-(--earist-primary)">
              Review Evaluation (irreversible after finalize)
            </p>
            <ul className="mb-2 list-disc space-y-1 pl-5 text-(--earist-body-text)">
              <li>
                Group I: {[...GROUP_I].map((c) => `${c.label}=${values[c.key] ?? "—"}`).join(", ")}{" "}
                → {localPreview.g1}
              </li>
              <li>
                Group II: {[...GROUP_II].map((c) => `${c.label}=${values[c.key] ?? "—"}`).join(", ")}{" "}
                → {localPreview.g2}
              </li>
              <li>Overall: {localPreview.overall}</li>
              <li>Rating: {rating || "—"}</li>
              <li>Recommendations: {recommendations || "—"}</li>
            </ul>
            <p className="mb-2 text-xs text-(--earist-body-text)">
              Final server values are recalculated on submission.
            </p>
            <ESignaturePad value={signature} onChange={setSignature} disabled={locked} />
            <div className="flex gap-2">
              <Button
                type="button"
                disabled={finalize.isPending || !signature.trim()}
                onClick={() => finalize.mutate()}
              >
                <FileSignature className="mr-2 h-4 w-4" />
                Confirm Finalize
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowReview(false)}
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
