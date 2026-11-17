"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BookmarkCheck, BookmarkPlus, CheckCircle2, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  fetchMySignatureVault,
  formatSignatureMethodLabel,
  MY_SIGNATURE_VAULT_QUERY_KEY,
  normalizeUploadedSignatureImage,
  saveMySignatureVault,
  type BackgroundCleanupStrength,
  type SignatureCaptureMethod,
} from "@/lib/user-signature";

/**
 * CP6-FIX3 + §6 Vault: shared e-signature input supporting Draw,
 * Image Upload (normalized to PNG), and optional Profile Signature Vault reuse.
 * Applying a saved signature fills this input only and never auto-submits forms.
 */
export function ESignaturePad({
  value,
  onChange,
  onMethodChange,
  disabled,
  allowUpload = true,
  enableProfileVault = true,
  defaultMode = "draw",
  autoFocus = false,
  readyText = "Signature ready for evaluation finalize.",
  requiredText = "Signature required before finalize.",
}: {
  value: string;
  onChange: (signatureData: string) => void;
  onMethodChange?: (method: SignatureCaptureMethod) => void;
  disabled?: boolean;
  /** Allow uploading a PNG or JPEG signature image (normalized onto canvas as PNG). */
  allowUpload?: boolean;
  /** Show "Use My Saved Signature" & "Save to My Profile Vault" integration. */
  enableProfileVault?: boolean;
  /** Initial signature mode ("draw" or "upload"; defaults to "draw"). */
  defaultMode?: "draw" | "upload";
  /** Focus the signature canvas when it mounts (e.g. after moving to Sign). */
  autoFocus?: boolean;
  /** Optional caller-specific helper copy; defaults preserve Evaluation signing. */
  readyText?: string;
  requiredText?: string;
}) {
  const queryClient = useQueryClient();
  const initialMode: "draw" | "upload" =
    defaultMode === "upload" && allowUpload ? "upload" : "draw";
  const [mode, setMode] = useState<"draw" | "upload">(initialMode);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedName, setUploadedName] = useState<string | null>(null);
  const [removeBg, setRemoveBg] = useState(true);
  const [bgStrength, setBgStrength] =
    useState<BackgroundCleanupStrength>("standard");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [hasDrawn, setHasDrawn] = useState(false);
  const instructionsId = useId();
  const statusId = useId();

  // Gesture authority — must not depend on render-time React state.
  const drawingRef = useRef(false);
  const strokeStartedRef = useRef(false);
  const onChangeRef = useRef(onChange);
  const disabledRef = useRef(disabled);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);
  useEffect(() => {
    disabledRef.current = disabled;
  }, [disabled]);

  const vaultQuery = useQuery({
    queryKey: MY_SIGNATURE_VAULT_QUERY_KEY,
    queryFn: fetchMySignatureVault,
    enabled: enableProfileVault,
    staleTime: 60_000,
    retry: false,
  });

  const savedVault = enableProfileVault ? vaultQuery.data : undefined;
  const savedSignatureData =
    savedVault?.hasSignature && savedVault.signatureData
      ? savedVault.signatureData
      : null;

  const isDataUrl = (v: string) => v.startsWith("data:image/png;base64,");
  const isUsingSaved = Boolean(
    savedSignatureData && value === savedSignatureData && isDataUrl(value),
  );

  const saveToVaultMutation = useMutation({
    mutationFn: async () => {
      if (!isDataUrl(value)) {
        throw new Error("Please provide a valid signature first.");
      }
      const method: SignatureCaptureMethod =
        mode === "upload" ? "UPLOAD" : "DRAW";
      return saveMySignatureVault({ signatureData: value, method });
    },
    onSuccess: (updatedVault) => {
      queryClient.setQueryData(MY_SIGNATURE_VAULT_QUERY_KEY, updatedVault);
      void queryClient.invalidateQueries({
        queryKey: MY_SIGNATURE_VAULT_QUERY_KEY,
      });
      toast.success(
        `Signature saved to your profile vault (v${updatedVault.version}).`,
      );
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to save signature to your profile.");
    },
  });

  useEffect(() => {
    if (!autoFocus || disabled || isUsingSaved || mode !== "draw") return;
    canvasRef.current?.focus();
  }, [autoFocus, disabled, isUsingSaved, mode]);

  const resetLocalInputs = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawingRef.current = false;
    strokeStartedRef.current = false;
    setHasDrawn(false);
    setUploadedFile(null);
    setUploadedName(null);
    setUploadError(null);
  };

  const switchMode = (next: "draw" | "upload") => {
    if (mode === next && !isUsingSaved) return;
    setMode(next);
    onMethodChange?.(next === "upload" ? "UPLOAD" : "DRAW");
    resetLocalInputs();
    onChangeRef.current("");
  };

  // CP6-FIX3: pointer listeners use stable refs; no hasDrawn in deps.
  useEffect(() => {
    if (mode !== "draw" || isUsingSaved) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#111827";

    const pos = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      // Canvas coordinates are intrinsic; the CSS surface is larger in the modal.
      const scaleX = r.width === 0 ? 1 : canvas.width / r.width;
      const scaleY = r.height === 0 ? 1 : canvas.height / r.height;
      return {
        x: (e.clientX - r.left) * scaleX,
        y: (e.clientY - r.top) * scaleY,
      };
    };

    const finishStroke = () => {
      if (!drawingRef.current) return;
      drawingRef.current = false;
      if (strokeStartedRef.current) {
        setHasDrawn(true);
        onChangeRef.current(canvas.toDataURL("image/png"));
      } else {
        setHasDrawn(false);
        onChangeRef.current("");
      }
      strokeStartedRef.current = false;
    };

    const down = (e: PointerEvent) => {
      if (disabledRef.current) return;
      drawingRef.current = true;
      strokeStartedRef.current = false;
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        // capture is best-effort
      }
      const p = pos(e);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
    };
    const move = (e: PointerEvent) => {
      if (!drawingRef.current || disabledRef.current) return;
      const p = pos(e);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      strokeStartedRef.current = true;
      setHasDrawn(true);
    };

    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", finishStroke);
    canvas.addEventListener("pointerleave", finishStroke);
    canvas.addEventListener("pointercancel", finishStroke);
    return () => {
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", finishStroke);
      canvas.removeEventListener("pointerleave", finishStroke);
      canvas.removeEventListener("pointercancel", finishStroke);
    };
  }, [isUsingSaved, mode]);

  const clear = () => {
    resetLocalInputs();
    onChangeRef.current("");
  };

  const applySavedSignature = () => {
    if (!savedSignatureData || disabled) return;
    resetLocalInputs();
    onChangeRef.current(savedSignatureData);
  };

  const processUploadedFile = async (
    file: File,
    nextRemoveBg: boolean,
    nextStrength: BackgroundCleanupStrength,
  ) => {
    setUploadError(null);
    setUploadBusy(true);
    try {
      const pngDataUrl = await normalizeUploadedSignatureImage(file, {
        removeBackground: nextRemoveBg,
        strength: nextStrength,
      });
      setUploadedFile(file);
      setUploadedName(file.name);
      onMethodChange?.("UPLOAD");
      onChangeRef.current(pngDataUrl);
    } catch (err) {
      setUploadedFile(null);
      setUploadedName(null);
      onChangeRef.current("");
      setUploadError(
        err instanceof Error ? err.message : "Unable to process image file.",
      );
    } finally {
      setUploadBusy(false);
    }
  };

  const handleToggleRemoveBg = (checked: boolean) => {
    setRemoveBg(checked);
    if (uploadedFile) {
      void processUploadedFile(uploadedFile, checked, bgStrength);
    }
  };

  const handleSelectStrength = (nextStrength: BackgroundCleanupStrength) => {
    setBgStrength(nextStrength);
    if (uploadedFile && removeBg) {
      void processUploadedFile(uploadedFile, removeBg, nextStrength);
    }
  };

  const isValid =
    isUsingSaved ||
    (mode === "upload" && Boolean(uploadedName) && isDataUrl(value)) ||
    (mode === "draw" && hasDrawn && isDataUrl(value));

  return (
    <div className="space-y-3 rounded-lg border border-(--earist-border-gray) p-3">
      {enableProfileVault && savedSignatureData && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-gray-200 bg-gray-50/80 p-2.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <img
              src={savedSignatureData}
              alt="Saved profile signature"
              className="h-10 max-w-[140px] rounded border border-gray-200 bg-white object-contain px-1.5"
            />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-[#333333]">
                Saved Profile Signature (v{savedVault?.version ?? 1})
              </p>
              <p className="text-[11px] text-gray-500">
                {formatSignatureMethodLabel(savedVault?.method)} signature on
                file
              </p>
            </div>
          </div>
          {isUsingSaved ? (
            <div className="flex items-center gap-2">
              <Badge className="border border-emerald-200 bg-emerald-50 text-emerald-700">
                <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                Using Saved Signature
              </Badge>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={disabled}
                onClick={clear}
              >
                Draw / Upload Different
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={disabled}
              onClick={applySavedSignature}
              className="border-[#e02b20]/40 text-[#e02b20] hover:bg-[#e02b20]/5"
            >
              <BookmarkCheck className="mr-1.5 h-4 w-4" />
              Use My Saved Signature
            </Button>
          )}
        </div>
      )}

      {!isUsingSaved && (
        <>
          <div className="flex flex-wrap gap-2">
            {allowUpload && (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant={mode === "draw" ? "default" : "outline"}
                  disabled={disabled}
                  onClick={() => switchMode("draw")}
                >
                  Draw
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={mode === "upload" ? "default" : "outline"}
                  disabled={disabled}
                  onClick={() => switchMode("upload")}
                >
                  Upload PNG/JPEG
                </Button>
              </>
            )}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="ml-auto"
              disabled={disabled}
              onClick={clear}
            >
              Clear
            </Button>
          </div>

          {mode === "draw" && (
            <div className="space-y-1">
              <p className="text-[13px] font-medium text-(--earist-secondary)">
                Draw your signature
              </p>
              <p
                id={instructionsId}
                className="text-[12px] text-(--earist-body-text)"
              >
                Use a pointer or touch device to draw, or upload a PNG/JPEG
                signature image.
              </p>
            </div>
          )}

          {allowUpload && mode === "upload" ? (
            <div className="space-y-3 rounded border border-dashed border-gray-300 bg-gray-50/60 p-4 text-center">
              <input
                ref={uploadInputRef}
                type="file"
                accept=".png,.jpg,.jpeg,image/png,image/jpeg"
                className="hidden"
                disabled={disabled || uploadBusy}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    void processUploadedFile(file, removeBg, bgStrength);
                  }
                  e.target.value = "";
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled || uploadBusy}
                onClick={() => uploadInputRef.current?.click()}
              >
                <Upload className="mr-1.5 h-4 w-4" />
                {uploadBusy
                  ? "Processing image…"
                  : uploadedName
                    ? `Selected: ${uploadedName}`
                    : "Choose Signature Image (PNG / JPEG)"}
              </Button>
              <p className="text-[11px] text-gray-500">
                Maximum 1 MB. Photos of signatures on paper are automatically
                cropped and made transparent.
              </p>

              <div className="flex flex-col items-center gap-2 border-t border-gray-200/80 pt-3 text-xs">
                <label className="inline-flex cursor-pointer items-center gap-2 font-medium text-[#333333]">
                  <input
                    type="checkbox"
                    checked={removeBg}
                    disabled={disabled || uploadBusy}
                    onChange={(e) => handleToggleRemoveBg(e.target.checked)}
                    className="h-3.5 w-3.5 accent-[#e02b20]"
                  />
                  Auto-remove paper background (transparent PNG)
                </label>

                {removeBg && uploadedFile && (
                  <div className="flex flex-wrap items-center justify-center gap-1.5">
                    <span className="text-[11px] text-gray-500">
                      Cleanup intensity:
                    </span>
                    {(["light", "standard", "strong"] as const).map((level) => (
                      <Button
                        key={level}
                        type="button"
                        size="sm"
                        variant={bgStrength === level ? "default" : "outline"}
                        disabled={disabled || uploadBusy}
                        onClick={() => handleSelectStrength(level)}
                        className="h-6 px-2 text-[11px] capitalize"
                      >
                        {level}
                      </Button>
                    ))}
                  </div>
                )}
              </div>

              {uploadError && (
                <p role="alert" className="text-xs font-medium text-red-600">
                  {uploadError}
                </p>
              )}
            </div>
          ) : (
            <canvas
              ref={canvasRef}
              width={720}
              height={240}
              tabIndex={disabled ? -1 : 0}
              aria-label="Signature drawing area"
              aria-describedby={`${instructionsId} ${statusId}`}
              aria-disabled={disabled || undefined}
              className={`h-auto w-full touch-none rounded border bg-white focus-visible:ring-2 focus-visible:ring-(--earist-primary)/40 focus-visible:outline-none ${
                disabled ? "opacity-60" : "border-(--earist-border-gray)"
              }`}
            />
          )}
        </>
      )}

      <div
        id={statusId}
        role="status"
        aria-live="polite"
        className="space-y-2 text-xs text-(--earist-body-text)"
      >
        {isUsingSaved ? (
          <p className="font-medium text-emerald-700">
            Saved signature applied — {readyText}
          </p>
        ) : isValid ? (
          <p>{readyText}</p>
        ) : (
          <p>{requiredText}</p>
        )}

        {isValid && isDataUrl(value) && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <img
              src={value}
              alt="Signature preview"
              className="h-12 border border-(--earist-border-gray) bg-white bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:8px_8px] object-contain px-2"
            />
            {enableProfileVault && value !== savedSignatureData && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={disabled || saveToVaultMutation.isPending}
                onClick={() => saveToVaultMutation.mutate()}
              >
                <BookmarkPlus className="mr-1.5 h-3.5 w-3.5" />
                {saveToVaultMutation.isPending
                  ? "Saving to Profile…"
                  : "Save to My Profile Vault"}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
