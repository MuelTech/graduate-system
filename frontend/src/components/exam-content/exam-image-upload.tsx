"use client";

import { useEffect, useRef, useState } from "react";
import { ApiError, apiClientRequest } from "@/lib/api.client";
import { isExamMediaId } from "@/lib/exam-content";
import { ExamMediaImage } from "./exam-media-image";

export function ExamImageUpload({
  mediaId,
  onChange,
  onBusyChange,
  label,
}: {
  mediaId: string | null;
  onChange: (id: string) => void;
  onBusyChange: (busy: boolean) => void;
  label: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function upload(file: File | undefined) {
    if (!file) return;
    setError("");
    if (
      (file.type && file.type !== "image/png" && file.type !== "image/jpeg") ||
      !file.size
    ) {
      setError("Choose a PNG or JPEG image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Image exceeds the allowed size.");
      return;
    }
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    setBusy(true);
    onBusyChange(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const result: unknown = await apiClientRequest(
        "/exam-engine/admin/media",
        { method: "POST", body: form, signal: request.signal },
      );
      if (request.signal.aborted) return;
      if (
        !result ||
        typeof result !== "object" ||
        !("id" in result) ||
        !isExamMediaId(result.id)
      )
        throw new Error("Invalid upload response");
      onChange(result.id);
    } catch (error) {
      if (!request.signal.aborted)
        setError(
          error instanceof ApiError && error.statusCode === 413
            ? "Image exceeds the allowed size."
            : "Image upload failed. Choose a valid PNG/JPEG and check your session.",
        );
    } finally {
      onBusyChange(false);
      if (!request.signal.aborted) setBusy(false);
    }
  }
  return (
    <div className="space-y-2">
      {mediaId && <ExamMediaImage mediaId={mediaId} alt={label} />}
      <label className="block text-sm font-medium">
        {mediaId
          ? `Replace ${label.toLowerCase()}`
          : `Upload ${label.toLowerCase()}`}
        <input
          type="file"
          accept="image/png,image/jpeg"
          disabled={busy}
          className="mt-1 block w-full rounded border bg-white p-2 text-sm"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            void upload(file);
          }}
        />
      </label>
      {busy && (
        <p role="status" className="text-sm text-gray-600">
          Uploading image…
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
