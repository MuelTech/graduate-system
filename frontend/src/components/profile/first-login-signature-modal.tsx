"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { PenTool, ShieldCheck } from "lucide-react";
import { ESignaturePad } from "@/components/defense-workspace/e-signature-pad";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  fetchMySignatureVault,
  MY_SIGNATURE_VAULT_QUERY_KEY,
  saveMySignatureVault,
  SIGNATURE_ONBOARDING_SKIP_STORAGE_KEY,
  type SignatureCaptureMethod,
} from "@/lib/user-signature";

export function FirstLoginSignatureModal({
  portalLabel = "EARIST GSIS",
}: {
  portalLabel?: string;
}) {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const queryClient = useQueryClient();
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return (
        sessionStorage.getItem(SIGNATURE_ONBOARDING_SKIP_STORAGE_KEY) === "1"
      );
    } catch {
      return false;
    }
  });
  const [signature, setSignature] = useState("");
  const [method, setMethod] = useState<SignatureCaptureMethod>("DRAW");

  const canPrompt =
    status === "authenticated" &&
    session?.user?.mustChangePassword !== true &&
    !pathname.endsWith("/profile");

  const { data: vault, isLoading, isError } = useQuery({
    queryKey: MY_SIGNATURE_VAULT_QUERY_KEY,
    queryFn: fetchMySignatureVault,
    enabled: canPrompt && !dismissed,
    staleTime: 60_000,
    retry: false,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!signature.startsWith("data:image/png;base64,")) {
        throw new Error("Please provide a valid e-signature first.");
      }
      return saveMySignatureVault({
        signatureData: signature,
        method,
      });
    },
    onSuccess: (updatedVault) => {
      queryClient.setQueryData(MY_SIGNATURE_VAULT_QUERY_KEY, updatedVault);
      void queryClient.invalidateQueries({
        queryKey: MY_SIGNATURE_VAULT_QUERY_KEY,
      });
      setDismissed(true);
      setSignature("");
      toast.success(
        "Official e-signature saved! You can update it anytime in your Profile.",
      );
    },
    onError: (err: Error) => {
      toast.error(err.message || "Unable to save e-signature.");
    },
  });

  const handleSkip = () => {
    if (saveMutation.isPending) return;
    try {
      sessionStorage.setItem(SIGNATURE_ONBOARDING_SKIP_STORAGE_KEY, "1");
    } catch {
      // ignore storage failure
    }
    setDismissed(true);
    setSignature("");
  };

  const open =
    canPrompt &&
    !dismissed &&
    !isLoading &&
    !isError &&
    Boolean(vault && !vault.hasSignature);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) handleSkip();
      }}
    >
      <DialogContent
        className="max-h-[90vh] overflow-y-auto sm:max-w-xl"
        showCloseButton={!saveMutation.isPending}
      >
        <DialogHeader>
          <div className="flex items-center gap-2 text-[#e02b20]">
            <PenTool className="h-5 w-5" aria-hidden="true" />
            <DialogTitle className="text-[#333333]">
              Set Up Your Official E-Signature
            </DialogTitle>
          </div>
          <DialogDescription>
            Save your signature to your {portalLabel} profile once so you can
            apply it with one click across official forms and defense documents.
            You may skip this now and configure it later under Profile.
          </DialogDescription>
        </DialogHeader>

        <ESignaturePad
          value={signature}
          onChange={setSignature}
          onMethodChange={setMethod}
          allowUpload
          enableProfileVault={false}
          defaultMode="draw"
          disabled={saveMutation.isPending}
          readyText="Signature ready to save to your profile vault."
          requiredText="Draw or upload a PNG/JPEG image of your signature."
        />

        <p className="flex items-start gap-2 rounded-lg border border-gray-100 bg-gray-50 p-3 text-xs text-gray-600">
          <ShieldCheck
            className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600"
            aria-hidden="true"
          />
          <span>
            Saving your signature never signs any document automatically — each
            document will still require your explicit confirmation before signing.
          </span>
        </p>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={saveMutation.isPending}
            onClick={handleSkip}
          >
            Skip for Now
          </Button>
          <Button
            type="button"
            disabled={!signature || saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
            className="bg-[#e02b20] text-white hover:bg-[#c62828]"
          >
            {saveMutation.isPending ? "Saving…" : "Save My E-Signature"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
