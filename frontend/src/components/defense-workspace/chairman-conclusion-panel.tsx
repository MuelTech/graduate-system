"use client";

/**
 * CDW-4 FIX — concluded Defense formal result (read-only).
 *
 * The actionable Chairman verdict selector is intentionally NOT surfaced in the
 * live workspace: the canonical sequence (evaluations → Summary → Rapporteur
 * report → RAP freeze → required RAP signatures → RAP FINALIZED → verdict) is not
 * implemented until RAP-C1. For an already-concluded attempt this shows the
 * recorded result read-only.
 */

import type { DefenseWorkspace } from "@/types/defense-workspace";

export function ChairmanConclusionPanel({
  workspace,
}: {
  workspace: DefenseWorkspace;
}) {
  if (!workspace.conclusionsPresent) return null;

  return (
    <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
      <p className="text-base font-semibold text-emerald-900">Formal Result</p>
      <p className="mt-1 text-[14px] text-emerald-900">
        Recorded:{" "}
        <span className="font-semibold">{workspace.formalResult ?? "—"}</span>
      </p>
      <p className="mt-1 text-[13px] text-emerald-800">
        Read-only. This defense attempt is concluded.
      </p>
    </section>
  );
}
