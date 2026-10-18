"use client";

/**
 * CDW-4 FIX — role-aware left rail ("what I need to do").
 *
 * Chairman/Panelist: My Evaluation (institutional matrix). Only the assigned
 * Chairman gets Start Defense (SCHEDULED) and a status-only Evaluation Completion
 * tracker. Rapporteur/Adviser/Facilitator get role/status information only.
 *
 * Removed from the live rail (CDW-4 FIX): the generic completion progress block,
 * the live aggregate Summary surface, and the early actionable Formal Result
 * selector. A concluded attempt still shows its recorded result read-only.
 *
 * The rail never exposes another evaluator's private numeric selections.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Info, ChevronDown, PanelLeftClose, PlayCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconTooltipButton } from "@/components/ui/tooltip";
import { apiClientRequest } from "@/lib/api.client";
import type { DefenseWorkspace } from "@/types/defense-workspace";

import { ChairmanConclusionPanel } from "./chairman-conclusion-panel";
import { ChairmanVerdictPanel } from "./chairman-verdict-panel";
import { DefenseRoster } from "./defense-roster";
import { EvaluationCompletionTracker } from "./evaluation-completion-tracker";
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
  onCollapse,
}: {
  workspace: DefenseWorkspace;
  scheduleId: string;
  onCollapse?: () => void;
}) {
  const queryClient = useQueryClient();
  const role = workspace.myAssignment.role;
  const isEvaluator = workspace.capabilities.canEvaluate;
  const isChairman = role === "CHAIRMAN";

  const startDefense = useMutation({
    mutationFn: () =>
      apiClientRequest(`/thesis/defense/${scheduleId}/start`, { method: "POST" }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["defenseWorkspace", scheduleId] });
      await queryClient.invalidateQueries({ queryKey: ["oralEvaluation", scheduleId] });
    },
  });

  const progress = workspace.evaluationProgress;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-(--earist-border-gray) px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-base font-semibold text-(--earist-primary)">
            Your Role
          </span>
          <Badge variant="outline">{roleLabel(role)}</Badge>
        </div>
        {onCollapse && (
          <IconTooltipButton label="Collapse actions panel" onClick={onCollapse}>
            <PanelLeftClose className="h-5 w-5" />
          </IconTooltipButton>
        )}
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3 [&>*]:shrink-0">
        {/* Chairman: Start Defense (any stage, SCHEDULED only). */}
        {workspace.capabilities.canStartDefense && (
          <section className="rounded-lg border border-(--earist-border-gray) p-3">
            <p className="mb-2 text-base font-semibold text-(--earist-primary)">
              Start Defense
            </p>
            <p className="mb-2 text-[14px] text-(--earist-body-text)">
              The defense has not been started. Start it to open official scoring.
            </p>
            <Button
              type="button"
              disabled={startDefense.isPending}
              onClick={() => startDefense.mutate()}
            >
              <PlayCircle className="mr-2 h-4 w-4" />
              {startDefense.isPending ? "Starting…" : "Start Defense"}
            </Button>
            {startDefense.isError && (
              <p className="mt-2 text-[14px] text-red-600">
                {(startDefense.error as Error)?.message || "Could not start the defense."}
              </p>
            )}
          </section>
        )}

        {/* Evaluator (Chairman/Panelist): My Evaluation. */}
        {isEvaluator &&
          (workspace.capabilities.evaluationOpen ? (
            <OralEvaluationForm scheduleId={scheduleId} />
          ) : (
            <section className="rounded-lg border border-(--earist-border-gray) p-3">
              <div className="mb-1 flex items-center justify-between gap-2">
                <p className="text-base font-semibold text-(--earist-primary)">
                  My Evaluation
                </p>
                <Badge variant="outline">
                  {workspace.evaluationStatus === "FINALIZED"
                    ? "Finalized"
                    : workspace.evaluationStatus === "DRAFT"
                      ? "Draft"
                      : "Not started"}
                </Badge>
              </div>
              <p className="flex items-start gap-2 text-[14px] text-(--earist-body-text)">
                <Info className="mt-0.5 h-4 w-4 shrink-0" />
                {evaluationClosedMessage(workspace.schedule.sessionStatus)}
              </p>
            </section>
          ))}

        {/* Rapporteur report status (CDW-5 owns authoring). */}
        {role === "RAPPORTEUR" && (
          <section className="rounded-lg border border-(--earist-border-gray) p-3">
            <p className="mb-1 text-base font-semibold text-(--earist-primary)">
              Committee Report
            </p>
            <p className="mt-1 text-[14px] text-(--earist-body-text)">
              Author the report in the Committee Report tab, then choose Finalize
              Committee Report when its content is ready. Required signatures are
              collected there.
            </p>
          </section>
        )}

        {/* Adviser / Facilitator: no fabricated academic controls. */}
        {!isEvaluator && role !== "RAPPORTEUR" && (
          <section className="rounded-lg border border-(--earist-border-gray) p-3">
            <p className="mb-1 text-base font-semibold text-(--earist-primary)">
              {roleLabel(role)}
            </p>
            <p className="text-[14px] text-(--earist-body-text)">
              {role === "FACILITATOR"
                ? "No dedicated digital action is assigned to the Facilitator in the current workflow."
                : "Read-only session view. Numerical evaluation is limited to the Chairman and Panelists."}
            </p>
          </section>
        )}

        {/* Chairman: status-only evaluation completion tracker. */}
        {isChairman && (
          <EvaluationCompletionTracker
            roster={workspace.roster}
            finalizedEvaluations={progress.finalizedEvaluations}
            evaluatorAssignments={progress.evaluatorAssignments}
          />
        )}

        {/* RAP-C1: Chairman formal verdict readiness + action (until concluded). */}
        {isChairman && <ChairmanVerdictPanel scheduleId={scheduleId} />}

        {/* Concluded attempts: read-only recorded result (no early verdict UI). */}
        <ChairmanConclusionPanel workspace={workspace} />

        {/* Committee roster — compact, expandable. */}
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-lg border border-(--earist-border-gray) px-3 py-2 text-[15px] font-semibold text-(--earist-primary)">
            Committee roster
            <ChevronDown
              aria-hidden="true"
              className="h-4 w-4 shrink-0 transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none"
            />
          </summary>
          <div className="mt-2">
            <DefenseRoster roster={workspace.roster} />
          </div>
        </details>
      </div>
    </div>
  );
}
