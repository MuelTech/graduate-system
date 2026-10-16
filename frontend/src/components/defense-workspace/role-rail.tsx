"use client";

/**
 * CDW-4 — role-aware left rail ("what I need to do").
 *
 * Chairman/Panelist: My Evaluation (Group I/II + Recommendations, Save Draft,
 * Review, E-Sign & Finalize, locked state). Only the assigned Chairman gets the
 * Start Defense action while SCHEDULED. Rapporteur/Adviser/Facilitator get
 * role/status information only — never fabricated evaluator controls.
 *
 * The rail never exposes another evaluator's private numeric selections.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, PlayCircle, Info } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiClientRequest } from "@/lib/api.client";
import type { DefenseWorkspace } from "@/types/defense-workspace";

import { ChairmanConclusionPanel } from "./chairman-conclusion-panel";
import { ChairmanOralSummary, type OralExamSummaryDetail } from "./chairman-oral-summary";
import { DefenseRoster } from "./defense-roster";
import { OralEvaluationForm } from "./oral-evaluation-form";

const ROLE_LABELS: Record<string, string> = {
  CHAIRMAN: "Chairman",
  PANELIST: "Panelist",
  RAPPORTEUR: "Rapporteur",
  ADVISER: "Adviser",
  FACILITATOR: "Facilitator",
};

function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role;
}

function evaluationClosedMessage(sessionStatus: string): string {
  switch (sessionStatus) {
    case "SCHEDULED":
      return "Official scoring opens when the assigned Chairman starts the defense.";
    case "AWAITING_CONCLUSION":
      return "Evaluation is closed — awaiting the formal conclusion.";
    case "CONCLUDED":
      return "Evaluation is closed — this defense is concluded.";
    case "CANCELLED":
      return "This defense session was cancelled.";
    default:
      return "Official scoring is not open for this session.";
  }
}

export function RoleRail({
  workspace,
  scheduleId,
}: {
  workspace: DefenseWorkspace;
  scheduleId: string;
}) {
  const queryClient = useQueryClient();
  const role = workspace.myAssignment.role;
  const isEvaluator = workspace.capabilities.canEvaluate;

  const startDefense = useMutation({
    mutationFn: () =>
      apiClientRequest(`/thesis/defense/${scheduleId}/start`, { method: "POST" }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["defenseWorkspace", scheduleId] });
      await queryClient.invalidateQueries({ queryKey: ["oralEvaluation", scheduleId] });
    },
  });

  const isChairman = role === "CHAIRMAN";
  const showDetailedSummary = isChairman && workspace.oralSummary?.ready === true;
  const detailed = useQuery<OralExamSummaryDetail>({
    queryKey: ["oralExamSummary", scheduleId],
    enabled: showDetailedSummary,
    queryFn: async () =>
      (await apiClientRequest(
        `/thesis/defense/${scheduleId}/records/summary`,
      )) as OralExamSummaryDetail,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
  const detailedLoading = detailed.isLoading || detailed.isFetching;
  const detailedReady =
    showDetailedSummary && !detailedLoading && !detailed.error && detailed.data?.ready === true;

  const progress = workspace.evaluationProgress;
  const evaluatorProgressLabel = `${progress.finalizedEvaluations} / ${progress.evaluatorAssignments} finalized`;
  const summaryLabel = workspace.oralSummary?.ready ? "Ready" : "Not ready";

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold tracking-wide text-(--earist-body-text) uppercase">
          Your Role
        </span>
        <Badge variant="outline">{roleLabel(role)}</Badge>
      </div>

      {/* Chairman: Start Defense (any stage, SCHEDULED only). */}
      {workspace.capabilities.canStartDefense && (
        <section className="rounded border border-(--earist-border-gray) p-3">
          <p className="mb-2 text-sm font-semibold text-(--earist-primary)">Start Defense</p>
          <p className="mb-2 text-xs text-(--earist-body-text)">
            The defense has not been started. Start it to open official scoring.
          </p>
          <Button
            type="button"
            size="sm"
            disabled={startDefense.isPending}
            onClick={() => startDefense.mutate()}
          >
            <PlayCircle className="mr-2 h-4 w-4" />
            {startDefense.isPending ? "Starting…" : "Start Defense"}
          </Button>
          {startDefense.isError && (
            <p className="mt-2 text-xs text-red-600">
              {(startDefense.error as Error)?.message || "Could not start the defense."}
            </p>
          )}
        </section>
      )}

      {/* Evaluator (Chairman/Panelist): My Evaluation. */}
      {isEvaluator && (
        <section className="space-y-2">
          {workspace.capabilities.evaluationOpen ? (
            <OralEvaluationForm scheduleId={scheduleId} />
          ) : (
            <div className="rounded border border-(--earist-border-gray) p-3">
              <div className="mb-1 flex items-center justify-between">
                <p className="text-sm font-semibold text-(--earist-primary)">My Evaluation</p>
                <Badge variant="outline">
                  {workspace.evaluationStatus === "FINALIZED"
                    ? "Finalized"
                    : workspace.evaluationStatus === "DRAFT"
                      ? "Draft"
                      : "Not started"}
                </Badge>
              </div>
              <p className="flex items-start gap-2 text-xs text-(--earist-body-text)">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {evaluationClosedMessage(workspace.schedule.sessionStatus)}
              </p>
            </div>
          )}
        </section>
      )}

      {/* Rapporteur report status (CDW-5 owns authoring). */}
      {role === "RAPPORTEUR" && (
        <section className="rounded border border-(--earist-border-gray) p-3">
          <p className="mb-1 text-sm font-semibold text-(--earist-primary)">Committee Report</p>
          <p className="text-xs text-(--earist-body-text)">
            Report status: {workspace.rapStatus ?? "Not created yet"}
          </p>
          <p className="mt-1 text-xs text-(--earist-body-text)">
            Report authoring arrives in a later package.
          </p>
        </section>
      )}

      {/* Adviser / Facilitator: no fabricated academic controls. */}
      {!isEvaluator && role !== "RAPPORTEUR" && (
        <section className="rounded border border-(--earist-border-gray) p-3">
          <p className="mb-1 text-sm font-semibold text-(--earist-primary)">
            {roleLabel(role)}
          </p>
          <p className="text-xs text-(--earist-body-text)">
            {role === "FACILITATOR"
              ? "No dedicated digital action is assigned to the Facilitator in the current workflow."
              : "Read-only session view. Numerical evaluation is limited to the Chairman and Panelists."}
          </p>
        </section>
      )}

      {/* Progress — aggregate completion facts only (never private values). */}
      <section className="rounded border border-(--earist-border-gray) p-3 text-xs text-(--earist-body-text)">
        <p className="mb-1 text-sm font-semibold text-(--earist-primary)">Readiness</p>
        <p className="flex items-center gap-2">
          <CheckCircle2 className="h-3.5 w-3.5" /> Evaluations: {evaluatorProgressLabel}
        </p>
        <p>Oral Examination Summary: {summaryLabel}</p>
        <p className="mt-1 text-[11px]">
          Score completion never decides the verdict; the Chairman records it.
        </p>
      </section>

      {/* Chairman: detailed Summary + formal conclusion (own-record surfaces). */}
      {isChairman && (
        <section className="space-y-2">
          {showDetailedSummary && (
            <ChairmanOralSummary
              data={detailed.data ?? null}
              isLoading={detailedLoading}
              error={detailed.error ? (detailed.error as Error) : null}
              onRetry={() => void detailed.refetch()}
            />
          )}
          <ChairmanConclusionPanel
            scheduleId={scheduleId}
            workspace={workspace}
            detailedSummaryReady={detailedReady}
            detailedSummaryLoading={detailedLoading}
            detailedSummaryError={Boolean(detailed.error)}
          />
        </section>
      )}

      {/* Committee roster — compact, expandable. */}
      <details className="group">
        <summary className="cursor-pointer list-none rounded border border-(--earist-border-gray) px-3 py-2 text-sm font-semibold text-(--earist-primary)">
          Committee roster
        </summary>
        <div className="mt-2">
          <DefenseRoster roster={workspace.roster} />
        </div>
      </details>
    </div>
  );
}
