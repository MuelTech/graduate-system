"use client";

/**
 * FIX-6 — single-step Committee Report signature dialog.
 *
 * The finalized Committee Report is already visible in the workspace, so the
 * dialog opens directly to the drawn-signature action. Internal report
 * version/hash identifiers stay server-side. Only Confirm Signature invokes the
 * existing Committee Report signing endpoint through the parent; opening,
 * cancelling, or closing never signs anything.
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
  const [signature, setSignature] = useState("");
  const confirmingRef = useRef(false);
  const signatureReady = signature.startsWith("data:image/png;base64,");

  useEffect(() => {
    if (!signPending) confirmingRef.current = false;
  }, [signPending]);

  const close = () => {
    if (signPending) return;
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
        aria-busy={signPending || undefined}
        className="max-h-[85vh] overflow-y-auto sm:max-w-2xl"
        showCloseButton={!signPending}
      >
        <p className="sr-only" role="status" aria-live="polite">
          {signPending ? "Signing Committee Report…" : ""}
        </p>
        <DialogHeader>
          <DialogTitle>Sign Committee Report</DialogTitle>
          <DialogDescription>
            Draw your signature below. Once confirmed, your signature cannot be changed.
          </DialogDescription>
        </DialogHeader>

        <ESignaturePad
          value={signature}
          onChange={setSignature}
          disabled={signPending}
          allowTyped={false}
          autoFocus
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
            onClick={close}
          >
            Cancel
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
      </DialogContent>
    </Dialog>
  );
}
