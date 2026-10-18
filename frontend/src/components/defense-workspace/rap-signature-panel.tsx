"use client";

/**
 * FIX-6 — Committee Report finalization + required-signature lifecycle panel.
 *
 * The faculty-facing operation is "Finalize Committee Report". Evaluator
 * completion and the Oral Examination Summary are deliberately not part of this
 * decision; those remain independent workstreams until the Chairman verdict.
 *
 * The backend still uses its freeze/version/hash internals for immutable
 * signature binding. Those implementation details are never rendered here.
 *
 * Once finalized: aggregate signature progress plus only the current user's own
 * signing state/action. The full cross-signer audit belongs to Admin Defense
 * Records. Raw signature images are never displayed and never sent to this
 * component.
 */

import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, Lock, PenLine } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiClientRequest } from "@/lib/api.client";

import { CommitteeReportSignatureDialog } from "./committee-report-signature-dialog";

export interface RapSignerStatus {
  userId: string;
  name: string;
  roleAtDefense: string;
  required: boolean;
  isSigned: boolean;
  signedAt: string | null;
}

const FROZEN_STATUSES = [
  "FOR_SIGNATURE",
  "PARTIALLY_SIGNED",
  "ALL_SIGNED",
  "DISTRIBUTED",
  "FINALIZED",
];

const FINALIZATION_ERROR =
  "The Committee Report could not be finalized. Please try again.";

export function RapSignaturePanel({
  scheduleId,
  reportStatus,
  canFinalize,
  onFinalize,
  signatureProgress,
  canSign,
  mySignature,
}: {
  scheduleId: string;
  reportStatus: string;
  canFinalize: boolean;
  /**
   * Parent-owned finalization path. The parent must drain the newest report
   * autosave before this callback sends the irreversible finalization request.
   */
  onFinalize?: () => Promise<unknown>;
  signatureProgress: { required: number; signed: number };
  canSign: boolean;
  mySignature: RapSignerStatus | null;
}) {
  const queryClient = useQueryClient();
  const [confirmingFinalize, setConfirmingFinalize] = useState(false);
  const [finalizeError, setFinalizeError] = useState<string | null>(null);
  const [signDialogOpen, setSignDialogOpen] = useState(false);
  const [signError, setSignError] = useState<string | null>(null);
  const finalizingRef = useRef(false);

  const frozen = FROZEN_STATUSES.includes(reportStatus);
  const complete =
    reportStatus === "FINALIZED" ||
    reportStatus === "ALL_SIGNED" ||
    reportStatus === "DISTRIBUTED" ||
    (signatureProgress.required > 0 &&
      signatureProgress.signed >= signatureProgress.required);
  const noSignaturesYet = signatureProgress.signed === 0;

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["committeeReport", scheduleId] });
    await queryClient.invalidateQueries({ queryKey: ["defenseWorkspace", scheduleId] });
    await queryClient.invalidateQueries({ queryKey: ["conclusionReadiness", scheduleId] });
  };

  const finalize = useMutation({
    mutationFn: async () => {
      if (!onFinalize) throw new Error(FINALIZATION_ERROR);
      return onFinalize();
    },
    onSuccess: async () => {
      setConfirmingFinalize(false);
      setFinalizeError(null);
      await invalidate();
    },
    onError: (error: Error) =>
      setFinalizeError(error.message || FINALIZATION_ERROR),
    onSettled: () => {
      finalizingRef.current = false;
    },
  });

  const requestFinalize = () => {
    if (finalizingRef.current || finalize.isPending) return;
    finalizingRef.current = true;
    finalize.mutate();
  };

  const sign = useMutation({
    mutationFn: (signatureData: string) =>
      apiClientRequest(`/thesis/defense/${scheduleId}/collaboration/report/sign`, {
        method: "POST",
        body: JSON.stringify({ signatureData }),
      }),
    onSuccess: async () => {
      setSignDialogOpen(false);
      setSignError(null);
      await invalidate();
    },
    onError: (error: Error) =>
      setSignError(error.message || "The signature could not be recorded. Please try again."),
  });

  if (!frozen) {
    return (
      <section className="shrink-0 rounded-lg border border-(--earist-border-gray) p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Lock className="h-4 w-4 text-(--earist-primary)" />
          <p className="text-[15px] font-semibold text-(--earist-primary)">
            Committee Report
          </p>
          <Badge variant="outline">Draft</Badge>
        </div>

        {!confirmingFinalize && canFinalize && (
          <Button
            type="button"
            className="mt-3"
            onClick={() => {
              setFinalizeError(null);
              setConfirmingFinalize(true);
            }}
          >
            <Lock className="mr-2 h-4 w-4" /> Finalize Committee Report
          </Button>
        )}

        {!confirmingFinalize && !canFinalize && (
          <p className="mt-2 text-[13px] text-(--earist-body-text)">
            Add report content before finalizing the Committee Report.
          </p>
        )}

        {confirmingFinalize && (
          <div className="mt-3 space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3">
            <p className="text-[14px] font-semibold text-amber-900">
              Finalize Committee Report?
            </p>
            <p className="text-[13px] text-amber-900">
              Once finalized, the report can no longer be edited. Required committee
              members can review and sign it immediately.
            </p>
            <p className="text-[13px] text-amber-900">
              Evaluations can be completed separately before the Chairman records the
              formal verdict.
            </p>
            {finalizeError && (
              <p className="flex items-center gap-1.5 text-[13px] text-red-700">
                <AlertCircle className="h-4 w-4" /> {finalizeError}
              </p>
            )}
            <div className="flex gap-2">
              <Button type="button" disabled={finalize.isPending} onClick={requestFinalize}>
                {finalize.isPending ? "Finalizing…" : "Finalize Report"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={finalize.isPending}
                onClick={() => {
                  setConfirmingFinalize(false);
                  setFinalizeError(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </section>
    );
  }

  return (
    <>
      <section className="shrink-0 rounded-lg border border-(--earist-border-gray) p-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[15px] font-semibold text-(--earist-primary)">
            Committee Report
          </p>
          {complete ? (
            <Badge className="bg-emerald-100 text-emerald-800">
              Committee Report Complete
            </Badge>
          ) : noSignaturesYet ? (
            <Badge className="bg-amber-100 text-amber-800">Ready for Signatures</Badge>
          ) : (
            <Badge className="bg-amber-100 text-amber-800">Awaiting Signatures</Badge>
          )}
        </div>
        <p className="mt-1 text-[13px] text-(--earist-body-text)">
          {signatureProgress.signed} of {signatureProgress.required} signatures completed
        </p>

        {canSign && (
          <div className="mt-3 space-y-2">
            <p className="text-[13px] text-(--earist-body-text)">
              Your signature is required. Review the finalized report before signing.
            </p>
            <Button type="button" onClick={() => setSignDialogOpen(true)}>
              <PenLine className="mr-2 h-4 w-4" /> Review & Sign
            </Button>
          </div>
        )}

        {mySignature?.isSigned && (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[13px] text-emerald-700">
            <CheckCircle2 className="h-4 w-4" />
            <Badge className="bg-emerald-100 text-emerald-800">Signed</Badge>
            {mySignature.signedAt && (
              <span>
                You signed this Committee Report on{" "}
                {new Date(mySignature.signedAt).toLocaleString()}.
              </span>
            )}
          </div>
        )}

        {signError && !signDialogOpen && (
          <p className="mt-2 flex items-center gap-1.5 text-[13px] text-red-700">
            <AlertCircle className="h-4 w-4" /> {signError}
          </p>
        )}
      </section>

      {signDialogOpen && (
        <CommitteeReportSignatureDialog
          open={signDialogOpen}
          onOpenChange={(open) => {
            setSignDialogOpen(open);
            setSignError(null);
          }}
          signPending={sign.isPending}
          signError={signError}
          onConfirm={(signatureData) => sign.mutate(signatureData)}
        />
      )}
    </>
  );
}
