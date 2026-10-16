"use client";

/**
 * CDW-3 — comment composer used for both the initial Add Comment action and
 * thread replies. Trims/validates before submit, enforces the backend max
 * length, disables duplicate submits, and never clears typed text on a
 * recoverable failure (the parent remounts to clear after success).
 */

import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  MAX_COMMENT_LENGTH,
  normalizeCommentInput,
} from "@/lib/pdf-annotation/collaboration-client";

export interface AnnotationCommentComposerProps {
  submitLabel: string;
  placeholder?: string;
  isPending?: boolean;
  /** Safe, already-mapped mutation error (never raw backend text). */
  error?: string | null;
  onSubmit: (body: string) => void;
  onCancel?: () => void;
  autoFocus?: boolean;
  /** Optional context rendered above the textarea (e.g. selected text). */
  header?: ReactNode;
}

export function AnnotationCommentComposer({
  submitLabel,
  placeholder,
  isPending = false,
  error = null,
  onSubmit,
  onCancel,
  autoFocus = false,
  header,
}: AnnotationCommentComposerProps) {
  const [value, setValue] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const trimmedEmpty = value.trim().length === 0;

  const handleSubmit = () => {
    const result = normalizeCommentInput(value);
    if (!result.ok) {
      setLocalError(result.error);
      return;
    }
    setLocalError(null);
    onSubmit(result.body);
  };

  return (
    <div className="space-y-2">
      {header}
      <Textarea
        value={value}
        placeholder={placeholder}
        autoFocus={autoFocus}
        maxLength={MAX_COMMENT_LENGTH}
        disabled={isPending}
        aria-label={submitLabel}
        onChange={(event) => {
          setValue(event.target.value);
          if (localError) setLocalError(null);
        }}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.preventDefault();
            if (!isPending && !trimmedEmpty) handleSubmit();
          }
        }}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          onClick={handleSubmit}
          disabled={isPending || trimmedEmpty}
        >
          {isPending ? "Saving…" : submitLabel}
        </Button>
        {onCancel && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onCancel}
            disabled={isPending}
          >
            Cancel
          </Button>
        )}
        <span
          className="ml-auto text-[11px] tabular-nums text-(--earist-body-text)"
          aria-hidden="true"
        >
          {value.length}/{MAX_COMMENT_LENGTH}
        </span>
      </div>
      {(localError || error) && (
        <p className="text-xs text-red-600">{localError ?? error}</p>
      )}
    </div>
  );
}
