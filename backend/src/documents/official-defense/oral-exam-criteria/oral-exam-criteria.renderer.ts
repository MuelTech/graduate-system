import { grayscale, PDFDocument, PDFFont, StandardFonts } from "pdf-lib";
import { institutionalHeader } from "../shared/institutional-header";
import { A4, drawContainedImage, rule } from "../shared/pdf-layout";
import { fitText, textBox } from "../shared/pdf-text";
import type { OralExamCriteriaRenderInput, OralExamCriterionValue } from "./oral-exam-criteria.types";

const SCALE = [
  ["1.00", "E", "Excellent"],
  ["1.25", "HS", "Highly Satisfactory"],
  ["1.50", "VS", "Very Satisfactory"],
  ["1.75", "S", "Satisfactory"],
  ["2.00", "BS", "Barely Satisfactory"],
  ["2.50", "F", "Fail"],
] as const;

const GROUP_I = [
  "Timeliness and relevance of study to educational goals",
  "Organization",
  "Depth or Comprehensiveness of treatment",
  "Relevance of conclusions and recommendations",
  "Evidence of original thinking",
] as const;
const GROUP_II = [
  "Presentation",
  "Mastery of Subject Matter",
  "Communication Skill",
  "Attitude (Receptive to suggestions)",
] as const;

// Unconfirmed dummy QA presentation only: the blank reference establishes no completed-form symbol.
// Keep the glyph in one place for later confirmation; input criterion values remain authoritative.
const QA_SELECTED_RATING_MARKER = "X";

/** Static, single-page rendering only. No file, domain, workflow, database, or HTTP access. */
export async function renderOralExamCriteria(input: OralExamCriteriaRenderInput): Promise<Uint8Array> {
  // Guard the matrix shape even when called from untyped JavaScript. Never silently drop a score.
  for (const [label, values, count] of [
    ["Group I", input.groupI, 5], ["Group II", input.groupII, 4],
  ] as const) {
    if (values.length !== count) throw new RangeError(`${label} requires ${count} criterion values.`);
    if (values.some(value => value !== null && !SCALE.some(([printed]) => printed === value))) {
      throw new RangeError(`${label} contains a value outside the printed institutional matrix.`);
    }
  }

  const doc = await PDFDocument.create();
  // Stable PDF metadata makes identical static inputs reproducible. The visible date is input.date.
  doc.setCreationDate(new Date(0));
  doc.setModificationDate(new Date(0));
  doc.setTitle("EARIST Graduate School - Oral Examination Criteria");
  doc.setAuthor("EARIST Graduate School");
  doc.setProducer("EARIST Graduate School - Official Forms");
  const page = doc.addPage([A4.width, A4.height]);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const roman = await doc.embedFont(StandardFonts.TimesRoman);
  const italic = await doc.embedFont(StandardFonts.TimesRomanItalic);
  const serifBold = await doc.embedFont(StandardFonts.TimesRomanBold);
  const serifBoldItalic = await doc.embedFont(StandardFonts.TimesRomanBoldItalic);
  const text = (
    value: string, x: number, top: number, width: number, height: number,
    size = 9, font: PDFFont = regular, align: "left" | "center" | "right" = "left",
    field = value,
  ) => textBox(page, font, value, { x, top, width, height }, {
    size, minSize: Math.min(size, 8), align, field,
  });

  await institutionalHeader(doc, page, input.logos, { roman, italic });
  text("GRADUATE SCHOOL", 68, 135, 470, 19, 15, serifBold, "center");
  text("Oral Examination Criteria", 68, 156, 470, 19, 15, serifBoldItalic, "center");

  // Compact inline fields: try one measured line before reserving a wrapped second line.
  // Keep abbreviations readable while reserving enough horizontal space for the supplied date.
  const identityFields = [
    { label: "Candidate", value: input.candidateName, labelX: 63, labelWidth: 60, x: 124, width: 116, size: 12 },
    { label: "Course", value: input.course, labelX: 244, labelWidth: 45, x: 294, width: 116, size: 12 },
    { label: "Date", value: input.date, labelX: 414, labelWidth: 30, x: 448, width: 90, size: 12 },
  ].map(field => {
    const options = { size: field.size, minSize: 8, field: field.label };
    const height = fitText(regular, field.value, { width: field.width, height: 12 }, options) ? 12 : 24;
    textBox(page, regular, `${field.label}:`, { x: field.labelX, top: 181, width: field.labelWidth, height: 12 }, {
      size: 12, minSize: 12, verticalAlign: "bottom", field: `${field.label} label`,
    });
    textBox(page, regular, field.value, { x: field.x, top: 181, width: field.width, height }, {
      ...options, verticalAlign: "bottom",
    });
    // Keep a short degree abbreviation's underline compact without constraining longer values.
    const ruleWidth = field.label === "Course" && height === 12
      ? Math.min(field.width, Math.max(48, regular.widthOfTextAtSize(field.value, field.size) + 6))
      : field.width;
    rule(page, field.x - 1, 182 + height, field.x + ruleWidth);
    return { height };
  });
  const bodyShift = Math.max(...identityFields.map(field => field.height)) - 25;

  const tableX = 76;
  const tableWidth = 462;
  const numberWidth = 20;
  const criteriaWidth = 246;
  const ratingWidth = 36;
  const headerHeight = 26;
  const rowHeight = 24;

  const table = (top: number, labels: readonly string[], values: readonly (OralExamCriterionValue | null)[]) => {
    const height = headerHeight + labels.length * rowHeight;
    page.drawRectangle({
      x: tableX, y: A4.height - top - height, width: tableWidth, height,
      borderWidth: 0.55, borderColor: grayscale(0),
    });
    for (let i = 0; i <= labels.length; i++) {
      rule(page, tableX, top + headerHeight + i * rowHeight, tableX + tableWidth, 0.55);
    }
    const vertical = (x: number, start: number) => page.drawLine({
      start: { x, y: A4.height - start }, end: { x, y: A4.height - top - height }, thickness: 0.55,
    });
    vertical(tableX + numberWidth, top + headerHeight);
    for (let i = 0; i < 6; i++) vertical(tableX + criteriaWidth + i * ratingWidth, top);
    text("CRITERIA", tableX, top + 9, criteriaWidth, 14, 9.5, regular, "center");
    SCALE.forEach(([value, code], i) => {
      const x = tableX + criteriaWidth + i * ratingWidth;
      text(value, x, top + 3, ratingWidth, 11, 9, bold, "center");
      text(code, x, top + 15, ratingWidth, 10, 9, regular, "center");
    });
    labels.forEach((label, i) => {
      const rowTop = top + headerHeight + i * rowHeight;
      text(`${i + 1}.`, tableX + 4, rowTop + 8, 14, 13, 9);
      text(label, tableX + numberWidth + 5, rowTop + 7, criteriaWidth - numberWidth - 10, 16, 9);
      if (values[i] !== null) {
        const column = SCALE.findIndex(([value]) => value === values[i]);
        text(QA_SELECTED_RATING_MARKER, tableX + criteriaWidth + column * ratingWidth, rowTop + 7, ratingWidth, 14, 10, bold, "center");
      }
    });
    return top + height;
  };

  const average = (value: string, tableBottom: number, field: string) => {
    const top = tableBottom + 7;
    textBox(page, bold, "Average:", { x: 400, top, width: 44, height: 12 }, {
      size: 9, minSize: 9, verticalAlign: "bottom", field: `${field} label`,
    });
    textBox(page, regular, value, { x: 448, top, width: 47, height: 12 }, {
      size: 9, minSize: 8, align: "center", verticalAlign: "bottom", field,
    });
    rule(page, 447, tableBottom + 20, 496);
  };

  text("A.", 67, 214 + bodyShift, 20, 12, 9, roman);
  text("Group I", 104, 214 + bodyShift, 80, 12, 9.5);
  const groupIBottom = table(230 + bodyShift, GROUP_I, input.groupI);
  average(input.groupIAverage, groupIBottom, "Group I Average");

  text("B.", 67, 401 + bodyShift, 20, 12, 9, roman);
  text("Group II", 104, 401 + bodyShift, 80, 12, 9.5);
  const groupIIBottom = table(417 + bodyShift, GROUP_II, input.groupII);
  average(input.groupIIAverage, groupIIBottom, "Group II Average");

  text("Legend:", 76, 547 + bodyShift, 50, 13, 9);
  SCALE.forEach(([, code, description], i) => {
    const top = 562 + bodyShift + i * 11;
    text(code, 112, top, 20, 11, 8.5);
    text(`- ${description}`, 133, top, 132, 11, 8.5);
  });
  text("Recommendations:", 252, 562 + bodyShift, 160, 14, 9);
  // Three writing lines as on the reference; measure content before drawing it.
  textBox(page, regular, input.recommendations, { x: 252, top: 580 + bodyShift, width: 270, height: 33 }, {
    size: 9, minSize: 8, lineHeight: 12, field: "Recommendations",
  });
  for (const top of [590, 602, 614]) rule(page, 252, top + bodyShift, 522);

  // The reference's photocopied bands become clean, uniform gray fills.
  page.drawRectangle({ x: 58, y: A4.height - 650 - bodyShift, width: 290, height: 14, color: grayscale(0.25) });
  page.drawRectangle({ x: 117, y: A4.height - 650 - bodyShift, width: 2, height: 14, color: grayscale(1) });
  textBox(page, bold, "SUMMARY OF EVALUATION", { x: 119, top: 638 + bodyShift, width: 229, height: 12 }, {
    size: 9.5, align: "center", color: grayscale(1), field: "Summary heading",
  });
  text("Rating:", 62, 655 + bodyShift, 54, 13, 9);
  text(input.rating, 122, 653 + bodyShift, 222, 17, 9, regular, "left", "Rating");
  page.drawRectangle({ x: 58, y: A4.height - 689 - bodyShift, width: 290, height: 17, color: grayscale(0.9) });
  page.drawRectangle({ x: 117, y: A4.height - 689 - bodyShift, width: 2, height: 17, color: grayscale(1) });
  text("Remarks:", 62, 675 + bodyShift, 54, 13, 9);
  text(input.remarks, 122, 674 + bodyShift, 222, 14, 9, regular, "left", "Remarks");

  if (input.evaluatorSignature) {
    const name = fitText(regular, input.evaluatorPrintedName, { width: 150, height: 20 }, {
      size: 9, minSize: 8, field: "Evaluator printed name",
    });
    const nameTop = 748 - (name?.height ?? 0);
    await drawContainedImage(doc, page, input.evaluatorSignature, { x: 63, top: nameTop - 26, width: 140, height: 23 });
  }
  textBox(page, regular, input.evaluatorPrintedName, { x: 58, top: 728, width: 150, height: 20 }, {
    size: 9, minSize: 8, align: "center", verticalAlign: "bottom", field: "Evaluator printed name",
  });
  rule(page, 58, 749, 208);
  text("Signature over printed name of Panelist", 58, 753, 200, 13, 8);

  return doc.save();
}
