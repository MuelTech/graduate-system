"use client";

import { useId, useRef, useState } from "react";
import {
  canonicalTextareaOffset,
  clearTextSelection,
  editEmphasizedText,
  markTextSelection,
  type TextEmphasisSpan,
} from "../../lib/text-emphasis";
import { SemanticText } from "./semantic-text";

/** Selection-only controls. Every plain-text change clears marks with a visible notice. */
export function SemanticTextEditor({
  label,
  text,
  emphasis,
  maxLength,
  rows,
  onChange,
}: {
  label: string;
  text: string;
  emphasis?: TextEmphasisSpan[] | null;
  maxLength: number;
  rows: number;
  onChange: (text: string, emphasis: TextEmphasisSpan[] | null) => void;
}) {
  const id = useId();
  const input = useRef<HTMLTextAreaElement>(null);
  const [notice, setNotice] = useState("");
  function apply(style: TextEmphasisSpan["style"] | "CLEAR") {
    const field = input.current;
    if (!field) return;
    try {
      const start = canonicalTextareaOffset(text, field.selectionStart);
      const end = canonicalTextareaOffset(text, field.selectionEnd);
      const marks =
        style === "CLEAR"
          ? clearTextSelection(text, emphasis, start, end)
          : markTextSelection(text, emphasis, start, end, style);
      onChange(text, marks);
      setNotice(
        style === "CLEAR"
          ? "Formatting removed from the selected text."
          : "Formatting applied to the selected text.",
      );
    } catch {
      setNotice(
        "Select a nonempty range. Remove overlapping formatting before applying the same style again.",
      );
    }
  }
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      <textarea
        id={id}
        ref={input}
        required
        maxLength={maxLength}
        rows={rows}
        value={text}
        aria-describedby={`${id}-help ${id}-status`}
        className="mt-1 block w-full rounded-md border border-gray-300 bg-white p-2 text-sm"
        onChange={(event) => {
          const result = editEmphasizedText(text, event.target.value, emphasis);
          onChange(result.text, result.emphasis);
          if (result.cleared)
            setNotice(
              "Text changed. All formatting for this field was cleared; reapply it to the updated text.",
            );
        }}
      />
      <p id={`${id}-help`} className="text-xs text-gray-600">
        Select text, then apply bold, underline, or italic. Editing text clears
        its formatting.
      </p>
      <div
        role="group"
        aria-label={`${label} formatting`}
        className="flex flex-wrap gap-2"
      >
        {(
          [
            ["BOLD", "Bold"],
            ["UNDERLINE", "Underline"],
            ["ITALIC", "Italic"],
            ["CLEAR", "Remove selected formatting"],
          ] as const
        ).map(([style, name]) => (
          <button
            key={style}
            type="button"
            className="rounded border bg-white px-2 py-1 text-sm"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => apply(style)}
          >
            {name}
          </button>
        ))}
        <button
          type="button"
          className="rounded border bg-white px-2 py-1 text-sm"
          onClick={() => {
            onChange(text, null);
            setNotice("All formatting removed.");
          }}
        >
          Clear all formatting
        </button>
      </div>
      <p id={`${id}-status`} role="status" className="text-xs">
        {notice}
      </p>
      <div
        aria-label={`${label} emphasis preview`}
        className="rounded border p-2 text-sm"
      >
        <SemanticText text={text} emphasis={emphasis} />
      </div>
    </div>
  );
}
