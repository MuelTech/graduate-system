"use client";

/**
 * RAP-C1 — Chairman formal-verdict readiness + action.
 *
 * The Chairman can record the formal verdict ONLY once the full canonical
 * pre-conclusion sequence is complete: required evaluations finalized, Oral
 * Examination Summary ready, Committee Report frozen, all required RAP signatures
 * present, and the RAP FINALIZED. Readiness comes from the server-authoritative
 * conclusion-readiness endpoint; this component never derives a verdict from a
 * score. Allowed results remain exactly PASSED / REDEFENSE_REQUIRED.
 */

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, Gavel } from "lucide-react";

import { Button } from "@/components/ui/button";
import { apiClientRequest } from "@/lib/api.client";

interface ConclusionReadiness {
  scheduleId: string;
  isChairman: boolean;
  concluded: boolean;
  evaluatorAssignments: number;
  finalizedEvaluations: number;
  allEvaluationsFinalized: boolean;
  oralSummaryExists: boolean;
  reportExists: boolean;
  reportFrozen: boolean;
  reportFinalized: boolean;
  requiredSignatures: number;
  signedSignatures: number;
  allSignaturesSigned: boolean;
  blockers: string[];
  readyForConclusion: boolean;
}

export function ChairmanVerdictPanel({ scheduleId }: { scheduleId: string }) {
  const queryClient = useQueryClient();
  const [outcome, setOutcome] = useState("PASSED");
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data } = useQuery<ConclusionReadiness>({
    queryKey: ["conclusionReadiness", scheduleId],
    queryFn: async () =>
      (await apiClientRequest(
        `/thesis/defense/${scheduleId}/collaboration/conclusion-readiness`,
      )) as ConclusionReadiness,
    refetchInterval: 15000,
    retry: 1,
  });

  const conclude = useMutation({
    mutationFn: () =>
      apiClientRequest(`/thesis/defense/${scheduleId}/conclusion`, {
        method: "POST",
        body: JSON.stringify({ outcome }),
      }),
    onSuccess: async () => {
      setConfirming(false);
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ["defenseWorkspace", scheduleId] });
      await queryClient.invalidateQueries({ queryKey: ["conclusionReadiness", scheduleId] });
    },
    onError: (error: Error) => setError(error.message || "Could not record the verdict."),
  });

  if (!data || !data.isChairman || data.concluded) return null;

  const evaluationComplete = data.allEvaluationsFinalized;
  const reportPending = data.requiredSignatures <= 0;
  const reportComplete = !reportPending && data.allSignaturesSigned;
  const readinessRows = [
    {
      label: "Evaluation Signatures",
      value: `${data.finalizedEvaluations} of ${data.evaluatorAssignments} completed`,
      ok: evaluationComplete,
    },
    {
      label: "Committee Report Signatures",
      value: reportPending
        ? "Waiting for report"
        : `${data.signedSignatures} of ${data.requiredSignatures} completed`,
      ok: reportComplete,
    },
  ];

  return (
    <section className="rounded-lg border border-(--earist-border-gray) p-3">
      <p className="mb-1 text-base font-semibold text-(--earist-primary)">Formal Verdict</p>
      <ul className="space-y-1 text-[13px]">
        {readinessRows.map((row) => (
          <li key={row.label} className="flex items-center gap-2">
            {row.ok ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            ) : (
              <span className="inline-block h-3.5 w-3.5 shrink-0 rounded-full border border-(--earist-border-gray)" />
            )}
            <span className={row.ok ? "text-(--earist-body-text)" : "text-amber-700"}>
              {row.label} — {row.value}
            </span>
          </li>
        ))}
      </ul>

      {data.readyForConclusion && (
        <div className="mt-3 space-y-2">
          {!confirming ? (
            <>
              <label className="block text-[13px] text-(--earist-body-text)">
                Formal result
                <select
                  aria-label="Formal result"
                  value={outcome}
                  onChange={(event) => setOutcome(event.target.value)}
                  className="mt-1 block w-full rounded-md border border-(--earist-border-gray) px-2 py-1.5 text-[14px]"
                >
                  <option value="PASSED">PASSED</option>
                  <option value="REDEFENSE_REQUIRED">Re-defense Required</option>
                </select>
              </label>
              <Button type="button" onClick={() => setConfirming(true)}>
                <Gavel className="mr-2 h-4 w-4" /> Record Formal Verdict
              </Button>
            </>
          ) : (
            <>
              <p className="text-[14px] text-amber-900">
                Record{" "}
                <span className="font-semibold">
                  {outcome === "PASSED" ? "PASSED" : "Re-defense Required"}
                </span>{" "}
                for this attempt? The defense becomes CONCLUDED and read-only.
              </p>
              {error && (
                <p className="flex items-center gap-1.5 text-[13px] text-red-700">
                  <AlertCircle className="h-4 w-4" /> {error}
                </p>
              )}
              <div className="flex gap-2">
                <Button type="button" disabled={conclude.isPending} onClick={() => conclude.mutate()}>
                  {conclude.isPending ? "Recording…" : "Confirm Verdict"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={conclude.isPending}
                  onClick={() => {
                    setConfirming(false);
                    setError(null);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {error && !confirming && (
        <p className="mt-2 flex items-center gap-1.5 text-[13px] text-red-700">
          <AlertCircle className="h-4 w-4" /> {error}
        </p>
      )}
    </section>
  );
}
