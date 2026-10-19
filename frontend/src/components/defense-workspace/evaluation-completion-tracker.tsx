"use client";

/**
 * CDW-4 FIX — Chairman-only Evaluation Completion tracker.
 *
 * Deliberately status-only: it shows workflow progress (Not started / Draft /
 * Finalized) and NEVER another evaluator's private criterion values, derived
 * figures, written notes, or e-sign evidence (evaluator privacy).
 */

import { Badge } from "@/components/ui/badge";
import type { DefenseWorkspace } from "@/types/defense-workspace";

const STATUS_LABEL: Record<string, string> = {
  NOT_STARTED: "Not started",
  DRAFT: "Draft",
  FINALIZED: "Finalized",
  NONE: "Not required",
};

function statusClasses(status: string): string {
  if (status === "FINALIZED") return "border-emerald-300 text-emerald-700";
  if (status === "DRAFT") return "border-amber-300 text-amber-700";
  return "text-(--earist-body-text)";
}

export function EvaluationCompletionTracker({
  roster,
  finalizedEvaluations,
  evaluatorAssignments,
}: {
  roster: DefenseWorkspace["roster"];
  finalizedEvaluations: number;
  evaluatorAssignments: number;
}) {
  // Numerical evaluators only (Chairman + Panelists).
  const evaluators = roster.filter(
    (member) => member.role === "CHAIRMAN" || member.role === "PANELIST",
  );

  return (
    <section className="rounded-lg border border-(--earist-border-gray) p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-base font-semibold text-(--earist-primary)">
          Evaluation Completion
        </p>
        <span className="text-[13px] text-(--earist-body-text)">
          {finalizedEvaluations} / {evaluatorAssignments} finalized
        </span>
      </div>
      <ul className="space-y-1.5">
        {evaluators.map((member) => (
          <li key={member.userId} className="flex items-center justify-between gap-2">
            <span className="truncate text-[14px] text-(--earist-body)">
              {member.name}
            </span>
            <Badge variant="outline" className={statusClasses(member.evaluationStatus)}>
              {STATUS_LABEL[member.evaluationStatus] ?? member.evaluationStatus}
            </Badge>
          </li>
        ))}
      </ul>
    </section>
  );
}
