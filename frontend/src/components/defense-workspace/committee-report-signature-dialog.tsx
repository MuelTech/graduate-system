"use client";

/**
 * FIX-5 / FIX-6 — focused two-step Committee Report signature dialog.
 *
 * Step 1 confirms review of the finalized Committee Report. Step 2 collects the
 * signer's drawn signature. Internal report version/hash identifiers stay
 * server-side. Only Confirm Signature invokes the existing Committee Report
 * signing endpoint through the parent; opening, cancelling, closing, or backing
 * out never signs anything.
 */

import { useEffect, useRef, useState } from "react";
import { FileSignature } from "lucide-react";

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

type Step = "review" | "sign";

export function CommitteeReportSignatureDialog({
  open,
  onOpenChange,
  signPending,
  signError,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  signPending: boolean;
  signError: string | null;
  onConfirm: (signatureData: string) => void;
}) {
  const [step, setStep] = useState<Step>("review");
  const [signature, setSignature] = useState("");
  const confirmingRef = useRef(false);
  const signatureReady = signature.startsWith("data:image/png;base64,");

  useEffect(() => {
    if (!signPending) confirmingRef.current = false;
  }, [signPending]);

  const close = () => {
    if (signPending) return;
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
    if (confirmingRef.current || signPending || !signatureReady) return;
    confirmingRef.current = true;
    onConfirm(signature);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-h-[85vh] overflow-y-auto sm:max-w-2xl"
        showCloseButton={!signPending}
      >
        {step === "review" ? (
          <>
            <DialogHeader>
              <DialogTitle>Review and Sign Committee Report</DialogTitle>
              <DialogDescription>
                Please review the finalized Committee Report before signing. Your
                signature will be recorded for this report and cannot be changed
                after confirmation.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 text-[14px] text-(--earist-body)">
              <p className="rounded-lg border border-(--earist-border-gray) bg-(--earist-surface-gray) p-3">
                Nothing is signed until you confirm your signature in the next step.
              </p>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={signPending}
                onClick={close}
              >
                Cancel
              </Button>
              <Button type="button" disabled={signPending} onClick={() => setStep("sign")}>
                Continue to Sign
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Add Your Signature</DialogTitle>
              <DialogDescription>
                Draw your signature below, then confirm to sign the Committee Report.
              </DialogDescription>
            </DialogHeader>

            <ESignaturePad
              value={signature}
              onChange={setSignature}
              disabled={signPending}
              allowTyped={false}
              readyText="Signature ready."
              requiredText="Draw your signature before confirming."
            />

            {signError && (
              <p
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 p-3 text-[14px] text-red-700"
              >
                {signError}
              </p>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={signPending}
                onClick={() => {
                  setSignature("");
                  setStep("review");
                }}
              >
                Back
              </Button>
              <Button
                type="button"
                disabled={signPending || !signatureReady}
                onClick={confirm}
              >
                <FileSignature className="mr-2 h-4 w-4" />
                {signPending ? "Signing…" : "Confirm Signature"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
