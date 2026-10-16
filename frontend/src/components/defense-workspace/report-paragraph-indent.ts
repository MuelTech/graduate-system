/**
 * CDW-5 (authoring ergonomics) — semantic keyboard indentation for the
 * Committee Report editor.
 *
 * Tab / Shift+Tab must behave like a document editor:
 *   - inside a list item   → structural list nesting (sink / lift);
 *   - in a plain paragraph → a bounded canonical `indentLevel` (1..6).
 *
 * Nothing is inferred from spaces or literal tab characters: lists use
 * ProseMirror's native nesting, and paragraphs store a bounded integer attribute
 * that the server validates and persists. No arbitrary styles, class names, or
 * CSS lengths ever enter the document.
 *
 * This extension uses a LOW priority so the built-in list Tab handlers
 * (ListItem / ListKeymap) keep precedence; it is the fallback that adds the
 * plain-paragraph behavior they do not provide. Both paths still delegate to the
 * structural list commands, so behavior is correct regardless of handler order.
 *
 * Indentation is presentation-independent: the body renders the same in the
 * editor, Preview Report, and the read-only committee view via the shared
 * `.cdwReportBody p[data-indent-level]` CSS.
 */

import { Extension } from "@tiptap/core";

export const REPORT_INDENT_MIN = 0;
export const REPORT_INDENT_MAX = 6;

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    reportParagraphIndent: {
      /** Tab: nest a list item, or increase a paragraph's indent level. */
      increaseReportIndent: () => ReturnType;
      /** Shift+Tab: lift a list item, or decrease a paragraph's indent level. */
      decreaseReportIndent: () => ReturnType;
    };
  }
}

function readIndentLevel(editor: {
  getAttributes: (name: string) => Record<string, unknown>;
}): number {
  const raw = editor.getAttributes("paragraph")?.indentLevel;
  if (typeof raw !== "number" || !Number.isInteger(raw)) return REPORT_INDENT_MIN;
  if (raw < REPORT_INDENT_MIN || raw > REPORT_INDENT_MAX) return REPORT_INDENT_MIN;
  return raw;
}

export const ReportParagraphIndent = Extension.create({
  name: "reportParagraphIndent",

  // Lower than the default 100 so the built-in list Tab/Shift+Tab handlers run
  // first and keep their native nesting behavior.
  priority: 50,

  addGlobalAttributes() {
    return [
      {
        types: ["paragraph"],
        attributes: {
          indentLevel: {
            default: null,
            parseHTML: (element) => {
              const raw = element.getAttribute("data-indent-level");
              const value = raw === null ? Number.NaN : Number(raw);
              return Number.isInteger(value) && value >= 1 && value <= REPORT_INDENT_MAX
                ? value
                : null;
            },
            renderHTML: (attributes) => {
              const level = attributes.indentLevel;
              if (
                typeof level !== "number" ||
                !Number.isInteger(level) ||
                level < 1 ||
                level > REPORT_INDENT_MAX
              ) {
                return {};
              }
              return { "data-indent-level": String(level) };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      increaseReportIndent:
        () =>
        ({ editor, commands }) => {
          // Inside a list: nest the list item; never indent the paragraph.
          if (editor.isActive("listItem")) {
            return editor.can().sinkListItem("listItem")
              ? commands.sinkListItem("listItem")
              : false;
          }
          // Headings (and any non-paragraph block) are not indentable.
          if (!editor.isActive("paragraph")) return false;
          const current = readIndentLevel(editor);
          if (current >= REPORT_INDENT_MAX) return false;
          return commands.updateAttributes("paragraph", { indentLevel: current + 1 });
        },

      decreaseReportIndent:
        () =>
        ({ editor, commands }) => {
          if (editor.isActive("listItem")) {
            return editor.can().liftListItem("listItem")
              ? commands.liftListItem("listItem")
              : false;
          }
          if (!editor.isActive("paragraph")) return false;
          const current = readIndentLevel(editor);
          if (current <= REPORT_INDENT_MIN) return false;
          const next = current - 1;
          return commands.updateAttributes("paragraph", {
            // Level 0 is canonicalized to omission, never stored explicitly.
            indentLevel: next > REPORT_INDENT_MIN ? next : null,
          });
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      // Returning false preserves the browser's default focus behavior, so Tab
      // only becomes "consumed" when an indentation operation actually runs
      // (no unconditional keyboard trap).
      Tab: ({ editor }) => editor.commands.increaseReportIndent(),
      "Shift-Tab": ({ editor }) => editor.commands.decreaseReportIndent(),
    };
  },
});
