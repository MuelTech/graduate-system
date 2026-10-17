"use client";

/**
 * RAP-C1 — Committee Report freeze + required-signature lifecycle panel.
 *
 * Rapporteur (pre-freeze): an explicit readiness checklist and a NON-casual
 * two-step "Freeze for Signatures" confirmation that states what freezing locks.
 *
 * Once frozen: version + signature progress + the required signer roster (name,
 * role, Pending/Signed, timestamp) and, for a required unsigned signer, a Sign
 * action that e-signs the EXACT frozen artifact. Raw signature images are never
 * displayed and are never sent to this component.
 *
 * The report must be authored in-system; there is no Word/DOCX upload path.
 */

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, Lock, PenLine } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiClientRequest } from "@/lib/api.client";

import { ESignaturePad } from "./e-signature-pad";

export interface RapFreezeCheck {
  key: string;
  label: string;
  ok: boolean;
}

export interface RapSignerStatus {
  userId: string;
  name: string;
  roleAtDefense: string;
  required: boolean;
  isSigned: boolean;
  signedAt: string | null;
}

const ROLE_LABELS: Record<string, string> = {
  CHAIRMAN: "Chairman",
  PANELIST: "Panelist",
  RAPPORTEUR: "Rapporteur",
  ADVISER: "Adviser",
  FACILITATOR: "Facilitator",
};

const FROZEN_STATUSES = [
  "FOR_SIGNATURE",
  "PARTIALLY_SIGNED",
  "ALL_SIGNED",
  "DISTRIBUTED",
  "FINALIZED",
];

function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role;
}

export function RapSignaturePanel({
  scheduleId,
  reportStatus,
  contentVersion,
  canFreeze,
  freezeReadiness,
  signatures,
  signatureProgress,
  canSign,
  mySignature,
}: {
  scheduleId: string;
  reportStatus: string;
  contentVersion: number;
  canFreeze: boolean;
  freezeReadiness: { ready: boolean; checks: RapFreezeCheck[] };
  signatures: RapSignerStatus[];
  signatureProgress: { required: number; signed: number };
  canSign: boolean;
  mySignature: RapSignerStatus | null;
}) {
  const queryClient = useQueryClient();
  const [confirmingFreeze, setConfirmingFreeze] = useState(false);
  const [freezeError, setFreezeError] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);
  const [signature, setSignature] = useState("");
  const [signError, setSignError] = useState<string | null>(null);

  const frozen = FROZEN_STATUSES.includes(reportStatus);
  const finalized = reportStatus === "FINALIZED";

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["committeeReport", scheduleId] });
    await queryClient.invalidateQueries({ queryKey: ["defenseWorkspace", scheduleId] });
    await queryClient.invalidateQueries({ queryKey: ["conclusionReadiness", scheduleId] });
  };

  const freeze = useMutation({
    mutationFn: () =>
      apiClientRequest(`/thesis/defense/${scheduleId}/collaboration/report/freeze`, {
        method: "POST",
      }),
    onSuccess: async () => {
      setConfirmingFreeze(false);
      setFreezeError(null);
      await invalidate();
    },
    onError: (error: Error) => setFreezeError(error.message || "Freeze failed."),
  });

  const sign = useMutation({
    mutationFn: () =>
      apiClientRequest(`/thesis/defense/${scheduleId}/collaboration/report/sign`, {
        method: "POST",
        body: JSON.stringify({ signatureData: signature }),
      }),
    onSuccess: async () => {
      setSigning(false);
      setSignature("");
      setSignError(null);
      await invalidate();
    },
    onError: (error: Error) => setSignError(error.message || "Signature failed."),
  });

  if (!frozen) {
    return (
      <section className="shrink-0 rounded-lg border border-(--earist-border-gray) p-3">
        <div className="mb-2 flex items-center gap-2">
          <Lock className="h-4 w-4 text-(--earist-primary)" />
          <p className="text-[15px] font-semibold text-(--earist-primary)">
            Committee Report readiness
          </p>
        </div>
        <ul className="space-y-1 text-[13px]">
          {freezeReadiness.checks.map((check) => (
            <li key={check.key} className="flex items-center gap-2">
              {check.ok ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              ) : (
                <span className="inline-block h-3.5 w-3.5 shrink-0 rounded-full border border-(--earist-border-gray)" />
              )}
              <span className={check.ok ? "text-(--earist-body-text)" : "text-amber-700"}>
                {check.label}
              </span>
            </li>
          ))}
        </ul>

        {canFreeze && !confirmingFreeze && (
          <Button type="button" className="mt-3" onClick={() => setConfirmingFreeze(true)}>
            <Lock className="mr-2 h-4 w-4" /> Freeze for Signatures
          </Button>
        )}
        {!canFreeze && !confirmingFreeze && (
          <p className="mt-2 text-[13px] text-(--earist-body-text)">
            Freeze for Signatures becomes available once every requirement above is complete.
          </p>
        )}

        {confirmingFreeze && (
          <div className="mt-3 space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3">
            <p className="text-[14px] font-semibold text-amber-900">
              Freeze this report for signatures?
            </p>
            <ul className="list-disc space-y-1 pl-5 text-[13px] text-amber-900">
              <li>The report becomes read-only.</li>
              <li>Academic manuscript comments become read-only.</li>
              <li>The required committee members will sign this exact frozen version.</li>
              <li>
                Further changes require a future explicit revision workflow — this frozen
                snapshot is not edited.
              </li>
            </ul>
            {freezeError && (
              <p className="flex items-center gap-1.5 text-[13px] text-red-700">
                <AlertCircle className="h-4 w-4" /> {freezeError}
              </p>
            )}
            <div className="flex gap-2">
              <Button type="button" disabled={freeze.isPending} onClick={() => freeze.mutate()}>
                {freeze.isPending ? "Freezing…" : "Confirm Freeze"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={freeze.isPending}
                onClick={() => {
                  setConfirmingFreeze(false);
                  setFreezeError(null);
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
    <section className="shrink-0 rounded-lg border border-(--earist-border-gray) p-3">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <p className="text-[15px] font-semibold text-(--earist-primary)">
          Frozen Report — Version {contentVersion || 1}
        </p>
        {finalized ? (
          <Badge className="bg-emerald-100 text-emerald-800">RAP finalized</Badge>
        ) : (
          <Badge className="bg-amber-100 text-amber-800">Awaiting signatures</Badge>
        )}
      </div>
      <p className="text-[13px] text-(--earist-body-text)">
        Required signatures: {signatureProgress.signed} of {signatureProgress.required} complete.
      </p>

      <ul className="mt-2 space-y-1 text-[13px]">
        {signatures.map((signer) => (
          <li key={signer.userId} className="flex items-center justify-between gap-2">
            <span className="text-(--earist-body-text)">
              {signer.name || "—"}{" "}
              <span className="opacity-70">({roleLabel(signer.roleAtDefense)})</span>
            </span>
            {signer.isSigned ? (
              <span className="flex items-center gap-1 text-emerald-700">
                <CheckCircle2 className="h-3.5 w-3.5" /> Signed
                {signer.signedAt ? ` ${new Date(signer.signedAt).toLocaleString()}` : ""}
              </span>
            ) : (
              <span className="text-amber-700">Pending</span>
            )}
          </li>
        ))}
      </ul>

      {canSign && !signing && (
        <Button type="button" className="mt-3" onClick={() => setSigning(true)}>
          <PenLine className="mr-2 h-4 w-4" /> Sign / E-Sign
        </Button>
      )}
      {!canSign && mySignature?.isSigned && (
        <p className="mt-2 flex items-center gap-1.5 text-[13px] text-emerald-700">
          <CheckCircle2 className="h-4 w-4" /> You signed this report
          {mySignature.signedAt ? ` on ${new Date(mySignature.signedAt).toLocaleString()}` : ""}.
        </p>
      )}
      {!canSign && !mySignature && !finalized && (
        <p className="mt-2 text-[13px] text-(--earist-body-text)">
          Only the required committee signers can sign this report.
        </p>
      )}

      {signing && (
        <div className="mt-3 space-y-2">
          <ESignaturePad value={signature} onChange={setSignature} disabled={sign.isPending} />
          {signError && (
            <p className="flex items-center gap-1.5 text-[13px] text-red-700">
              <AlertCircle className="h-4 w-4" /> {signError}
            </p>
          )}
          <div className="flex gap-2">
            <Button
              type="button"
              disabled={!signature.startsWith("data:image/") || sign.isPending}
              onClick={() => sign.mutate()}
            >
              {sign.isPending ? "Signing…" : "Confirm Signature"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={sign.isPending}
              onClick={() => {
                setSigning(false);
                setSignature("");
                setSignError(null);
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
