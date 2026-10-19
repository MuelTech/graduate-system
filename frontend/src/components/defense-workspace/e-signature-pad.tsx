"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * CP6-FIX3: shared e-signature input with stable Draw gesture refs.
 * Type and Draw emit real PNG data-URL evidence. Default helper copy preserves
 * Evaluation signing; report signing may pass neutral copy and allowTyped=false.
 * Does not call any signature endpoint.
 */
export function ESignaturePad({
  value,
  onChange,
  disabled,
  allowTyped = true,
  autoFocus = false,
  readyText = "Signature ready for evaluation finalize.",
  requiredText = "Signature required before finalize.",
}: {
  value: string;
  onChange: (signatureData: string) => void;
  disabled?: boolean;
  /** Evaluation signing is draw-only; other flows retain Type support. */
  allowTyped?: boolean;
  /** Focus the signature input when it mounts (e.g. after moving to Sign). */
  autoFocus?: boolean;
  /** Optional caller-specific helper copy; defaults preserve Evaluation signing. */
  readyText?: string;
  requiredText?: string;
}) {
  const [mode, setMode] = useState<"type" | "draw">(
    allowTyped ? "type" : "draw",
  );
  const [typed, setTyped] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
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

  useEffect(() => {
    if (!autoFocus || disabled) return;
    const target =
      allowTyped && mode === "type" ? inputRef.current : canvasRef.current;
    target?.focus();
  }, [allowTyped, autoFocus, disabled, mode]);

  const isDataUrl = (v: string) => v.startsWith("data:image/png;base64,");

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

  const switchMode = (next: "type" | "draw") => {
    if (mode === next) return;
    setMode(next);
    setTyped("");
    setHasDrawn(false);
    drawingRef.current = false;
    strokeStartedRef.current = false;
    onChangeRef.current("");
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  // CP6-FIX3: pointer listeners use stable refs; no hasDrawn in deps.
  useEffect(() => {
    if (mode !== "draw") return;
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
  }, [mode]);

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawingRef.current = false;
    strokeStartedRef.current = false;
    setHasDrawn(false);
    setTyped("");
    onChangeRef.current("");
  };

  const isValid =
    allowTyped && mode === "type"
      ? Boolean(typed.trim()) && isDataUrl(value)
      : hasDrawn && isDataUrl(value);

  return (
    <div className="space-y-2 rounded border border-(--earist-border-gray) p-3">
      <div className="flex gap-2">
        {allowTyped && (
          <>
            <Button
              type="button"
              size="sm"
              variant={mode === "type" ? "default" : "outline"}
              disabled={disabled}
              onClick={() => switchMode("type")}
            >
              Type
            </Button>
            <Button
              type="button"
              size="sm"
              variant={mode === "draw" ? "default" : "outline"}
              disabled={disabled}
              onClick={() => switchMode("draw")}
            >
              Draw
            </Button>
          </>
        )}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className={allowTyped ? undefined : "ml-auto"}
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
            Use a pointer or touch device to draw. The signature area is not
            keyboard-drawable; keyboard-only signing requires a separate
            institutional signing option.
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
      <div
        id={statusId}
        role="status"
        aria-live="polite"
        className="text-xs text-(--earist-body-text)"
      >
        {isValid ? (
          <p>{readyText}</p>
        ) : allowTyped && mode === "type" && typed.trim() ? (
          <p>Type cleared or invalid — enter your name.</p>
        ) : (
          <p>{requiredText}</p>
        )}
        {isValid && isDataUrl(value) && (
          <img
            src={value}
            alt="Signature preview"
            className="mt-1 h-12 border border-(--earist-border-gray) bg-white"
          />
        )}
      </div>
    </div>
  );
}
