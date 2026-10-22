import { PDFDocument, PDFFont, PDFPage } from "pdf-lib";
import { drawContainedImage, PdfImageInput, rule } from "./pdf-layout";
import { textBox } from "./pdf-text";

export interface InstitutionalLogos {
  readonly earist: PdfImageInput;
  readonly graduateSchool: PdfImageInput;
}

/** The two-logo institutional masthead, reconstructed from the supplied reference. */
export async function institutionalHeader(
  doc: PDFDocument,
  page: PDFPage,
  logos: InstitutionalLogos,
  fonts: { roman: PDFFont; italic: PDFFont },
): Promise<void> {
  await drawContainedImage(doc, page, logos.earist, { x: 70, top: 38, width: 76, height: 76 });
  await drawContainedImage(doc, page, logos.graduateSchool, { x: 464, top: 40, width: 72, height: 72 });
  const center = (value: string, top: number, size: number, italic = false) => textBox(
    page, italic ? fonts.italic : fonts.roman, value,
    { x: 149, top, width: 309, height: 17 },
    { size, minSize: size, align: "center", field: "Institutional header" },
  );
  center("Republic of the Philippines", 49, 12, true);
  center('EULOGIO "AMANG" RODRIGUEZ', 67, 13);
  center("INSTITUTE OF SCIENCE AND TECHNOLOGY", 83, 12);
  center("Nagtahan, Sampaloc, Manila", 101, 11.5, true);
  rule(page, 68, 126, 538, 1);
}
