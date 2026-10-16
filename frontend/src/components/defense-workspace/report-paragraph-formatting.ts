/**
 * CDW-5 (Word-like academic formatting) — controlled paragraph font size and
 * line spacing for the Committee Report editor.
 *
 * The canonical model stores ONLY semantic, bounded values:
 *   - fontSizePt: 11 | 12
 *   - lineSpacing: 1 | 1.15 | 1.5 | 2 | 2.5 | 3
 *
 * Nothing here stores CSS strings, pixel values, colors, or font families. Arial
 * and black text are presentation policy applied by the shared
 * `.cdwReportBody` CSS, not authored values.
 *
 * The attributes are block/paragraph-level (never per-character marks), so the
 * Preview/read-only renderer and a future official PDF renderer can map them
 * deterministically. The editor emits `data-font-size-pt` / `data-line-spacing`
 * purely for presentation, matching the read-only renderer's output.
 */

import { Extension } from "@tiptap/core";

export const REPORT_FONT_SIZES_PT = [11, 12] as const;
export const REPORT_LINE_SPACINGS = [1, 1.15, 1.5, 2, 2.5, 3] as const;

export type ReportFontSizePt = (typeof REPORT_FONT_SIZES_PT)[number];
export type ReportLineSpacing = (typeof REPORT_LINE_SPACINGS)[number];

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    reportParagraphFormatting: {
      /** Set the current paragraph's controlled font size (11 or 12 pt). */
      setReportFontSize: (size: ReportFontSizePt) => ReturnType;
      /** Set the current paragraph's controlled line spacing. */
      setReportLineSpacing: (spacing: ReportLineSpacing) => ReturnType;
    };
  }
}

function isFontSizePt(value: unknown): value is ReportFontSizePt {
  return (REPORT_FONT_SIZES_PT as readonly number[]).includes(value as number);
}

function isLineSpacing(value: unknown): value is ReportLineSpacing {
  return (REPORT_LINE_SPACINGS as readonly number[]).includes(value as number);
}

export const ReportParagraphFormatting = Extension.create({
  name: "reportParagraphFormatting",

  addGlobalAttributes() {
    return [
      {
        types: ["paragraph"],
        attributes: {
          fontSizePt: {
            default: null,
            parseHTML: (element) => {
              const raw = element.getAttribute("data-font-size-pt");
              const value = raw === null ? Number.NaN : Number(raw);
              return isFontSizePt(value) ? value : null;
            },
            renderHTML: (attributes) =>
              isFontSizePt(attributes.fontSizePt)
                ? { "data-font-size-pt": String(attributes.fontSizePt) }
                : {},
          },
          lineSpacing: {
            default: null,
            parseHTML: (element) => {
              const raw = element.getAttribute("data-line-spacing");
              const value = raw === null ? Number.NaN : Number(raw);
              return isLineSpacing(value) ? value : null;
            },
            renderHTML: (attributes) =>
              isLineSpacing(attributes.lineSpacing)
                ? { "data-line-spacing": String(attributes.lineSpacing) }
                : {},
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setReportFontSize:
        (size) =>
        ({ editor, commands }) => {
          if (!isFontSizePt(size)) return false;
          // Block-level only: headings are not size-controlled.
          if (!editor.isActive("paragraph")) return false;
          return commands.updateAttributes("paragraph", { fontSizePt: size });
        },

      setReportLineSpacing:
        (spacing) =>
        ({ editor, commands }) => {
          if (!isLineSpacing(spacing)) return false;
          if (!editor.isActive("paragraph")) return false;
          return commands.updateAttributes("paragraph", { lineSpacing: spacing });
        },
    };
  },
});
