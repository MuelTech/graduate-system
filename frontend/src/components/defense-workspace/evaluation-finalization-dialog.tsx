"use client";

/**
 * CDW-LIVE-1 MANUAL-QA FIX-2 — focused two-step evaluator finalization.
 *
 * Step 1 reviews the current private DRAFT. Step 2 collects the evaluator's
 * explicit e-signature. Only Confirm Finalize invokes the existing finalize
 * endpoint (through the parent); opening/back/cancel never finalize anything.
 */

import { useEffect, useRef, useState } from "react";
import { FileSignature } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { ESignaturePad } from "./e-signature-pad";
import {
  INSTITUTIONAL_GROUP_I,
  INSTITUTIONAL_GROUP_II,
  INSTITUTIONAL_RATING_LEVELS,
} from "./institutional-evaluation-matrix";

type Step = "review" | "sign";

function formatRating(raw: string): string {
  if (!raw) return "—";
  const value = Number(raw);
  const level = INSTITUTIONAL_RATING_LEVELS.find((entry) => entry.value === value);
  return level
    ? `${value.toFixed(2)} ${level.code} · ${level.label}`
    : raw;
}

function averageLabel(value: number | null): string {
  return value === null ? "—" : value.toFixed(2);
}

function CriteriaReview({
  title,
  criteria,
  values,
}: {
  title: string;
  criteria: readonly { key: string; label: string }[];
  values: Record<string, string>;
}) {
  return (
    <section className="space-y-1.5">
      <h3 className="text-[13px] font-semibold uppercase tracking-wide text-(--earist-secondary)">
        {title}
      </h3>
      <dl className="divide-y divide-(--earist-border-gray) rounded-lg border border-(--earist-border-gray)">
        {criteria.map((criterion) => (
          <div
            key={criterion.key}
            className="flex items-start justify-between gap-3 px-3 py-2 text-[14px]"
          >
            <dt className="text-(--earist-body)">{criterion.label}</dt>
            <dd className="shrink-0 font-medium text-(--earist-primary)">
              {formatRating(values[criterion.key] ?? "")}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function EvaluationFinalizationDialog({
  open,
  onOpenChange,
  values,
  groupIAverage,
  groupIIAverage,
  recommendations,
  allCriteriaComplete,
  finalizePending,
  finalizeError,
  onConfirmFinalize,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  values: Record<string, string>;
  groupIAverage: number | null;
  groupIIAverage: number | null;
  recommendations: string;
  allCriteriaComplete: boolean;
  finalizePending: boolean;
  finalizeError: string | null;
  onConfirmFinalize: (signatureData: string) => void;
}) {
  const [step, setStep] = useState<Step>("review");
  const [signature, setSignature] = useState("");
  const confirmingRef = useRef(false);
  const signatureReady = signature.startsWith("data:image/png;base64,");

  useEffect(() => {
    if (!finalizePending) confirmingRef.current = false;
  }, [finalizePending]);

  const close = () => {
    if (finalizePending) return;
    setStep("review");
    setSignature("");
    onOpenChange(false);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      close();
      return;
    }
    onOpenChange(true);
  };

  const confirm = () => {
    if (
      confirmingRef.current ||
      finalizePending ||
      !signatureReady ||
      !allCriteriaComplete
    ) {
      return;
    }
    confirmingRef.current = true;
    onConfirmFinalize(signature);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-h-[85vh] overflow-y-auto sm:max-w-2xl"
        showCloseButton={!finalizePending}
      >
        {step === "review" ? (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <DialogTitle>Review Evaluation</DialogTitle>
                <Badge variant="outline">Step 1 of 2</Badge>
              </div>
              <DialogDescription>
                Review your official individual evaluation. Nothing is finalized
                yet — the next step collects your e-signature.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <CriteriaReview
                title="Group I"
                criteria={INSTITUTIONAL_GROUP_I}
                values={values}
              />
              <p className="text-[14px] text-(--earist-body)">
                Group I Average:{" "}
                <strong>{averageLabel(groupIAverage)}</strong>
              </p>

              <CriteriaReview
                title="Group II"
                criteria={INSTITUTIONAL_GROUP_II}
                values={values}
              />
              <p className="text-[14px] text-(--earist-body)">
                Group II Average:{" "}
                <strong>{averageLabel(groupIIAverage)}</strong>
              </p>

              <section className="space-y-1">
                <h3 className="text-[13px] font-semibold uppercase tracking-wide text-(--earist-secondary)">
                  Recommendations
                </h3>
                <p className="whitespace-pre-wrap rounded-lg border border-(--earist-border-gray) p-3 text-[14px] text-(--earist-body)">
                  {recommendations || "—"}
                </p>
              </section>

              {!allCriteriaComplete && (
                <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-[14px] text-amber-900">
                  All nine criteria are required before finalization. Return to the
                  evaluation and complete the remaining selections.
                </p>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={finalizePending}
                onClick={close}
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={finalizePending || !allCriteriaComplete}
                onClick={() => setStep("sign")}
              >
                Continue to Sign
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <DialogTitle>Sign Your Evaluation</DialogTitle>
                <Badge variant="outline">Step 2 of 2</Badge>
              </div>
              <DialogDescription>
                By signing and finalizing, you confirm that this evaluation is
                complete. This action cannot be undone.
              </DialogDescription>
            </DialogHeader>

            <ESignaturePad
              value={signature}
              onChange={setSignature}
              disabled={finalizePending}
              allowTyped={false}
            />

            {finalizeError && (
              <p
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 p-3 text-[14px] text-red-700"
              >
                {finalizeError}
              </p>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={finalizePending}
                onClick={() => {
                  setSignature("");
                  setStep("review");
                }}
              >
                Back
              </Button>
              <Button
                type="button"
                disabled={finalizePending || !signatureReady || !allCriteriaComplete}
                onClick={confirm}
              >
                <FileSignature className="mr-2 h-4 w-4" />
                {finalizePending ? "Finalizing…" : "Confirm Finalize"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
