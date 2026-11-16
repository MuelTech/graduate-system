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
  type SignatureCaptureMethod,
} from "@/lib/user-signature";

/**
 * CP6-FIX3 + §6 Vault: shared e-signature input supporting Type, Draw,
 * Image Upload (normalized to PNG), and optional Profile Signature Vault reuse.
 * Applying a saved signature fills this input only and never auto-submits forms.
 */
export function ESignaturePad({
  value,
  onChange,
  onMethodChange,
  disabled,
  allowTyped = true,
  allowUpload = true,
  enableProfileVault = true,
  defaultMode,
  autoFocus = false,
  readyText = "Signature ready for evaluation finalize.",
  requiredText = "Signature required before finalize.",
}: {
  value: string;
  onChange: (signatureData: string) => void;
  onMethodChange?: (method: SignatureCaptureMethod) => void;
  disabled?: boolean;
  /** Evaluation and Committee Report signing keep Type disabled; Profile/Adviser retain Type support. */
  allowTyped?: boolean;
  /** Allow uploading a PNG or JPEG signature image (normalized onto canvas as PNG). */
  allowUpload?: boolean;
  /** Show "Use My Saved Signature" & "Save to My Profile Vault" integration. */
  enableProfileVault?: boolean;
  /** Initial signature mode (defaults to "type" when allowTyped is true, otherwise "draw"). */
  defaultMode?: "type" | "draw" | "upload";
  /** Focus the signature input when it mounts (e.g. after moving to Sign). */
  autoFocus?: boolean;
  /** Optional caller-specific helper copy; defaults preserve Evaluation signing. */
  readyText?: string;
  requiredText?: string;
}) {
  const queryClient = useQueryClient();
  const initialMode: "type" | "draw" | "upload" =
    defaultMode === "type" && allowTyped
      ? "type"
      : defaultMode === "upload" && allowUpload
        ? "upload"
        : defaultMode === "draw"
          ? "draw"
          : allowTyped
            ? "type"
            : "draw";
  const [mode, setMode] = useState<"type" | "draw" | "upload">(initialMode);
  const [typed, setTyped] = useState("");
  const [uploadedName, setUploadedName] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
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
        mode === "type" ? "TYPE" : mode === "upload" ? "UPLOAD" : "DRAW";
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
    if (!autoFocus || disabled || isUsingSaved) return;
    const target =
      allowTyped && mode === "type"
        ? inputRef.current
        : mode === "draw"
          ? canvasRef.current
          : null;
    target?.focus();
  }, [allowTyped, autoFocus, disabled, isUsingSaved, mode]);

  const emitTypedSignature = (name: string) => {
    setTyped(name);
    if (!name.trim()) {
      onChangeRef.current("");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = 480;
    canvas.height = 120;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      onChangeRef.current("");
      return;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#111827";
    ctx.font = "32px 'Segoe UI', system-ui, sans-serif";
    ctx.fillText(name.trim(), 12, 72);
    onChangeRef.current(canvas.toDataURL("image/png"));
  };

  const resetLocalInputs = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawingRef.current = false;
    strokeStartedRef.current = false;
    setHasDrawn(false);
    setTyped("");
    setUploadedName(null);
    setUploadError(null);
  };

  const switchMode = (next: "type" | "draw" | "upload") => {
    if (mode === next && !isUsingSaved) return;
    setMode(next);
    onMethodChange?.(
      next === "type" ? "TYPE" : next === "upload" ? "UPLOAD" : "DRAW",
    );
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

  const handleUploadFile = async (file: File) => {
    setUploadError(null);
    setUploadBusy(true);
    try {
      const pngDataUrl = await normalizeUploadedSignatureImage(file);
      setUploadedName(file.name);
      onChangeRef.current(pngDataUrl);
    } catch (err) {
      setUploadedName(null);
      onChangeRef.current("");
      setUploadError(
        err instanceof Error ? err.message : "Unable to process image file.",
      );
    } finally {
      setUploadBusy(false);
    }
  };

  const isValid =
    isUsingSaved ||
    (mode === "upload" && Boolean(uploadedName) && isDataUrl(value)) ||
    (allowTyped && mode === "type"
      ? Boolean(typed.trim()) && isDataUrl(value)
      : mode === "draw" && hasDrawn && isDataUrl(value));

  const showModeButtons = allowTyped || allowUpload;

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
            {showModeButtons && (
              <>
                {allowTyped && (
                  <Button
                    type="button"
                    size="sm"
                    variant={mode === "type" ? "default" : "outline"}
                    disabled={disabled}
                    onClick={() => switchMode("type")}
                  >
                    Type
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant={mode === "draw" ? "default" : "outline"}
                  disabled={disabled}
                  onClick={() => switchMode("draw")}
                >
                  Draw
                </Button>
                {allowUpload && (
                  <Button
                    type="button"
                    size="sm"
                    variant={mode === "upload" ? "default" : "outline"}
                    disabled={disabled}
                    onClick={() => switchMode("upload")}
                  >
                    Upload PNG/JPEG
                  </Button>
                )}
              </>
            )}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className={showModeButtons ? "ml-auto" : "ml-auto"}
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
                Use a pointer or touch device to draw. You can also upload an
                image or apply a saved signature from your profile.
              </p>
            </div>
          )}

          {allowTyped && mode === "type" ? (
            <input
              ref={inputRef}
              value={typed}
              disabled={disabled}
              onChange={(e) => emitTypedSignature(e.target.value)}
              placeholder="Type your full name as e-signature"
              aria-label="Type your full name as e-signature"
              aria-describedby={statusId}
              autoComplete="name"
              className="w-full rounded border border-(--earist-border-gray) px-2 py-2 text-sm focus-visible:ring-2 focus-visible:ring-(--earist-primary)/40 focus-visible:outline-none"
            />
          ) : allowUpload && mode === "upload" ? (
            <div className="space-y-2 rounded border border-dashed border-gray-300 bg-gray-50/60 p-4 text-center">
              <input
                ref={uploadInputRef}
                type="file"
                accept=".png,.jpg,.jpeg,image/png,image/jpeg"
                className="hidden"
                disabled={disabled || uploadBusy}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    void handleUploadFile(file);
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
                Maximum 1 MB. Transparent PNG recommended for clean document
                placement.
              </p>
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
        ) : allowTyped && mode === "type" && typed.trim() ? (
          <p>Type cleared or invalid — enter your name.</p>
        ) : (
          <p>{requiredText}</p>
        )}

        {isValid && isDataUrl(value) && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <img
              src={value}
              alt="Signature preview"
              className="h-12 border border-(--earist-border-gray) bg-white px-2 object-contain"
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
