import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument } from "pdf-lib";
import { beforeAll, describe, expect, it } from "vitest";
import {
  ORAL_EXAM_SUMMARY_ROW_CAPACITY, renderOralExamSummary,
} from "../../../../src/documents/official-defense/oral-exam-summary/oral-exam-summary.renderer";
import type { OralExamSummaryRenderInput } from "../../../../src/documents/official-defense/oral-exam-summary/oral-exam-summary.types";

let input: OralExamSummaryRenderInput;
beforeAll(async () => {
  const assets = path.resolve(__dirname, "../../../../assets/official-forms");
  input = {
    logos: {
      earist: { mimeType: "image/jpeg", bytes: await readFile(path.join(assets, "earist-logo.jpg")) },
      graduateSchool: { mimeType: "image/jpeg", bytes: await readFile(path.join(assets, "graduate-school-logo.jpg")) },
    },
    candidateName: "Alexandra M. Santos", course: "MAEd", date: "22 October 2026", studentNumber: "2026-00123",
    examiners: [{ examinerName: "Dr. Sample Examiner", groupARating: "1.00", groupBRating: "2.00", average: "9.99" }],
    submittedBy: { chairmanName: "Dr. Explicit Chairman", memberNames: ["Dr. Explicit Member"] },
    adviserName: "Dr. Explicit Adviser", deanName: "Dr. Explicit Dean",
  };
});
interface TextItem { str: string; width: number; height: number; transform: number[] }
async function inspect(bytes: Uint8Array): Promise<TextItem[]> {
  const specifier = "pdfjs-dist/legacy/build/pdf.mjs";
  const { getDocument } = await import(specifier);
  const task = getDocument({ data: bytes.slice(), verbosity: 0, disableFontFace: true, useSystemFonts: true });
  try {
    const pdf = await task.promise;
    expect(pdf.numPages).toBe(1);
    return (await (await pdf.getPage(1)).getTextContent()).items.filter((item: unknown): item is TextItem =>
      typeof (item as TextItem).str === "string");
  } finally {
    await task.destroy();
  }
}
const joined = (items: TextItem[]) => items.map(item => item.str).join(" ");
const compact = (value: string) => value.replace(/\s/g, "");
const blankNames = { submittedBy: { chairmanName: "", memberNames: [] }, adviserName: "", deanName: "" };

describe("TEMPLATE-2 pure GS-011 Oral Examination Summary renderer", () => {
  it("returns valid deterministic one-page A4 bytes without changing its explicit input", async () => {
    const before = JSON.stringify(input);
    const bytes = await renderOralExamSummary(input);
    expect(Buffer.from(bytes).subarray(0, 5).toString()).toBe("%PDF-");
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
    expect(doc.getPage(0).getWidth()).toBeCloseTo(595.28, 2);
    expect(doc.getPage(0).getHeight()).toBeCloseTo(841.89, 2);
    expect(await renderOralExamSummary(input)).toEqual(bytes);
    expect(JSON.stringify(input)).toBe(before);
  });

  it("preserves institutional labels and signatory captions, omitting the footer as requested", async () => {
    const items = await inspect(await renderOralExamSummary(input));
    const text = joined(items);
    for (const label of [
      "Republic of the Philippines", 'EULOGIO "AMANG" RODRIGUEZ',
      "INSTITUTE OF SCIENCE AND TECHNOLOGY", "Nagtahan, Sampaloc, Manila", "GRADUATE SCHOOL",
      "Oral Examination Summary Sheet", "CANDIDATE:", "Course:", "Date:", "Student No.:",
      "PANEL OF EXAMINERS", "RATING FOR GROUP A", "RATING FOR GROUP B", "AVERAGE",
      "Submitted by:", "Concurred In:", "Thesis/Dissertation Adviser", "Attested:", "Dean, Graduate School",
    ]) expect(text).toContain(label);
    expect(text).not.toContain("EARIST-QSF-GS-011");
    expect(text).not.toContain("Rev. 01 (06.20.25)");
    expect(items.filter(item => item.str.includes(", Chairman"))).toHaveLength(1);
    expect(items.filter(item => item.str.includes(", Member"))).toHaveLength(5);
  });

  it("renders supplied ratings and Average unchanged without deriving a score, verdict, or signers", async () => {
    const text = joined(await inspect(await renderOralExamSummary(input)));
    for (const value of [
      "Dr. Sample Examiner", "1.00", "2.00", "9.99", input.submittedBy.chairmanName,
      input.submittedBy.memberNames[0], input.adviserName, input.deanName,
    ]) expect(text).toContain(value);
    expect(text).not.toMatch(/1\.50|PASSED|FAILED|REDEFENSE/);
    const noSigners = joined(await inspect(await renderOralExamSummary({ ...input, ...blankNames })));
    expect(noSigners.match(/Dr\. Sample Examiner/g)).toHaveLength(1);
    expect(noSigners).not.toContain("Dr. Explicit");
  });

  it("retains six printed row slots, supports all six, and rejects excess rows or Member names", async () => {
    const names = ["Alpha", "Bravo", "Charlie", "Delta", "Echo", "Foxtrot"];
    const examiners = names.map(examinerName => ({ examinerName, groupARating: "", groupBRating: "", average: "" }));
    const items = await inspect(await renderOralExamSummary({ ...input, ...blankNames, examiners }));
    expect(ORAL_EXAM_SUMMARY_ROW_CAPACITY).toBe(6);
    const rows = names.map(name => {
      const matches = items.filter(item => item.str === name);
      expect(matches).toHaveLength(1);
      return matches[0];
    });
    rows.slice(1).forEach((row, i) => expect(rows[i].transform[5] - row.transform[5]).toBeCloseTo(24, 2));
    await expect(renderOralExamSummary({ ...input, examiners: [...examiners, examiners[0]] })).rejects.toThrow(/six examiner/);
    await expect(renderOralExamSummary({
      ...input, submittedBy: { chairmanName: "", memberNames: names },
    })).rejects.toThrow(/five Member/);
    const blank = joined(await inspect(await renderOralExamSummary({
      ...input, ...blankNames, candidateName: "", course: "", date: "", studentNumber: "", examiners: [],
    })));
    expect(blank).toContain("PANEL OF EXAMINERS");
    expect(blank).not.toContain("EARIST-QSF-GS-011");
    expect(blank).not.toMatch(/Dr\.|1\.00|2\.00|9\.99|Alexandra/);
  });

  it("keeps normal fields inline and names close to their printed signatory rules", async () => {
    const items = await inspect(await renderOralExamSummary(input));
    const find = (value: string) => {
      const item = items.find(item => item.str.includes(value));
      expect(item, value).toBeDefined();
      return item!;
    };
    for (const [label, value, ruleTop] of [
      ["CANDIDATE:", input.candidateName, 229], ["Course:", input.course, 229],
      ["Date:", input.date, 229], ["Student No.:", input.studentNumber, 245],
    ] as const) {
      const valueItem = find(value);
      expect(Math.abs(valueItem.transform[5] - find(label).transform[5])).toBeLessThan(0.25);
      const gap = ruleTop - (841.89 - valueItem.transform[5]);
      expect(gap).toBeGreaterThan(2);
      expect(gap).toBeLessThan(4);
    }
    for (const [value, ruleTop] of [
      [input.submittedBy.chairmanName, 496], [input.submittedBy.memberNames[0], 517],
      [input.adviserName, 660], [input.deanName, 768],
    ] as const) {
      const gap = ruleTop - (841.89 - find(value).transform[5]);
      expect(gap).toBeGreaterThan(2);
      expect(gap).toBeLessThan(4);
    }
  });

  it("retains long values inside page, table, and signatory bounds without collisions", async () => {
    const longNames = [
      "Dr. Maria Esperanza de la Cruz-Villanueva", "Dr. Juan Miguel de los Santos-Mendoza",
      "Dr. Alexandra Ysabel Santiago-Rodriguez", "Dr. Jose Antonio Garcia-de la Fuente",
      "Dr. Maria Consuelo Fernandez-Ramos", "Dr. Christopher Emmanuel del Rosario",
    ];
    const long = {
      ...input, candidateName: "Maria Alexandra de los Santos-Villanueva",
      course: "PhD in Educational Leadership", date: "30 September 2026", studentNumber: "GRAD-2026-000123456",
      examiners: longNames.map(examinerName => ({ examinerName, groupARating: "1.25", groupBRating: "1.50", average: "1.38" })),
      submittedBy: { chairmanName: longNames[0], memberNames: longNames.slice(1) },
      adviserName: "Dr. Maria Andrea Fernandez-Villanueva", deanName: "Dr. Jose Emmanuel de los Santos-Cruz",
    };
    const items = await inspect(await renderOralExamSummary(long));
    expect(joined(items)).not.toContain("EARIST-QSF-GS-011");
    const fullText = compact(joined(items));
    for (const value of [long.candidateName, long.course, long.date, long.studentNumber, ...longNames, long.adviserName, long.deanName]) {
      expect(fullText).toContain(compact(value));
    }
    for (const item of items.filter(item => item.str.trim())) {
      expect(item.transform[4]).toBeGreaterThanOrEqual(36);
      expect(item.transform[4] + item.width).toBeLessThanOrEqual(559.28);
      expect(item.transform[5]).toBeGreaterThanOrEqual(36);
      expect(item.transform[5] + item.height).toBeLessThanOrEqual(805.89);
    }
    // Long identity fields move the table only; six equally sized rows keep their own clearances.
    const tableTop = 278, headerHeight = 42, rowHeight = 24;
    for (let row = 0; row < 6; row++) {
      const top = tableTop + headerHeight + row * rowHeight;
      const rowItems = items.filter(item => {
        const baselineTop = 841.89 - item.transform[5];
        return item.str.trim() && baselineTop > top && baselineTop < top + rowHeight;
      });
      expect(rowItems.length).toBeGreaterThanOrEqual(4);
      for (const item of rowItems) {
        const x = item.transform[4];
        const edges = x < 272 ? [76, 272] : x < 366 ? [272, 366] : x < 448 ? [366, 448] : [448, 518];
        expect(x).toBeGreaterThanOrEqual(edges[0] + 4);
        expect(x + item.width).toBeLessThanOrEqual(edges[1] - 4);
        expect(841.89 - item.transform[5]).toBeLessThan(top + rowHeight - 2);
      }
    }
    const signerItems = items.filter(item => item.str.trim() && item.transform[4] >= 254
      && item.transform[4] < 414 && 841.89 - item.transform[5] > 495 && 841.89 - item.transform[5] < 625);
    expect(signerItems.length).toBeGreaterThan(6);
    // Keep at least four PDF-reader points before the adjacent caption at x=416.
    for (const item of signerItems) expect(item.transform[4] + item.width).toBeLessThanOrEqual(416 - 4);
  });

  it("fails explicitly for unbounded identity, rating, examiner, or signatory content", async () => {
    const oversized = "Oversized supplied value ".repeat(100);
    for (const [changed, message] of [
      [{ ...input, course: oversized }, /Course: exceeds/],
      [{ ...input, examiners: [{ ...input.examiners[0], examinerName: oversized }] }, /Examiner 1 name exceeds/],
      [{ ...input, examiners: [{ ...input.examiners[0], average: oversized }] }, /Examiner 1 Average exceeds/],
      [{ ...input, submittedBy: { chairmanName: oversized, memberNames: [] } }, /Chairman name exceeds/],
      [{ ...input, adviserName: oversized }, /Adviser name exceeds/],
      [{ ...input, deanName: oversized }, /Dean name exceeds/],
    ] as const) await expect(renderOralExamSummary(changed)).rejects.toThrow(message);
  });

  it("keeps production imports limited to pdf-lib and the bounded renderer/shared modules", async () => {
    const directory = path.resolve(__dirname, "../../../../src/documents/official-defense/oral-exam-summary");
    const allowed = new Set([
      "pdf-lib", "../shared/institutional-header", "../shared/pdf-layout", "../shared/pdf-text", "./oral-exam-summary.types",
    ]);
    for (const file of ["oral-exam-summary.renderer.ts", "oral-exam-summary.types.ts"]) {
      const source = await readFile(path.join(directory, file), "utf8");
      for (const match of source.matchAll(/from\s+["']([^"']+)["']/g)) expect(allowed.has(match[1]), match[1]).toBe(true);
      expect(source).not.toMatch(/\b(?:require|import)\s*\(/);
    }
  });
});
