import { PDFDocument, PDFFont, PDFPage, StandardFonts } from "pdf-lib";
import { institutionalHeader } from "../shared/institutional-header";
import { A4, drawContainedImage, rule } from "../shared/pdf-layout";
import { fitText, textBox } from "../shared/pdf-text";
import type { AdviserRequestRenderInput } from "./adviser-request.types";

// The first reason line follows the printed sentence; the fourth rule is shorter.
const reasonRows = [
  { x: 240, top: 346, width: 286, height: 14 },
  { x: 76, top: 365, width: 450, height: 14 },
  { x: 76, top: 384, width: 450, height: 14 },
  { x: 76, top: 403, width: 350, height: 14 },
] as const;

/** Measured wrapping over unequal ruled lines, retaining explicit paragraph breaks. */
function reasonLines(font: PDFFont, value: string, size: number): string[] | undefined {
  const lines: string[] = [];
  const fits = (text: string) => lines.length < reasonRows.length
    && font.widthOfTextAtSize(text, size) <= reasonRows[lines.length].width;
  for (const paragraph of value.replace(/\r\n?/g, "\n").split("\n")) {
    let line = "";
    for (const word of paragraph.trim().split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (fits(candidate)) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);
      line = "";
      // Split an unbroken identifier only when it cannot fit on an empty row.
      if (fits(word)) {
        line = word;
        continue;
      }
      for (const character of word) {
        if (!fits(line + character)) {
          if (!line) return undefined;
          lines.push(line);
          line = "";
        }
        if (!fits(line + character)) return undefined;
        line += character;
      }
    }
    lines.push(line);
    if (lines.length > reasonRows.length) return undefined;
  }
  return lines;
}

function drawReason(page: PDFPage, font: PDFFont, reason: string): void {
  if (!reason) return;
  for (let size = 11; size >= 10; size -= 0.25) {
    const lines = reasonLines(font, reason, size);
    if (!lines) continue;
    lines.forEach((line, index) => textBox(page, font, line, reasonRows[index], {
      size, minSize: size, field: "Request reason",
    }));
    return;
  }
  throw new RangeError("Request reason exceeds the available space in the one-page form.");
}

/** Pure one-page GS-020 reconstruction: explicit display input -> PDF bytes. */
export async function renderAdviserRequest(input: AdviserRequestRenderInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setCreationDate(new Date(0));
  doc.setModificationDate(new Date(0));
  doc.setTitle("EARIST Graduate School - Adviser Request");
  doc.setAuthor("EARIST Graduate School");
  doc.setProducer("EARIST Graduate School - Official Forms");
  const page = doc.addPage([A4.width, A4.height]);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const oblique = await doc.embedFont(StandardFonts.HelveticaOblique);
  const boldOblique = await doc.embedFont(StandardFonts.HelveticaBoldOblique);
  const roman = await doc.embedFont(StandardFonts.TimesRoman);
  const italic = await doc.embedFont(StandardFonts.TimesRomanItalic);
  const serifBold = await doc.embedFont(StandardFonts.TimesRomanBold);
  const text = (
    value: string, x: number, top: number, width: number, height = 14,
    size = 10.5, font: PDFFont = regular, align: "left" | "center" = "left",
  ) => textBox(page, font, value, { x, top, width, height }, {
    size, minSize: size, align, field: value,
  });
  const field = (value: string, label: string, x: number, top: number, width: number, height: number) =>
    textBox(page, regular, value, { x, top, width, height }, {
      size: 11, minSize: 10, align: "center", verticalAlign: "bottom", field: label,
    });

  await institutionalHeader(doc, page, input.logos, { roman, italic });
  text("GRADUATE SCHOOL", 68, 133, 470, 19, 15, serifBold, "center");
  text("Adviser Request", 68, 165, 470, 18, 13, boldOblique, "center");
  text("Date:", 360, 198, 29);
  field(input.requestDate, "Request date", 391, 192, 105, 16);
  rule(page, 390, 210, 498);

  text("The DEAN", 76, 237, 170, 15, 12, bold);
  text("Graduate Studies", 76, 253, 170, 15, 12);
  text("EARIST, Manila", 76, 269, 170, 15, 12);
  text("Sir:", 76, 298, 100);
  text("May I respectfully request", 112, 326, 124);
  field(input.requestedAdviserName, "Requested Adviser name", 240, 312, 202, 25);
  rule(page, 238, 339, 444);
  text("to be my thesis/", 450, 326, 76);
  text("dissertation adviser for the reason", 76, 346, 160);
  drawReason(page, regular, input.reason);
  for (const row of reasonRows) rule(page, row.x, row.top + 12, row.x + row.width);

  text("Very truly yours,", 360, 444, 155);
  if (input.studentSignature) {
    await drawContainedImage(doc, page, input.studentSignature, {
      x: 330, top: 460, width: 172, height: 24,
    });
  }
  field(input.studentName, "Student name", 330, 486, 172, 26);
  rule(page, 326, 514, 506);
  text("Graduate Student", 326, 518, 180, 14, 10.5, regular, "center");
  text("(Signature Over Printed Name)", 326, 532, 180, 14, 10.5, oblique, "center");
  text("Student No.:", 326, 558, 59);
  field(input.studentNumber, "Student Number", 388, 546, 124, 24);
  rule(page, 386, 572, 514);
  const programOptions = { size: 11, minSize: 10, field: "Program name" };
  const programHeight = [13, 26].find(height => fitText(regular, input.programName, {
    width: 138, height,
  }, programOptions)) ?? 39;
  text("Program:", 326, 576 + programHeight - 12, 44);
  field(input.programName, "Program name", 374, 576, 138, programHeight);
  rule(page, 372, 578 + programHeight, 514);

  text("CONFORME:", 76, 588, 180, 15, 11, bold);
  // Reuse the explicit requested Adviser; no second identity or signature source.
  field(input.requestedAdviserName, "Requested Adviser name", 80, 610, 158, 26);
  rule(page, 76, 638, 242);
  text("Adviser", 76, 642, 166, 14, 11, oblique, "center");
  text("Approved:", 76, 704, 180);
  // No institutional-office-holder authority exists: leave name/signature blank.
  rule(page, 76, 764, 214);
  text("Dean, Graduate School", 76, 768, 138, 14, 10.5, regular, "center");
  text("EARIST-QSF-GS-020 Rev. 00 (06.20.25)", 76, 800, 450, 15, 10.5, boldOblique);
  return doc.save();
}
