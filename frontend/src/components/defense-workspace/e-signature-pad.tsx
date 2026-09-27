"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * CP6-FIX1: reusable evaluation e-signature input.
 * Returns signatureData only to the caller — does not call RAP endpoints.
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
  const [typed, setTyped] = useState(value.startsWith("typed:") ? value.slice(5) : "");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hasDrawn, setHasDrawn] = useState(false);

  const emitTyped = (name: string) => {
    setTyped(name);
    onChange(name.trim() ? `typed:${name.trim()}` : "");
  };

  useEffect(() => {
    if (mode !== "draw") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let drawing = false;

    const pos = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const down = (e: PointerEvent) => {
      if (disabled) return;
      drawing = true;
      canvas.setPointerCapture(e.pointerId);
      const p = pos(e);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
    };
    const move = (e: PointerEvent) => {
      if (!drawing || disabled) return;
      const p = pos(e);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      setHasDrawn(true);
    };
    const up = () => {
      if (!drawing) return;
      drawing = false;
      onChange("drawn:sig");
    };
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointerleave", up);
    return () => {
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointerleave", up);
    };
  }, [mode, disabled, onChange]);

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
    setTyped("");
    onChange("");
  };

  const isValid = mode === "type" ? Boolean(typed.trim()) : hasDrawn;

  return (
    <div className="space-y-2 rounded border border-(--earist-border-gray) p-3">
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant={mode === "type" ? "default" : "outline"}
          disabled={disabled}
          onClick={() => setMode("type")}
        >
          Type
        </Button>
        <Button
          type="button"
          size="sm"
          variant={mode === "draw" ? "default" : "outline"}
          disabled={disabled}
          onClick={() => setMode("draw")}
        >
          Draw
        </Button>
        <Button type="button" size="sm" variant="ghost" disabled={disabled} onClick={clear}>
          Clear
        </Button>
      </div>
      {mode === "type" ? (
        <input
          value={typed}
          disabled={disabled}
          onChange={(e) => emitTyped(e.target.value)}
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
      <p className="text-xs text-(--earist-body-text)">
        {isValid
          ? "Signature ready for evaluation finalize."
          : "Signature required before finalize."}
      </p>
    </div>
  );
}
