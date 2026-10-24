import { PDFDocument, PDFFont, StandardFonts } from "pdf-lib";
import { drawStageCheck } from "../defense-application/defense-application.renderer";
import { institutionalHeader } from "../shared/institutional-header";
import { A4, drawContainedImage, rule } from "../shared/pdf-layout";
import { fitText, textBox } from "../shared/pdf-text";
import type { AdviserCertificationRenderInput } from "./adviser-certification.types";

/** Pure, one-page GS-017 reconstruction: explicit display input -> PDF bytes. */
export async function renderAdviserCertification(input: AdviserCertificationRenderInput): Promise<Uint8Array> {
  if (input.stage !== "proposal" && input.stage !== "final") {
    throw new RangeError("GS-017 stage must be proposal or final; Title Defense is not applicable.");
  }
  const doc = await PDFDocument.create();
  doc.setCreationDate(new Date(0));
  doc.setModificationDate(new Date(0));
  doc.setTitle("EARIST Graduate School - Thesis/Dissertation Adviser's Certification");
  doc.setAuthor("EARIST Graduate School");
  doc.setProducer("EARIST Graduate School - Official Forms");
  const page = doc.addPage([A4.width, A4.height]);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const oblique = await doc.embedFont(StandardFonts.HelveticaOblique);
  const roman = await doc.embedFont(StandardFonts.TimesRoman);
  const italic = await doc.embedFont(StandardFonts.TimesRomanItalic);
  const serifBold = await doc.embedFont(StandardFonts.TimesRomanBold);
  const text = (
    value: string, x: number, top: number, width: number, height: number,
    size = 11, font: PDFFont = regular, align: "left" | "center" = "left", field = value,
  ) => textBox(page, font, value, { x, top, width, height }, {
    size, minSize: size, align, field,
  });

  await institutionalHeader(doc, page, input.logos, { roman, italic });
  text("GRADUATE SCHOOL", 68, 133, 470, 19, 15, serifBold, "center");
  text("THESIS/DISSERTATION ADVISER’S CERTIFICATION", 68, 188, 470, 19, 13, serifBold, "center");
  text("This is to certify that the Thesis/Dissertation manuscript titled", 76, 236, 450, 14);

  // Four ruled lines, retaining every character. Quotes belong to the printed form.
  // The shorter fourth rule in the photograph ends at the closing quote.
  const titleBox = { x: 84, top: 252, width: 434, height: 57 };
  const titleOptions = { size: 11, minSize: 10.5, lineHeight: 15, field: "Manuscript title" };
  const titleLayout = fitText(regular, input.manuscriptTitle, titleBox, titleOptions);
  if (!titleLayout) throw new RangeError("Manuscript title exceeds the available space in the one-page form.");
  // A four-line title may need the full last rule. Keep the photographed shorter
  // rule for shorter titles, and place the closing quote after the actual text.
  text("“", 76, 252, 8, 14);
  textBox(page, regular, input.manuscriptTitle, titleBox, titleOptions);
  const lastLine = titleLayout.lines[titleLayout.lines.length - 1];
  const quoteX = input.manuscriptTitle ? titleBox.x + regular.widthOfTextAtSize(lastLine, titleLayout.size) + 2 : 440;
  const quoteTop = input.manuscriptTitle ? titleBox.top + (titleLayout.lines.length - 1) * titleLayout.leading : 297;
  text("”", quoteX, quoteTop, 8, 14, titleLayout.size);
  for (const top of [265, 280, 295]) rule(page, 76, top, 526);
  rule(page, 76, 310, titleLayout.lines.length === 4 ? 526 : 438);

  // Only genuine wrapping expands an identity row. All following body blocks
  // move together; the footer and large lower-page whitespace stay fixed.
  const identity = (label: string, value: string, x: number, top: number, field: string) => {
    const options = { size: 11, minSize: 10, field };
    const width = 504 - x;
    const height = fitText(regular, value, { width, height: 13 }, options) ? 13 : 26;
    textBox(page, regular, label, { x: 76, top, width: x - 80, height }, {
      size: 11, minSize: 11, verticalAlign: "bottom", field: field + " label",
    });
    textBox(page, regular, value, { x, top, width, height }, {
      ...options, align: "center", verticalAlign: "bottom",
    });
    rule(page, x - 2, top + height + 1, 506);
    return height - 13;
  };
  const nameExtra = identity("presented by", input.studentName, 144, 324, "Student name");
  text("(name of student)", 144, 350 + nameExtra, 360, 14, 11, regular, "center");
  const programExtra = identity("under the program of", input.programName, 185, 372 + nameExtra, "Program name");
  const bodyShift = nameExtra + programExtra;

  // Keep intentional spaces inside the parentheses. Reuse the accepted
  // GS-006/007 vector check without changing any accepted renderer/helper.
  const prefix = "was ";
  const selection = "reviewed and certified as eligible for thesis/ dissertation (   ) proposal (   ) final defense.";
  const selectionSize = 10;
  const selectionTop = 398 + bodyShift;
  const prefixWidth = regular.widthOfTextAtSize(prefix, selectionSize);
  const selectionX = 76 + prefixWidth;
  const ascent = bold.heightAtSize(selectionSize, { descender: false });
  const baseline = A4.height - selectionTop - ascent;
  page.drawText(prefix, { x: 76, y: baseline, font: regular, size: selectionSize });
  page.drawText(selection, { x: selectionX, y: baseline, font: bold, size: selectionSize });
  const markerPrefix = input.stage === "proposal"
    ? "reviewed and certified as eligible for thesis/ dissertation "
    : "reviewed and certified as eligible for thesis/ dissertation (   ) proposal ";
  const markerX = selectionX + bold.widthOfTextAtSize(markerPrefix + "(", selectionSize)
    + bold.widthOfTextAtSize("   ", selectionSize) / 2;
  drawStageCheck(page, markerX, baseline + ascent / 2);

  const issuedTop = 442 + bodyShift;
  text("Issued this", 76, issuedTop + 3, 54, 14);
  textBox(page, regular, input.issuedDay, { x: 135, top: issuedTop - 1, width: 23, height: 14 }, {
    size: 11, minSize: 10, align: "center", verticalAlign: "bottom", field: "Issued day",
  });
  rule(page, 134, issuedTop + 14, 159);
  text("day of", 163, issuedTop + 3, 32, 14);
  textBox(page, regular, input.issuedMonthYear, { x: 200, top: issuedTop - 1, width: 90, height: 14 }, {
    size: 11, minSize: 10, align: "center", verticalAlign: "bottom", field: "Issued month/year",
  });
  rule(page, 199, issuedTop + 14, 291);
  text("(Month/Year) upon the request of Ms./Mr.", 295, issuedTop + 3, 231, 14);

  // This is the same Student's request, not a new requester identity field.
  // Extend the photographed short continuation rule only as far as the name needs.
  const requestWidth = Math.min(442, Math.max(100, regular.widthOfTextAtSize(input.studentName, 11) + 8));
  const requestHeight = fitText(regular, input.studentName, { width: requestWidth - 4, height: 13 }, {
    size: 11, minSize: 10, field: "Student request name",
  }) ? 13 : 26;
  textBox(page, regular, input.studentName, { x: 78, top: issuedTop + 22, width: requestWidth - 4, height: requestHeight }, {
    size: 11, minSize: 10, verticalAlign: "bottom", field: "Student request name",
  });
  rule(page, 76, issuedTop + 23 + requestHeight, 76 + requestWidth);
  text(".", 78 + requestWidth, issuedTop + 10 + requestHeight, 6, 14);

  const signatureRule = 550 + bodyShift + requestHeight - 13;
  if (input.adviserSignature) {
    await drawContainedImage(doc, page, input.adviserSignature, {
      x: 80, top: signatureRule - 62, width: 158, height: 34,
    });
  }
  textBox(page, regular, input.adviserPrintedName, {
    x: 80, top: signatureRule - 27, width: 158, height: 26,
  }, { size: 11, minSize: 10, align: "center", verticalAlign: "bottom", field: "Adviser printed name" });
  rule(page, 76, signatureRule, 242);
  text("(Adviser’s Printed Name and Signature)", 76, signatureRule + 12, 300, 15);
  text("EARIST-QSF-GS-017 Rev. 01 (06.20.25)", 76, 800, 450, 15, 10.5, oblique);
  return doc.save();
}
