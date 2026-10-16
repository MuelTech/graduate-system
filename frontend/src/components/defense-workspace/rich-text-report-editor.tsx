"use client";

/**
 * CDW-5 — Rapporteur rich-text Committee Report editor (Tiptap / ProseMirror).
 *
 * Configured to EXACTLY the canonical server document model so client JSON always
 * validates server-side: heading levels 1–3, bold/italic/underline, bullet and
 * ordered lists, undo/redo. Strike, code, code block, blockquote, horizontal rule
 * and link are disabled (the server rejects those nodes/marks).
 *
 * The editor is presentation-only; the Rapporteur report body and all timestamps
 * remain server-authoritative.
 */

import { useEffect } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

import { emptyReportDocument, type ReportDocument } from "@/lib/report/report-document";

import { ReportEditorToolbar } from "./report-editor-toolbar";
import "./report-body.css";

export function RichTextReportEditor({
  initialDocument,
  editable = true,
  onChange,
  onEditorReady,
  ariaLabel = "Committee Report body",
}: {
  initialDocument?: ReportDocument | null;
  editable?: boolean;
  onChange?: (doc: ReportDocument) => void;
  onEditorReady?: (editor: Editor) => void;
  ariaLabel?: string;
}) {
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
    content: (initialDocument ?? emptyReportDocument()) as object,
    editorProps: {
      attributes: {
        class: "cdwReportBody text-[16px]",
        "aria-label": ariaLabel,
        role: "textbox",
        "aria-multiline": "true",
      },
    },
    onUpdate: ({ editor: current }) =>
      onChange?.(current.getJSON() as ReportDocument),
  });

  useEffect(() => {
    if (editor) onEditorReady?.(editor);
  }, [editor, onEditorReady]);

  return (
    <div className="cdwReportEditor flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-(--earist-border-gray) bg-white">
      {editable && editor && <ReportEditorToolbar editor={editor} />}
      <div className="min-h-0 flex-1 overflow-auto px-4 py-3">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
