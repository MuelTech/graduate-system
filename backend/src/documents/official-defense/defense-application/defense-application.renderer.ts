import {
  grayscale, PDFDocument, PDFFont, popGraphicsState, pushGraphicsState, StandardFonts, translate,
} from "pdf-lib";
import { institutionalHeader } from "../shared/institutional-header";
import { A4, rule } from "../shared/pdf-layout";
import { fitText, textBox } from "../shared/pdf-text";
import type { DefenseApplicationRenderInput } from "./defense-application.types";

// Blank references establish no official completed-form marking convention.
const QA_APPLICATION_MARKER = "X";

// Only observed form-family differences: these are physical layout facts, not workflow rules.
const VARIANTS = {
  masters: {
    heading: "MASTERS PROGRAM", code: "EARIST-QSF-GS-006 Rev. 01 (06.20.25)",
    mastheadUp: 2, schoolTop: 132, applicationTop: 154, selectionTop: 168, programTop: 194, identityTop: 218,
    deanLine: 650, recommendationTop: 686, vicePresidentLine: 724, approvedTop: 750, presidentLine: 776,
  },
  doctoral: {
    heading: "DOCTORAL PROGRAM", code: "EARIST-QSF-GS-007 Rev. 01 (06.20.25)",
    mastheadUp: 16, schoolTop: 118, applicationTop: 140, selectionTop: 154, programTop: 180, identityTop: 204,
    deanLine: 656, recommendationTop: 672, vicePresidentLine: 710, approvedTop: 732, presidentLine: 758,
  },
} as const;

/**
 * Presentation-only printed capacity. The centralized DefenseCommitteePolicy
 * remains authoritative for GS-IS committee membership; this table only maps
 * the already-decided stage/program to the number of printed rows.
 *
 * `blank` is the null applicationType layout: the program's maximum Panelist
 * capacity with no Adviser row. It is a neutral blank-form layout, not a Title
 * inference, and it keeps the total printed committee rows at 7/8 so lower-page
 * approval geometry remains stable.
 */
const PRINTED_PANELIST_ROWS = {
  masters: { title: 5, proposal: 4, final: 4, blank: 5 },
  doctoral: { title: 6, proposal: 5, final: 5, blank: 6 },
} as const;

function printedAdviserVisible(
  applicationType: DefenseApplicationRenderInput["applicationType"],
): boolean {
  return applicationType === "proposal" || applicationType === "final";
}

/** Static A4 GS-006/GS-007 family. No I/O, domain lookup, payment/approval inference, or HTTP. */
export async function renderDefenseApplication(input: DefenseApplicationRenderInput): Promise<Uint8Array> {
  if (input.variant !== "masters" && input.variant !== "doctoral") {
    throw new RangeError("Defense Application variant must be masters or doctoral.");
  }
  if (![null, "title", "proposal", "final"].includes(input.applicationType)) {
    throw new RangeError("Application type must be an explicit title, proposal, final, or null selection.");
  }
  const variant = VARIANTS[input.variant];
  const showAdviser = printedAdviserVisible(input.applicationType);
  if (!showAdviser && input.committee.adviserName?.trim()) {
    throw new RangeError(
      "The printed Adviser row is only available for Proposal or Final Defense.",
    );
  }
  const printedPanelistRows =
    PRINTED_PANELIST_ROWS[input.variant][input.applicationType ?? "blank"];
  if (input.committee.panelistNames.length > printedPanelistRows) {
    throw new RangeError(
      variant.heading + " has only " + printedPanelistRows + " printed Panelist slots for this application type.",
    );
  }
  const doc = await PDFDocument.create();
  doc.setCreationDate(new Date(0));
  doc.setModificationDate(new Date(0));
  doc.setTitle("EARIST Graduate School - Defense Application - " + variant.heading);
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
  const serifBoldItalic = await doc.embedFont(StandardFonts.TimesRomanBoldItalic);
  const text = (
    value: string, x: number, top: number, width: number, height: number,
    size = 9.5, font: PDFFont = regular, align: "left" | "center" = "left", field = value,
  ) => textBox(page, font, value, { x, top, width, height }, {
    size, minSize: Math.min(size, 8), align, field,
  });

  // Retain each reference's masthead placement; the closest logo is still 22 pt from the top.
  page.pushOperators(pushGraphicsState(), translate(0, variant.mastheadUp));
  await institutionalHeader(doc, page, input.logos, { roman, italic });
  page.pushOperators(popGraphicsState());
  text("GRADUATE SCHOOL", 68, variant.schoolTop, 470, 18, 15, serifBold, "center");
  text("Application for", 68, variant.applicationTop, 470, 14, 11, serifBoldItalic, "center");
  const selection = "(   ) Title / (   ) Proposal / (   ) Final Defense";
  const selectionSize = 10.5;
  const selectionX = 303 - serifBoldItalic.widthOfTextAtSize(selection, selectionSize) / 2;
  // Draw this measured static line directly to preserve the intentional spaces in (   ).
  const selectionAscent = serifBoldItalic.heightAtSize(selectionSize, { descender: false });
  page.drawText(selection, {
    x: selectionX, y: A4.height - variant.selectionTop - selectionAscent, font: serifBoldItalic, size: selectionSize,
  });
  if (input.applicationType !== null) {
    const prefix = input.applicationType === "title" ? "" : input.applicationType === "proposal"
      ? "(   ) Title / " : "(   ) Title / (   ) Proposal / ";
    const markX = selectionX + serifBoldItalic.widthOfTextAtSize(prefix + "(", selectionSize);
    const markerTop = variant.selectionTop + selectionAscent - serifBoldItalic.heightAtSize(9, { descender: false });
    text(QA_APPLICATION_MARKER, markX, markerTop, serifBoldItalic.widthOfTextAtSize("   ", selectionSize),
      14, 9, serifBoldItalic, "center", "Unconfirmed QA application marker");
  }
  text(variant.heading, 68, variant.programTop, 470, 18, 13, serifBold, "center");

  // Five compact paired rows; only genuine wrapping reserves a second line.
  const identityRows = [
    [
      { label: "Name:", value: input.studentName, labelX: 76, x: 105, width: 201, field: "Student name" },
      { label: "Amount Paid:", value: input.amountPaid, labelX: 328, x: 391, width: 131, field: "Amount paid" },
    ],
    [
      { label: "Course & Major:", value: input.courseAndMajor, labelX: 76, x: 150, width: 156, field: "Course & Major" },
      { label: "O.R. No.:", value: input.officialReceiptNumber, labelX: 328, x: 371, width: 151, field: "O.R. number" },
    ],
    [
      { label: "Student No.:", value: input.studentNumber, labelX: 76, x: 134, width: 172, field: "Student number" },
      { label: "Date of Application:", value: input.dateOfApplication, labelX: 328, x: 421, width: 101, field: "Date of Application" },
    ],
    [
      { label: "Cellphone No.:", value: input.cellphoneNumber, labelX: 76, x: 145, width: 161, field: "Cellphone number" },
      { label: "Email: (Personal Gmail Only)", value: input.personalGmail, labelX: 328, x: 445, width: 77, field: "Personal Gmail" },
    ],
    [
      { label: "Date and Time.:", value: input.applicantDateAndTime, labelX: 76, x: 149, width: 160, field: "Applicant date and time" },
    ],
  ];
  let rowTop = variant.identityTop;
  let identityExtra = 0;
  for (const fields of identityRows) {
    const planned = fields.map(field => {
      const options = { size: 10, minSize: 8, field: field.field };
      const height = fitText(regular, field.value, { width: field.width, height: 12 }, options) ? 12 : 20;
      return { ...field, options, height };
    });
    const rowHeight = Math.max(...planned.map(field => field.height));
    identityExtra += rowHeight - 12;
    if (identityExtra > 24) {
      throw new RangeError(planned.find(field => field.height > 12)!.field
        + " exceeds the combined application-field space in the one-page form.");
    }
    for (const field of planned) {
      textBox(page, bold, field.label, {
        x: field.labelX, top: rowTop, width: field.x - field.labelX - 3, height: 12,
      }, { size: 9.5, minSize: 8, verticalAlign: "bottom", field: field.field + " label" });
      textBox(page, regular, field.value, {
        x: field.x, top: rowTop, width: field.width, height: field.height,
      }, { ...field.options, verticalAlign: "bottom" });
      rule(page, field.x - 1, rowTop + field.height + 1, field.x + field.width);
    }
    rowTop += rowHeight + 2;
  }
  text("Note: Please write legibly", 143, rowTop + 1, 190, 13, 9.5, oblique);
  const tableTop = rowTop + 16;
  const tableX = 68, tableWidth = 470;
  const feeWidths = [240, 120, 110] as const;
  const feeOffsets = [tableX, tableX + feeWidths[0], tableX + feeWidths[0] + feeWidths[1]];
  const feeRows = [
    ["(Pay to Cashier's Office)", "PROPOSAL DEFENSE", "FINAL DEFENSE"],
    ["Defense Fee", "300", "300"],
    ["Administrative and Technical Fee", "300", "300"],
    ["Energy and Venue Fee", "300", "300"],
    ["", "P 900.00", "P 900.00"],
  ] as const;
  const warningHeight = 13, feeRowHeight = 12.5, scheduleRowHeight = 14, committeeHeadingHeight = 24;
  const scheduleTop = tableTop + warningHeight + feeRows.length * feeRowHeight;
  // Schedule fields use two bounded lines: Date/Time, then a full-width Link.
  // Link/venue text keeps its exact value and may wrap inside a measured row.
  const linkLabelWidth = 24;
  const linkValueWidth = tableWidth - linkLabelWidth - 10;
  const linkLayout = input.defenseLink
    ? fitText(regular, input.defenseLink, { width: linkValueWidth, height: 28 }, {
      size: 9.5, minSize: 8, field: "Defense link",
    })
    : undefined;
  if (input.defenseLink && !linkLayout) {
    throw new RangeError("Defense link exceeds the available space in the one-page form.");
  }
  const linkRowHeight = linkLayout
    ? Math.max(scheduleRowHeight, linkLayout.height + 4)
    : scheduleRowHeight;
  const scheduleHeight = scheduleRowHeight + linkRowHeight;
  const committeeHeadingTop = scheduleTop + scheduleHeight;
  const committeeTop = committeeHeadingTop + committeeHeadingHeight;
  const committeeNames: { label: string; name: string; field: string }[] = [];
  if (showAdviser) {
    committeeNames.push({
      label: "Adviser",
      name: input.committee.adviserName ?? "",
      field: "Adviser name",
    });
  }
  for (let index = 0; index < printedPanelistRows; index++) {
    committeeNames.push({
      label: "Panelist",
      name: input.committee.panelistNames[index] ?? "",
      field: "Panelist " + (index + 1) + " name",
    });
  }
  committeeNames.push(
    { label: "Facilitator", name: input.committee.facilitatorName, field: "Facilitator name" },
    { label: "Rapporteur", name: input.committee.rapporteurName, field: "Rapporteur name" },
  );
  const committeeRowHeight = 26;
  const tableBottom = committeeTop + committeeNames.length * committeeRowHeight;
  page.drawRectangle({
    x: tableX, y: A4.height - tableBottom, width: tableWidth, height: tableBottom - tableTop,
    borderWidth: 0.6, borderColor: grayscale(0),
  });
  const vertical = (x: number, top: number, bottom: number) => page.drawLine({
    start: { x, y: A4.height - top }, end: { x, y: A4.height - bottom }, thickness: 0.6,
  });
  text("(Do not fill-out beyond this line)", tableX, tableTop + 2, tableWidth, 12, 9.5, bold, "center");
  rule(page, tableX, tableTop + warningHeight, tableX + tableWidth, 0.6);
  feeRows.forEach((values, rowIndex) => {
    const top = tableTop + warningHeight + rowIndex * feeRowHeight;
    values.forEach((value, column) => text(value, feeOffsets[column] + 5, top + 2,
      feeWidths[column] - 10, 10.5, 9.5,
      rowIndex === 4 ? boldOblique : column > 0 ? oblique : regular,
      column > 0 ? "center" : "left"));
    rule(page, tableX, top + feeRowHeight, tableX + tableWidth, 0.6);
  });
  for (const offset of feeOffsets.slice(1)) {
    vertical(offset, tableTop + warningHeight, scheduleTop + scheduleRowHeight);
  }
  const schedule = [
    { label: "Date of Defense:", value: input.defenseDate, x: tableX, width: 240, labelWidth: 76, field: "Defense date" },
    { label: "Time:", value: input.defenseTime, x: tableX + 240, width: 230, labelWidth: 28, field: "Defense time" },
  ];
  for (const field of schedule) {
    text(field.label, field.x + 5, scheduleTop + 3, field.labelWidth, 11, 9.5, oblique);
    text(field.value, field.x + field.labelWidth + 5, scheduleTop + 2,
      field.width - field.labelWidth - 10, 11.5, 9.5, regular, "left", field.field);
  }
  vertical(tableX + 240, scheduleTop, scheduleTop + scheduleRowHeight);
  rule(page, tableX, scheduleTop + scheduleRowHeight, tableX + tableWidth, 0.6);
  text("Link:", tableX + 5, scheduleTop + scheduleRowHeight + 3,
    linkLabelWidth, 11, 9.5, oblique);
  text(input.defenseLink, tableX + linkLabelWidth + 5,
    scheduleTop + scheduleRowHeight + 2, linkValueWidth, linkRowHeight - 2,
    9.5, regular, "left", "Defense link");
  rule(page, tableX, committeeHeadingTop, tableX + tableWidth, 0.6);
  text("EXAMINATION COMMITTEE:", tableX, committeeHeadingTop + 7, tableWidth, 15, 10, bold, "center");
  rule(page, tableX, committeeTop, tableX + tableWidth, 0.6);
  const nameWidth = 388;
  vertical(tableX + nameWidth, committeeTop, tableBottom);
  committeeNames.forEach((slot, index) => {
    const top = committeeTop + index * committeeRowHeight;
    textBox(page, regular, slot.name, { x: tableX + 10, top: top + 2, width: nameWidth - 20, height: 12 }, {
      size: 10, minSize: 8, align: "center", verticalAlign: "bottom", field: slot.field,
    });
    rule(page, tableX + 6, top + 15, tableX + nameWidth - 6, 1.1);
    text(slot.label, tableX, top + 17, nameWidth, 11, 9.5, oblique, "center");
    if (index + 1 < committeeNames.length) rule(page, tableX, top + committeeRowHeight, tableX + tableWidth, 0.6);
  });

  const signature = (name: string, lineTop: number, caption: string, field: string) => {
    textBox(page, regular, name, { x: 238, top: lineTop - 21, width: 132, height: 20 }, {
      size: 10, minSize: 8, align: "center", verticalAlign: "bottom", field,
    });
    rule(page, 236, lineTop, 372);
    text(caption, 204, lineTop + 4, 200, 12, 9.5, regular, "center");
  };
  // Keep the approval block after the table; short values retain the accepted
  // positions, while a wrapped Link shifts it only as far as needed.
  const deanLine = Math.max(variant.deanLine + identityExtra, tableBottom + 30);
  const recommendationTop = Math.max(variant.recommendationTop, deanLine + 24);
  const vicePresidentLine = Math.max(variant.vicePresidentLine, recommendationTop + 29);
  const approvedTop = Math.max(variant.approvedTop, vicePresidentLine + 23);
  const presidentLine = Math.max(variant.presidentLine, approvedTop + 29);
  text("Prepared by:", 68, tableBottom + 14, 150, 13, 9.5, oblique);
  signature(input.deanName, deanLine, "Dean, Graduate School", "Dean name");
  text("Recommending Approval:", 68, recommendationTop, 190, 13, 9.5, oblique);
  signature(input.vicePresidentName, vicePresidentLine, "Vice President for Academic Affairs", "Vice President name");
  text("Approved:", 68, approvedTop, 130, 13, 9.5, oblique);
  signature(input.presidentName, presidentLine, "President", "President name");
  text(variant.code, 76, 795, 460, 13, 10, oblique);
  return doc.save();
}
