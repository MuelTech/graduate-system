"use client";

/**
 * CDW-5 — Rapporteur rich-text Committee Report editor (Tiptap / ProseMirror).
 *
 * BOUNDARY: this component speaks Tiptap JSON internally but the rest of the app
 * speaks canonical ReportDocument. `toTiptapDocument` loads canonical → editor and
 * `fromTiptapDocument` converts editor → canonical on every update, so formatting
 * is never lost between editor, Preview, and Save.
 *
 * Configured to EXACTLY the canonical server model: heading levels 1–3,
 * bold/italic/underline, bullet/ordered lists, undo/redo. Strike, code, code
 * block, blockquote, horizontal rule and link are disabled (the server rejects
 * those nodes/marks).
 *
 * The "Insert into Report" bridge is registered here (not in the panel) so it
 * follows the ACTUAL editor mount lifecycle: when the editor unmounts (e.g. the
 * Rapporteur opens Preview Report) the handler is cleared and no destroyed editor
 * can receive content.
 */

import { useEffect, useRef } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

import {
  commentTextToContent,
  emptyReportDocument,
  type ReportDocument,
} from "@/lib/report/report-document";
import { fromTiptapDocument, toTiptapDocument } from "@/lib/report/tiptap-adapter";

import { ReportEditorToolbar } from "./report-editor-toolbar";
import { useReportComposer } from "./report-composer-context";
import "./report-body.css";

export function RichTextReportEditor({
  initialDocument,
  editable = true,
  onChange,
  ariaLabel = "Committee Report body",
}: {
  initialDocument?: ReportDocument | null;
  editable?: boolean;
  onChange?: (doc: ReportDocument) => void;
  ariaLabel?: string;
}) {
  const { registerInsert } = useReportComposer();

  // Keep the latest onChange without re-registering the insert bridge on every
  // parent render. Updated in an effect (never during render).
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const editor = useEditor({
    // Next.js SSR: do not render immediately (avoids hydration mismatch).
    immediatelyRender: false,
    editable,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        strike: false,
        code: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
        link: false,
      }),
    ],
    content: toTiptapDocument(initialDocument ?? emptyReportDocument()),
    editorProps: {
      attributes: {
        class: "cdwReportBody text-[16px]",
        "aria-label": ariaLabel,
        role: "textbox",
        "aria-multiline": "true",
      },
    },
    onUpdate: ({ editor: current }) =>
      onChangeRef.current?.(fromTiptapDocument(current.getJSON())),
  });

  useEffect(() => {
    if (!editor || !editable) {
      registerInsert(null);
      return;
    }
    registerInsert((text: string) => {
      const blocks = commentTextToContent(text);
      if (blocks.length === 0) return false;
      // Insert via structured Tiptap content (never HTML); the full comment text.
      const content = toTiptapDocument({ type: "doc", content: blocks }).content;
      editor.chain().focus().insertContent(content).run();
      onChangeRef.current?.(fromTiptapDocument(editor.getJSON()));
      return true;
    });
    return () => registerInsert(null);
  }, [editor, editable, registerInsert]);

  return (
    <div className="cdwReportEditor flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-(--earist-border-gray) bg-white">
      {editable && editor && <ReportEditorToolbar editor={editor} />}
      <div className="min-h-0 flex-1 overflow-auto px-4 py-3">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
