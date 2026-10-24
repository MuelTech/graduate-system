import {
  grayscale, PDFDocument, PDFFont, popGraphicsState, pushGraphicsState, StandardFonts, translate,
} from "pdf-lib";
import { institutionalHeader } from "../shared/institutional-header";
import { A4, rule } from "../shared/pdf-layout";
import { fitText, textBox } from "../shared/pdf-text";
import type { OralExamSummaryRenderInput } from "./oral-exam-summary.types";

/** Physical slots observed in the reference, not committee-size/role policy. */
export const ORAL_EXAM_SUMMARY_ROW_CAPACITY = 6;
export const ORAL_EXAM_SUMMARY_MEMBER_LINE_CAPACITY = 5;

/** Pure, one-page GS-011 reconstruction. No application bootstrap, I/O, or academic decisions. */
export async function renderOralExamSummary(input: OralExamSummaryRenderInput): Promise<Uint8Array> {
  if (input.examiners.length > ORAL_EXAM_SUMMARY_ROW_CAPACITY) {
    throw new RangeError("GS-011 has space for at most six examiner rows.");
  }
  if (input.submittedBy.memberNames.length > ORAL_EXAM_SUMMARY_MEMBER_LINE_CAPACITY) {
    throw new RangeError("GS-011 has space for at most five Member lines.");
  }
  if (!["title", "proposal", "final"].includes(input.stage)) {
    throw new RangeError("GS-011 requires an explicit defense stage.");
  }
  if (input.stage === "title" && input.adviserName.trim()) {
    throw new RangeError(
      "GS-011 Title Defense does not print an Adviser concurrence block.",
    );
  }
  const doc = await PDFDocument.create();
  doc.setCreationDate(new Date(0));
  doc.setModificationDate(new Date(0));
  doc.setTitle("EARIST Graduate School - Oral Examination Summary Sheet");
  doc.setAuthor("EARIST Graduate School");
  doc.setProducer("EARIST Graduate School - Official Forms");
  const page = doc.addPage([A4.width, A4.height]);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const roman = await doc.embedFont(StandardFonts.TimesRoman);
  const italic = await doc.embedFont(StandardFonts.TimesRomanItalic);
  const serifBold = await doc.embedFont(StandardFonts.TimesRomanBold);
  const serifBoldItalic = await doc.embedFont(StandardFonts.TimesRomanBoldItalic);
  const boldItalic = await doc.embedFont(StandardFonts.HelveticaBoldOblique);
  const text = (
    value: string, x: number, top: number, width: number, height: number,
    size = 10.5, font: PDFFont = regular, align: "left" | "center" = "left", field = value,
  ) => textBox(page, font, value, { x, top, width, height }, {
    size, minSize: Math.min(size, 8), align, field,
  });

  // Position the accepted masthead lower for GS-011 without changing its shared helper.
  page.pushOperators(pushGraphicsState(), translate(0, -18));
  await institutionalHeader(doc, page, input.logos, { roman, italic });
  page.pushOperators(popGraphicsState());
  text("GRADUATE SCHOOL", 68, 154, 470, 19, 15, serifBold, "center");
  text("Oral Examination Summary Sheet", 68, 185, 470, 20, 15, serifBoldItalic, "center");

  const fields = [
    { label: "CANDIDATE:", value: input.candidateName, labelX: 67, labelWidth: 67, x: 138, width: 114 },
    { label: "Course:", value: input.course, labelX: 258, labelWidth: 41, x: 303, width: 86 },
    { label: "Date:", value: input.date, labelX: 394, labelWidth: 28, x: 426, width: 92 },
  ];
  const inlineField = (field: typeof fields[number], top: number) => {
    const options = { size: 11, minSize: 8, field: field.label };
    const height = fitText(regular, field.value, { width: field.width, height: 12 }, options) ? 12 : 24;
    textBox(page, regular, field.label, { x: field.labelX, top, width: field.labelWidth, height: 12 }, {
      size: 11, minSize: 10.5, verticalAlign: "bottom", field: field.label + " label",
    });
    textBox(page, regular, field.value, { x: field.x, top, width: field.width, height }, {
      ...options, verticalAlign: "bottom",
    });
    rule(page, field.x - 1, top + height + 1, field.x + field.width);
    return height;
  };
  const identityHeight = Math.max(...fields.map(field => inlineField(field, 216)));
  const studentHeight = inlineField({
    label: "Student No.:", value: input.studentNumber, labelX: 258, labelWidth: 59, x: 321, width: 68,
  }, 232 + identityHeight - 12);
  const bodyShift = identityHeight + studentHeight - 24;

  const tableX = 76;
  const tableTop = 254 + bodyShift;
  const columnWidths = [196, 94, 82, 70] as const;
  const tableWidth = columnWidths.reduce((sum, width) => sum + width, 0);
  const headerHeight = 42;
  const rowHeight = 24;
  const tableHeight = headerHeight + ORAL_EXAM_SUMMARY_ROW_CAPACITY * rowHeight;
  page.drawRectangle({
    x: tableX, y: A4.height - tableTop - tableHeight,
    width: tableWidth, height: tableHeight, borderWidth: 0.6, borderColor: grayscale(0),
  });
  let columnX = tableX;
  const columns = columnWidths.map(width => {
    const column = { x: columnX, width };
    columnX += width;
    return column;
  });
  for (const column of columns.slice(1)) {
    page.drawLine({
      start: { x: column.x, y: A4.height - tableTop },
      end: { x: column.x, y: A4.height - tableTop - tableHeight }, thickness: 0.6,
    });
  }
  for (let row = 0; row < ORAL_EXAM_SUMMARY_ROW_CAPACITY; row++) {
    rule(page, tableX, tableTop + headerHeight + row * rowHeight, tableX + tableWidth, 0.6);
  }
  ["PANEL OF EXAMINERS", "RATING FOR\nGROUP A", "RATING FOR\nGROUP B", "AVERAGE"].forEach((label, index) => {
    const column = columns[index];
    text(label, column.x + 5, tableTop + (index === 1 || index === 2 ? 11 : 17),
      column.width - 10, 27, 10, regular, "center", label.replace("\n", " "));
  });
  // Draw every physical row, filling only explicit caller-supplied values.
  input.examiners.forEach((examiner, index) => {
    const values = [examiner.examinerName, examiner.groupARating, examiner.groupBRating, examiner.average];
    values.forEach((value, columnIndex) => {
      const column = columns[columnIndex];
      const cell = {
        x: column.x + 6, top: tableTop + headerHeight + index * rowHeight + 2,
        width: column.width - 12, height: rowHeight - 4,
      };
      const options = {
        size: 10, minSize: 8, align: columnIndex === 0 ? "left" as const : "center" as const,
        field: "Examiner " + (index + 1) + " " + ["name", "Group A rating", "Group B rating", "Average"][columnIndex],
      };
      const fitted = fitText(regular, value, cell, options);
      textBox(page, regular, value, {
        ...cell, top: cell.top + (fitted ? (cell.height - fitted.height) / 2 : 0),
      }, options);
    });
  });

  text("Submitted by:", 254, 456 + bodyShift, 150, 16, 10.5, boldItalic);
  const signatoryName = (value: string, x: number, lineTop: number, width: number, field: string) => {
    textBox(page, regular, value, { x: x + 4, top: lineTop - 20, width: width - 8, height: 19 }, {
      size: 10.5, minSize: 8, align: "center", verticalAlign: "bottom", field,
    });
    rule(page, x, lineTop, x + width);
  };
  for (let slot = 0; slot <= ORAL_EXAM_SUMMARY_MEMBER_LINE_CAPACITY; slot++) {
    const lineTop = 496 + bodyShift + slot * 21;
    const caption = slot === 0 ? ", Chairman" : ", Member";
    const name = slot === 0 ? input.submittedBy.chairmanName : input.submittedBy.memberNames[slot - 1] ?? "";
    signatoryName(name, 254, lineTop, 160, slot === 0 ? "Chairman name" : "Member " + slot + " name");
    textBox(page, regular, caption, { x: 416, top: lineTop - 13, width: 88, height: 12 }, {
      size: 10.5, minSize: 10.5, verticalAlign: "bottom", field: caption,
    });
  }

  // Title Defense has no Adviser seat, so its entire concurrence block is absent.
  if (input.stage !== "title") {
    text("Concurred In:", 76, 610 + bodyShift, 150, 16, 11);
    signatoryName(input.adviserName, 76, 660 + bodyShift, 140, "Adviser name");
    text("Thesis/Dissertation Adviser", 76, 664 + bodyShift, 155, 14, 10.5);
  }
  // Proposal/Final keep Dean attestation in its printed lower-page region for
  // long top fields too. Without the Adviser block, Title places the same Dean
  // block in that freed region instead of leaving an accidental empty gap.
  const deanTop = input.stage === "title" ? 610 + bodyShift : 722;
  text("Attested:", 76, deanTop, 130, 16, 11);
  signatoryName(input.deanName, 76, deanTop + 46, 140, "Dean name");
  text("Dean, Graduate School", 76, deanTop + 50, 160, 14, 10.5);
  return doc.save();
}
