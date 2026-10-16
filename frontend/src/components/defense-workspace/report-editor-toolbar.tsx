"use client";

/**
 * CDW-5 — Committee Report rich-text toolbar.
 *
 * Keyboard-usable controls with accessible names and an exposed pressed state
 * (`aria-pressed`). Only the bounded command set the canonical document supports
 * is offered: headings 1–3, bold, italic, underline, bullet/ordered lists, undo,
 * redo. No images, tables, links, or arbitrary HTML.
 */

import type { ReactNode } from "react";
import type { Editor } from "@tiptap/react";
import {
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
  return (
    <div
      role="toolbar"
      aria-label="Committee Report formatting"
      className="flex shrink-0 flex-wrap items-center gap-0.5 border-b border-(--earist-border-gray) bg-white px-2 py-1.5"
    >
      <ToolbarButton
        label="Undo"
        disabled={disabled || !editor.can().undo()}
        onClick={() => editor.chain().focus().undo().run()}
      >
        <Undo2 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Redo"
        disabled={disabled || !editor.can().redo()}
        onClick={() => editor.chain().focus().redo().run()}
      >
        <Redo2 className="h-4 w-4" />
      </ToolbarButton>

      <Divider />

      <ToolbarButton
        label="Heading 1"
        active={editor.isActive("heading", { level: 1 })}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
      >
        <Heading1 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Heading 2"
        active={editor.isActive("heading", { level: 2 })}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <Heading2 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Heading 3"
        active={editor.isActive("heading", { level: 3 })}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        <Heading3 className="h-4 w-4" />
      </ToolbarButton>

      <Divider />

      <ToolbarButton
        label="Bold"
        active={editor.isActive("bold")}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Italic"
        active={editor.isActive("italic")}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Underline"
        active={editor.isActive("underline")}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <UnderlineIcon className="h-4 w-4" />
      </ToolbarButton>

      <Divider />

      <ToolbarButton
        label="Bullet list"
        active={editor.isActive("bulletList")}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Numbered list"
        active={editor.isActive("orderedList")}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered className="h-4 w-4" />
      </ToolbarButton>
    </div>
  );
}
