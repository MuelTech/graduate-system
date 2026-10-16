"use client";

/**
 * CDW-5 — Committee Report rich-text toolbar (restrained Word-like).
 *
 * Bounded command set only: a fixed "Arial" document-font field, a controlled
 * 11/12 pt size selector, undo/redo, headings 1–3, bold/italic/underline, the
 * four canonical alignments, bullet/ordered lists, and a controlled line-spacing
 * selector. No font picker, no color picker, no arbitrary sizes, no tables,
 * images, or arbitrary HTML.
 *
 * State is read through `useEditorState` so the controls reflect the paragraph
 * under the cursor (Tiptap does not re-render on every transaction by default).
 */

import type { ReactNode } from "react";
import { useEditorState, type Editor } from "@tiptap/react";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  List,
  ListOrdered,
  Redo2,
  Underline as UnderlineIcon,
  Undo2,
} from "lucide-react";

import { cn } from "@/lib/utils";

import type {
  ReportFontSizePt,
  ReportLineSpacing,
} from "./report-paragraph-formatting";

const ALIGNMENTS = ["left", "center", "right", "justify"] as const;
type Alignment = (typeof ALIGNMENTS)[number];

/** Bounded, canonical font sizes (points). */
const FONT_SIZES_PT = [11, 12] as const;
/** Bounded, canonical line spacing multipliers. */
const LINE_SPACING_OPTIONS = [
  { value: 1, label: "1.0" },
  { value: 1.15, label: "1.15" },
  { value: 1.5, label: "1.5" },
  { value: 2, label: "2.0" },
  { value: 2.5, label: "2.5" },
  { value: 3, label: "3.0" },
] as const;
const LINE_SPACING_VALUES: readonly number[] = LINE_SPACING_OPTIONS.map(
  (option) => option.value,
);

/** Document defaults when a paragraph carries no explicit value (see report-body.css). */
const DEFAULT_FONT_SIZE_PT = 12;
const DEFAULT_LINE_SPACING = 1.5;

const ALIGNMENT_CONTROLS: Array<{ value: Alignment; label: string; Icon: typeof AlignLeft }> = [
  { value: "left", label: "Align left", Icon: AlignLeft },
  { value: "center", label: "Align center", Icon: AlignCenter },
  { value: "right", label: "Align right", Icon: AlignRight },
  { value: "justify", label: "Justify", Icon: AlignJustify },
];

const SELECT_CLASS =
  "h-7 rounded-md border border-(--earist-border-gray) bg-white px-1 text-[12px] text-(--earist-body-text) focus-visible:ring-2 focus-visible:ring-(--earist-primary)/40 focus-visible:outline-none disabled:opacity-40";

function readFontSizePt(editor: Editor): number {
  const raw = editor.getAttributes("paragraph").fontSizePt as number;
  return (FONT_SIZES_PT as readonly number[]).includes(raw) ? raw : DEFAULT_FONT_SIZE_PT;
}

function readLineSpacing(editor: Editor): number {
  const raw = editor.getAttributes("paragraph").lineSpacing as number;
  return LINE_SPACING_VALUES.includes(raw) ? raw : DEFAULT_LINE_SPACING;
}

function ToolbarButton({
  label,
  active = false,
  disabled = false,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-md text-(--earist-body-text) transition-colors hover:bg-(--earist-surface-gray) focus-visible:ring-2 focus-visible:ring-(--earist-primary)/40 focus-visible:outline-none disabled:opacity-40",
        active && "bg-(--earist-primary) text-white hover:bg-(--earist-primary)",
      )}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span aria-hidden="true" className="mx-1 h-5 w-px bg-(--earist-border-gray)" />;
}

export function ReportEditorToolbar({
  editor,
  disabled = false,
}: {
  editor: Editor;
  disabled?: boolean;
}) {
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => {
      if (!current) {
        return {
          canUndo: false,
          canRedo: false,
          h1: false,
          h2: false,
          h3: false,
          bold: false,
          italic: false,
          underline: false,
          bullet: false,
          ordered: false,
          align: "left" as Alignment,
          fontSizePt: DEFAULT_FONT_SIZE_PT,
          lineSpacing: DEFAULT_LINE_SPACING,
          inParagraph: false,
        };
      }
      return {
        canUndo: current.can().undo(),
        canRedo: current.can().redo(),
        h1: current.isActive("heading", { level: 1 }),
        h2: current.isActive("heading", { level: 2 }),
        h3: current.isActive("heading", { level: 3 }),
        bold: current.isActive("bold"),
        italic: current.isActive("italic"),
        underline: current.isActive("underline"),
        bullet: current.isActive("bulletList"),
        ordered: current.isActive("orderedList"),
        align: ALIGNMENTS.find((value) => current.isActive({ textAlign: value })) ?? "left",
        fontSizePt: readFontSizePt(current),
        lineSpacing: readLineSpacing(current),
        inParagraph: current.isActive("paragraph"),
      };
    },
  });

  return (
    <div
      role="toolbar"
      aria-label="Committee Report formatting"
      className="flex shrink-0 flex-wrap items-center gap-0.5 border-b border-(--earist-border-gray) bg-white px-2 py-1.5"
    >
      {/* Document font is system-owned (Arial) — displayed, not selectable. */}
      <span
        aria-label="Document font: Arial"
        title="The report uses the fixed institutional document font (Arial)."
        className="mr-1 inline-flex h-7 items-center rounded-md border border-(--earist-border-gray) bg-(--earist-surface-gray) px-2 text-[12px] font-medium text-(--earist-body-text)"
      >
        Arial
      </span>

      <label className="mr-1 inline-flex items-center">
        <span className="sr-only">Font size (points)</span>
        <select
          aria-label="Font size"
          value={state.fontSizePt}
          disabled={disabled || !state.inParagraph}
          onChange={(event) =>
            editor
              .chain()
              .focus()
              .setReportFontSize(Number(event.target.value) as ReportFontSizePt)
              .run()
          }
          className={SELECT_CLASS}
        >
          {FONT_SIZES_PT.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </label>

      <Divider />

      <ToolbarButton
        label="Undo"
        disabled={disabled || !state.canUndo}
        onClick={() => editor.chain().focus().undo().run()}
      >
        <Undo2 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Redo"
        disabled={disabled || !state.canRedo}
        onClick={() => editor.chain().focus().redo().run()}
      >
        <Redo2 className="h-4 w-4" />
      </ToolbarButton>

      <Divider />

      <ToolbarButton
        label="Heading 1"
        active={state.h1}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
      >
        <Heading1 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Heading 2"
        active={state.h2}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <Heading2 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Heading 3"
        active={state.h3}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        <Heading3 className="h-4 w-4" />
      </ToolbarButton>

      <Divider />

      <ToolbarButton
        label="Bold"
        active={state.bold}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Italic"
        active={state.italic}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Underline"
        active={state.underline}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <UnderlineIcon className="h-4 w-4" />
      </ToolbarButton>

      <Divider />

      {ALIGNMENT_CONTROLS.map(({ value, label, Icon }) => (
        <ToolbarButton
          key={value}
          label={label}
          active={state.align === value}
          disabled={disabled}
          onClick={() => editor.chain().focus().setTextAlign(value).run()}
        >
          <Icon className="h-4 w-4" />
        </ToolbarButton>
      ))}

      <Divider />

      <ToolbarButton
        label="Bullet list"
        active={state.bullet}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Numbered list"
        active={state.ordered}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered className="h-4 w-4" />
      </ToolbarButton>

      <Divider />

      <label className="inline-flex items-center">
        <span className="sr-only">Line spacing</span>
        <select
          aria-label="Line spacing"
          value={state.lineSpacing}
          disabled={disabled || !state.inParagraph}
          onChange={(event) =>
            editor
              .chain()
              .focus()
              .setReportLineSpacing(Number(event.target.value) as ReportLineSpacing)
              .run()
          }
          className={SELECT_CLASS}
        >
          {LINE_SPACING_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
