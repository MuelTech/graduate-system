"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CircleAlert,
  PenTool,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { ESignaturePad } from "@/components/defense-workspace/e-signature-pad";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  deleteMySignatureVault,
  fetchMySignatureVault,
  formatSignatureMethodLabel,
  MY_SIGNATURE_VAULT_QUERY_KEY,
  saveMySignatureVault,
  type SignatureCaptureMethod,
} from "@/lib/user-signature";

export function SignatureVaultCard() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [draftSignature, setDraftSignature] = useState("");
  const [draftMethod, setDraftMethod] = useState<SignatureCaptureMethod>("DRAW");

  const {
    data: vault,
    isLoading,
    isError,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: MY_SIGNATURE_VAULT_QUERY_KEY,
    queryFn: fetchMySignatureVault,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!draftSignature.startsWith("data:image/png;base64,")) {
        throw new Error("Please provide a valid signature before saving.");
      }
      return saveMySignatureVault({
        signatureData: draftSignature,
        method: draftMethod,
      });
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(MY_SIGNATURE_VAULT_QUERY_KEY, updated);
      void queryClient.invalidateQueries({
        queryKey: MY_SIGNATURE_VAULT_QUERY_KEY,
      });
      setEditing(false);
      setConfirmRemove(false);
      setDraftSignature("");
      toast.success(
        `Your official e-signature has been saved (Version ${updated.version}).`,
      );
    },
    onError: (err: Error) => {
      toast.error(err.message || "Unable to save e-signature.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteMySignatureVault,
    onSuccess: (emptyVault) => {
      queryClient.setQueryData(MY_SIGNATURE_VAULT_QUERY_KEY, emptyVault);
      void queryClient.invalidateQueries({
        queryKey: MY_SIGNATURE_VAULT_QUERY_KEY,
      });
      setConfirmRemove(false);
      setEditing(false);
      toast.success("Saved e-signature removed from your profile vault.");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Unable to remove saved e-signature.");
    },
  });

  const startEditing = () => {
    setDraftSignature("");
    setDraftMethod("DRAW");
    setConfirmRemove(false);
    setEditing(true);
  };

  const formattedDate = vault?.updatedAt
    ? new Date(vault.updatedAt).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : null;

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-base font-bold text-[#333333]">
            <PenTool className="h-4 w-4 text-[#e02b20]" aria-hidden="true" />
            Official E-Signature Vault
          </CardTitle>
          <p className="text-xs text-gray-500">
            Save your signature once and apply it with explicit confirmation
            across eligible forms. Updating this signature never alters
            previously signed documents.
          </p>
        </div>
        {vault?.hasSignature && (
          <Badge className="border border-emerald-200 bg-emerald-50 text-emerald-700">
            Version {vault.version}
          </Badge>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="space-y-3" aria-busy="true">
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-9 w-48" />
          </div>
        ) : isError || !vault ? (
          <div className="flex flex-col items-start gap-2 rounded-xl border border-gray-100 bg-gray-50/70 p-4">
            <p className="flex items-center gap-2 text-sm text-gray-600">
              <CircleAlert
                className="h-4 w-4 text-[#e02b20]"
                aria-hidden="true"
              />
              Unable to load your saved e-signature.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isFetching}
              onClick={() => void refetch()}
            >
              <RefreshCw
                className={`mr-1.5 h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`}
                aria-hidden="true"
              />
              Retry
            </Button>
          </div>
        ) : editing ? (
          <div className="space-y-3 rounded-xl border border-gray-200 bg-gray-50/60 p-4">
            <ESignaturePad
              value={draftSignature}
              onChange={setDraftSignature}
              onMethodChange={setDraftMethod}
              allowTyped
              allowUpload
              enableProfileVault={false}
              defaultMode="draw"
              disabled={saveMutation.isPending}
              readyText="Signature ready to save to your profile vault."
              requiredText="Draw, type, or upload a PNG/JPEG image of your signature."
            />
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={saveMutation.isPending}
                onClick={() => {
                  setEditing(false);
                  setDraftSignature("");
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={!draftSignature || saveMutation.isPending}
                onClick={() => saveMutation.mutate()}
                className="bg-[#e02b20] text-white hover:bg-[#c62828]"
              >
                {saveMutation.isPending
                  ? "Saving…"
                  : vault.hasSignature
                    ? "Save New Version"
                    : "Save E-Signature"}
              </Button>
            </div>
          </div>
        ) : vault.hasSignature && vault.signatureData ? (
          <div className="space-y-4">
            <div className="flex flex-col gap-4 rounded-xl border border-gray-100 bg-gray-50/70 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex h-24 w-56 items-center justify-center rounded-lg border border-gray-200 bg-white p-2 shadow-2xs">
                  <img
                    src={vault.signatureData}
                    alt="Your saved official e-signature"
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
                <div className="space-y-1 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-[#333333]">
                      Active Profile Signature
                    </span>
                    <Badge variant="outline">
                      {formatSignatureMethodLabel(vault.method)}
                    </Badge>
                  </div>
                  {formattedDate && (
                    <p className="text-gray-500">Last updated: {formattedDate}</p>
                  )}
                  <p className="flex items-center gap-1 text-emerald-700">
                    <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                    Ready for one-click apply with explicit confirmation
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={deleteMutation.isPending}
                  onClick={startEditing}
                >
                  Replace Signature
                </Button>
                {!confirmRemove ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={deleteMutation.isPending}
                    onClick={() => setConfirmRemove(true)}
                    className="text-red-600 hover:bg-red-50 hover:text-red-700"
                  >
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                    Remove
                  </Button>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={deleteMutation.isPending}
                      onClick={() => setConfirmRemove(false)}
                    >
                      Keep
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      disabled={deleteMutation.isPending}
                      onClick={() => deleteMutation.mutate()}
                      className="bg-red-600 text-white hover:bg-red-700"
                    >
                      {deleteMutation.isPending ? "Removing…" : "Confirm Remove"}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-start justify-between gap-4 rounded-xl border border-dashed border-gray-300 bg-gray-50/50 p-5 sm:flex-row sm:items-center">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-[#333333]">
                No saved e-signature yet
              </p>
              <p className="text-xs text-gray-500">
                Create or upload your official signature now so you don&apos;t
                have to redraw it for every document.
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={startEditing}
              className="shrink-0 bg-[#e02b20] text-white hover:bg-[#c62828]"
            >
              <PenTool className="mr-1.5 h-4 w-4" />
              Set Up E-Signature
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
