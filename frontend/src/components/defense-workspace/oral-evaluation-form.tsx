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

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  FileSignature,
  WifiOff,
} from "lucide-react";

import { apiClientRequest, ApiError } from "@/lib/api.client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  EvaluationAutosaveController,
  type EvaluationAutosaveState,
  type EvaluationDraftSnapshot,
} from "@/lib/evaluation/evaluation-autosave";
import type { OralEvaluation } from "@/types/defense-workspace";

import { EvaluationFinalizationDialog } from "./evaluation-finalization-dialog";
import {
  INSTITUTIONAL_GROUP_I,
  INSTITUTIONAL_GROUP_II,
  InstitutionalEvaluationMatrix,
  InstitutionalLegend,
} from "./institutional-evaluation-matrix";

const ALL_CRITERIA = [...INSTITUTIONAL_GROUP_I, ...INSTITUTIONAL_GROUP_II];

function evalQueryKey(scheduleId: string) {
  return ["oralEvaluation", scheduleId] as const;
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

function hasMeaningfulServerDraft(evaluation?: OralEvaluation): boolean {
  if (!evaluation) return false;
  const hasCriterion = Object.values(evaluation.criteria ?? {}).some(
    (value) => value !== null && value !== undefined,
  );
  return hasCriterion || Boolean(evaluation.recommendations?.trim());
}

function EvaluationSaveStatus({
  state,
  hasServerDraft,
}: {
  state: EvaluationAutosaveState;
  hasServerDraft: boolean;
}) {
  const label =
    state.status === "saving"
      ? "Saving…"
      : state.status === "dirty"
        ? "Unsaved changes"
        : state.status === "offline"
          ? "Offline — changes not saved"
          : state.status === "error"
            ? state.error
              ? `Save failed — ${state.error}`
              : "Save failed"
            : state.status === "clean" && !hasServerDraft
              ? "Not saved yet"
              : "Saved";

  if (state.status === "error") {
    return (
      <span
        role="alert"
        className="flex items-center gap-1.5 text-[13px] text-red-600"
      >
        <AlertCircle className="h-4 w-4" aria-hidden="true" /> {label}
      </span>
    );
  }

  if (state.status === "offline") {
    return (
      <span
        role="status"
        aria-live="polite"
        className="flex items-center gap-1.5 text-[13px] text-amber-700"
      >
        <WifiOff className="h-4 w-4" aria-hidden="true" /> {label}
      </span>
    );
  }

  if (state.status === "saved" && !state.hasUnsavedChanges) {
    return (
      <span
        role="status"
        aria-live="polite"
        className="flex items-center gap-1.5 text-[13px] text-emerald-700"
      >
        <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> {label}
      </span>
    );
  }

  return (
    <span
      role="status"
      aria-live="polite"
      className="text-[13px] text-(--earist-body-text)"
    >
      {label}
    </span>
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
  const [showFinalization, setShowFinalization] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [saveState, setSaveState] = useState<EvaluationAutosaveState>(() => ({
    status: hasMeaningfulServerDraft(evaluation) ? "saved" : "clean",
    hasUnsavedChanges: false,
    error: null,
    savedAt: null,
  }));
  const controllerRef = useRef<EvaluationAutosaveController | null>(null);
  const latestVersionRef = useRef<string | null>(evaluation?.updatedAt ?? null);

  useEffect(() => {
    const controller = controllerRef.current;
    if (!controller || controller.hasUnsavedChanges()) return;
    latestVersionRef.current = evaluation?.updatedAt ?? null;
  }, [evaluation?.updatedAt]);

  const locked = evaluation?.isLocked === true;
  const mountedLockedRef = useRef(locked);
  const displayValues = locked ? initialMatrixValues(evaluation) : values;
  const displayRecommendations = locked
    ? evaluation?.recommendations ?? ""
    : recommendations;
  const hasServerDraft = hasMeaningfulServerDraft(evaluation);

  useEffect(() => {
    if (locked) controllerRef.current?.markConflict();
  }, [locked]);

  const selectedValues = (criteria: readonly { key: string }[]): number[] =>
    criteria
      .map((criterion) => displayValues[criterion.key])
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
  const groupIAverageValue = evaluation?.groupIValue ?? groupIPreview;
  const groupIIAverageValue = evaluation?.groupIIValue ?? groupIIPreview;

  const buildCriteriaPayload = (
    source: Record<string, string> = values,
  ): Record<string, number | null> => {
    const criteria: Record<string, number | null> = {};
    for (const criterion of ALL_CRITERIA) {
      const raw = source[criterion.key];
      criteria[criterion.key] = raw === undefined || raw === "" ? null : Number(raw);
    }
    return criteria;
  };

  const buildSnapshot = (
    nextValues: Record<string, string>,
    nextRecommendations: string,
  ): EvaluationDraftSnapshot => ({
    criteria: buildCriteriaPayload(nextValues),
    recommendations: nextRecommendations,
  });

  const initialSnapshotRef = useRef<EvaluationDraftSnapshot>(
    buildSnapshot(values, recommendations),
  );
  const initialPersistedRef = useRef<boolean>(hasServerDraft);

  useEffect(() => {
    if (mountedLockedRef.current) return;

    const controller = new EvaluationAutosaveController({
      save: async (snapshot) => {
        try {
          const saved = (await apiClientRequest(
            `/thesis/defense/${scheduleId}/evaluation/draft`,
            {
              method: "PUT",
              body: JSON.stringify({
                criteria: snapshot.criteria,
                recommendations: snapshot.recommendations,
                expectedUpdatedAt: latestVersionRef.current,
              }),
            },
          )) as OralEvaluation;
          latestVersionRef.current = saved.updatedAt ?? latestVersionRef.current;
          void queryClient.invalidateQueries({
            queryKey: evalQueryKey(scheduleId),
          });
        } catch (error) {
          if (error instanceof ApiError && error.statusCode === 409) {
            // CDW-9A FIX-1: keep the local draft visible, stop automatic writes,
            // and require an explicit authoritative reload.
            controllerRef.current?.markConflict();
            setConflict(true);
            setError(null);
            setShowFinalization(false);
            void queryClient.invalidateQueries({
              queryKey: evalQueryKey(scheduleId),
            });
            void queryClient.invalidateQueries({
              queryKey: ["defenseWorkspace", scheduleId],
            });
          }
          throw error;
        }
      },
      initialSnapshot: initialSnapshotRef.current,
      initialPersisted: initialPersistedRef.current,
      debounceMs: 2000,
      maxWaitMs: 10000,
      onStateChange: setSaveState,
    });

    controllerRef.current = controller;

    if (typeof navigator !== "undefined") {
      controller.setOnline(navigator.onLine);
    }

    const onOnline = () => controller.setOnline(true);
    const onOffline = () => controller.setOnline(false);
    const flush = () => controller.flushNow();
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") controller.flushNow();
    };
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!controller.hasUnsavedChanges()) return;
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener("blur", flush);
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("blur", flush);
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      // Drain, never abandon, the newest private draft on unmount unless the
      // FINALIZED transition has already blocked the controller.
      void controller.dispose();
      if (controllerRef.current === controller) {
        controllerRef.current = null;
      }
    };
  }, [queryClient, scheduleId]);

  const loadLatestEvaluation = async () => {
    setReloading(true);
    try {
      const latest = (await queryClient.fetchQuery({
        queryKey: evalQueryKey(scheduleId),
        queryFn: async () =>
          (await apiClientRequest(
            `/thesis/defense/${scheduleId}/evaluation/me`,
          )) as OralEvaluation,
        staleTime: 0,
      })) as OralEvaluation;

      if (!latest.updatedAt) {
        throw new Error(
          "The latest saved evaluation could not be loaded. Please try again.",
        );
      }

      const nextValues = initialMatrixValues(latest);
      const nextRecommendations = latest.recommendations ?? "";
      const reconciled =
        controllerRef.current?.reconcileWithPersisted(
          buildSnapshot(nextValues, nextRecommendations),
        ) ?? true;

      if (!reconciled) {
        setError(
          "The latest saved evaluation could not be loaded while a save is in progress. Please try again.",
        );
        return;
      }

      setValues(nextValues);
      setRecommendations(nextRecommendations);
      latestVersionRef.current = latest.updatedAt;
      setConflict(false);
      setError(null);
      setMessage(
        latest.isLocked
          ? "This evaluation is finalized and locked."
          : "Latest saved evaluation loaded.",
      );
      void queryClient.invalidateQueries({
        queryKey: ["defenseWorkspace", scheduleId],
      });
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "The latest saved evaluation could not be loaded. Please try again.",
      );
    } finally {
      setReloading(false);
    }
  };

  const finalize = useMutation({
    mutationFn: async (signatureData: string) => {
      if (!signatureData.startsWith("data:image/png;base64,")) {
        throw new Error("An e-signature is required before finalizing.");
      }

      const controller = controllerRef.current;
      if (controller) {
        const settled = await controller.flushAndWait();
        if (!settled) {
          throw new Error(
            "The latest evaluation draft could not be saved. Review the save status and try again.",
          );
        }
      }

      return apiClientRequest(
        `/thesis/defense/${scheduleId}/evaluation/finalize`,
        {
          method: "POST",
          body: JSON.stringify({
            signatureData,
            criteria: buildCriteriaPayload(),
            recommendations,
            expectedUpdatedAt: latestVersionRef.current,
          }),
        },
      );
    },
    onSuccess: async () => {
      setMessage("Evaluation finalized and locked");
      setError(null);
      setConflict(false);
      setShowFinalization(false);
      await queryClient.invalidateQueries({ queryKey: evalQueryKey(scheduleId) });
      await queryClient.invalidateQueries({ queryKey: ["defenseWorkspace", scheduleId] });
    },
    onError: (e: Error) => {
      if (e instanceof ApiError && e.statusCode === 409) {
        // CDW-9A FIX-1: another tab/request may have finalized or changed this
        // evaluation. Preserve local work, block automatic writes, and require
        // an explicit authoritative reload.
        controllerRef.current?.markConflict();
        setConflict(true);
        setShowFinalization(false);
        setError(null);
        void queryClient.invalidateQueries({
          queryKey: evalQueryKey(scheduleId),
        });
        void queryClient.invalidateQueries({
          queryKey: ["defenseWorkspace", scheduleId],
        });
        return;
      }
      const extra =
        e instanceof ApiError && e.missing?.length
          ? ` ${e.missing.map((m) => m.message).join(" ")}`
          : "";
      setError((e.message || "Failed to finalize") + extra);
    },
  });

  const inputsDisabled = locked || finalize.isPending || conflict || reloading;

  return (
    <section className="rounded-lg border border-(--earist-border-gray)">
      <header className="flex items-center justify-between gap-2 border-b border-(--earist-border-gray) px-3 py-2">
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

      <div className="space-y-4 p-3">
        {message && (
          <p
            role="status"
            aria-live="polite"
            className="flex items-center gap-2 text-[14px] text-emerald-700"
          >
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> {message}
          </p>
        )}
        {error && (
          <p
            role="alert"
            className="flex items-center gap-2 break-words text-[14px] text-red-600"
          >
            <AlertCircle className="h-4 w-4" aria-hidden="true" /> {error}
          </p>
        )}

        {conflict && !locked && (
          <div
            role="alert"
            className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-3 text-[14px] text-amber-950"
          >
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                This evaluation was updated in another tab or session. Your
                unsaved changes are still here. Reload the latest saved
                evaluation before continuing.
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              disabled={reloading}
              onClick={() => void loadLatestEvaluation()}
            >
              {reloading
                ? "Reloading…"
                : "Reload latest saved evaluation"}
            </Button>
          </div>
        )}

        <InstitutionalEvaluationMatrix
          values={displayValues}
          disabled={inputsDisabled}
          onChange={(key, value) => {
            setMessage(null);
            const nextValues = { ...values, [key]: value };
            setValues(nextValues);
            controllerRef.current?.update(
              buildSnapshot(nextValues, recommendations),
            );
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
            disabled={inputsDisabled}
            rows={3}
            value={displayRecommendations}
            onChange={(e) => {
              setMessage(null);
              setRecommendations(e.target.value);
              controllerRef.current?.update(
                buildSnapshot(values, e.target.value),
              );
            }}
          />
        </label>

        {locked && (
          <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[13px] text-emerald-900">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-semibold">Evaluation finalized</p>
              <p>
                Signed{" "}
                {evaluation?.signedAt || evaluation?.finalizedAt
                  ? new Date(
                      (evaluation?.signedAt ?? evaluation?.finalizedAt) as string,
                    ).toLocaleString()
                  : "—"}
              </p>
            </div>
          </div>
        )}
      </div>

      {!locked && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-(--earist-border-gray) px-3 py-2">
          <Button
            type="button"
            variant="secondary"
            disabled={inputsDisabled}
            onClick={() => {
              setMessage(null);
              setError(null);
              setShowFinalization(true);
            }}
          >
            <FileSignature className="mr-2 h-4 w-4" />
            Review &amp; Finalize
          </Button>
          <EvaluationSaveStatus state={saveState} hasServerDraft={hasServerDraft} />
        </div>
      )}

      {showFinalization && !locked && (
        <EvaluationFinalizationDialog
          open={showFinalization}
          onOpenChange={(next) => {
            setShowFinalization(next);
            if (!next) setError(null);
          }}
          values={values}
          groupIAverage={groupIAverageValue}
          groupIIAverage={groupIIAverageValue}
          recommendations={recommendations}
          allCriteriaComplete={allCriteriaComplete}
          finalizePending={finalize.isPending}
          finalizeError={error}
          onConfirmFinalize={(signatureData) => finalize.mutate(signatureData)}
        />
      )}
    </section>
  );
}
