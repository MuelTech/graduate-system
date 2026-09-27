"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * CP6-FIX3: evaluation e-signature input with stable Draw gesture refs.
 * Type and Draw emit real PNG data-URL evidence.
 * Does not call RAP signature endpoints.
 */
export function ESignaturePad({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (signatureData: string) => void;
  disabled?: boolean;
}) {
  const [mode, setMode] = useState<"type" | "draw">("type");
  const [typed, setTyped] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hasDrawn, setHasDrawn] = useState(false);
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
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#111827";

    const pos = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
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
    mode === "type"
      ? Boolean(typed.trim()) && isDataUrl(value)
      : hasDrawn && isDataUrl(value);

  return (
    <div className="space-y-2 rounded border border-(--earist-border-gray) p-3">
      <div className="flex gap-2">
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
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={disabled}
          onClick={clear}
        >
          Clear
        </Button>
      </div>
      {mode === "type" ? (
        <input
          value={typed}
          disabled={disabled}
          onChange={(e) => emitTypedSignature(e.target.value)}
          placeholder="Type your full name as e-signature"
          className="w-full rounded border border-(--earist-border-gray) px-2 py-2 text-sm"
        />
      ) : (
        <canvas
          ref={canvasRef}
          width={360}
          height={120}
          className={`w-full rounded border bg-white ${
            disabled ? "opacity-60" : "border-(--earist-border-gray)"
          }`}
        />
      )}
      <div className="text-xs text-(--earist-body-text)">
        {isValid ? (
          <p>Signature ready for evaluation finalize.</p>
        ) : mode === "type" && typed.trim() ? (
          <p>Type cleared or invalid — enter your name.</p>
        ) : (
          <p>Signature required before finalize.</p>
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
