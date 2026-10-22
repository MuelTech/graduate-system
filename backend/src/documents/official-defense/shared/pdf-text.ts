import { Color, PDFFont, PDFPage } from "pdf-lib";
import type { PdfBox } from "./pdf-layout";

interface TextOptions {
  readonly size: number;
  readonly minSize?: number;
  readonly align?: "left" | "center" | "right";
  readonly color?: Color;
  readonly lineHeight?: number;
  readonly field: string;
}

/** Wrap explicit paragraphs, including long unbroken identifiers, without losing text. */
function wrap(font: PDFFont, value: string, size: number, width: number): string[] {
  const lines: string[] = [];
  for (const paragraph of value.replace(/\r\n?/g, "\n").split("\n")) {
    let line = "";
    for (const word of paragraph.trim().split(/\s+/)) {
      if (!word) continue;
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= width) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);
      line = "";
      for (const character of word) {
        if (font.widthOfTextAtSize(line + character, size) > width) {
          if (!line) throw new RangeError("Text box is narrower than one character.");
          lines.push(line);
          line = "";
        }
        line += character;
      }
    }
    lines.push(line);
  }
  return lines;
}

/** Fit within a measured rectangle. Oversized content fails explicitly, never clips or truncates. */
export function textBox(
  page: PDFPage,
  font: PDFFont,
  value: string,
  box: PdfBox,
  options: TextOptions,
): void {
  if (!value) return;
  const minimum = options.minSize ?? options.size;
  for (let size = options.size; size >= minimum - 0.001; size -= 0.25) {
    const lines = wrap(font, value, size, box.width);
    const ascent = font.heightAtSize(size, { descender: false });
    const descent = font.heightAtSize(size) - ascent;
    const leading = options.lineHeight ?? size * 1.18;
    if (ascent + descent + (lines.length - 1) * leading > box.height) continue;
    for (let i = 0; i < lines.length; i++) {
      const width = font.widthOfTextAtSize(lines[i], size);
      const offset = options.align === "center" ? (box.width - width) / 2
        : options.align === "right" ? box.width - width : 0;
      page.drawText(lines[i], {
        x: box.x + offset,
        y: page.getHeight() - box.top - ascent - i * leading,
        size,
        font,
        color: options.color,
      });
    }
    return;
  }
  throw new RangeError(`${options.field} exceeds the available space in the one-page form.`);
}
