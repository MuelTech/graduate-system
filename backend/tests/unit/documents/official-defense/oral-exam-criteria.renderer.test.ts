import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument } from "pdf-lib";
import { beforeAll, describe, expect, it } from "vitest";
import { renderOralExamCriteria } from "../../../../src/documents/official-defense/oral-exam-criteria/oral-exam-criteria.renderer";
import type { OralExamCriteriaRenderInput } from "../../../../src/documents/official-defense/oral-exam-criteria/oral-exam-criteria.types";

let input: OralExamCriteriaRenderInput;

beforeAll(async () => {
  const assets = path.resolve(__dirname, "../../../../assets/official-forms");
  input = {
    logos: {
      earist: { mimeType: "image/jpeg", bytes: await readFile(path.join(assets, "earist-logo.jpg")) },
      graduateSchool: { mimeType: "image/jpeg", bytes: await readFile(path.join(assets, "graduate-school-logo.jpg")) },
    },
    candidateName: "Sample Candidate", course: "MAEd", date: "22 October 2026",
    groupI: ["1.00", "1.25", "1.50", "1.75", "2.00"],
    groupII: ["2.50", null, "1.25", "1.50"],
    groupIAverage: "SUPPLIED I", groupIIAverage: "SUPPLIED II",
    recommendations: "Sample recommendations only.", rating: "Supplied rating",
    remarks: "Supplied remarks", evaluatorPrintedName: "Dr. Sample Panelist",
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
    const page = await pdf.getPage(1);
    return (await page.getTextContent()).items.filter((item: unknown): item is TextItem =>
      typeof (item as TextItem).str === "string");
  } finally {
    await task.destroy();
  }
}

describe("TEMPLATE-1 pure Oral Examination Criteria renderer", () => {
  it("returns a deterministic valid single-page A4 PDF from explicit inputs", async () => {
    const bytes = await renderOralExamCriteria(input);
    expect(Buffer.from(bytes).subarray(0, 5).toString()).toBe("%PDF-");
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
    expect(doc.getPage(0).getWidth()).toBeCloseTo(595.28, 2);
    expect(doc.getPage(0).getHeight()).toBeCloseTo(841.89, 2);
    expect(await renderOralExamCriteria(input)).toEqual(bytes);
  });

  it("preserves the institutional text and all six matrix choices without calculating supplied values", async () => {
    const items = await inspect(await renderOralExamCriteria(input));
    const text = items.map(item => item.str).join(" ");
    for (const label of [
      "Republic of the Philippines", 'EULOGIO "AMANG" RODRIGUEZ',
      "INSTITUTE OF SCIENCE AND TECHNOLOGY", "Nagtahan, Sampaloc, Manila",
      "GRADUATE SCHOOL", "Oral Examination Criteria", "Candidate:", "Course:", "Date:",
      "Group I", "Group II", "Organization", "Evidence of original thinking", "Presentation",
      "Mastery of Subject Matter", "Communication Skill", "Attitude (Receptive to suggestions)",
      "Excellent", "Highly Satisfactory", "Very Satisfactory", "Satisfactory", "Barely Satisfactory", "Fail",
      "Legend:", "Recommendations:", "SUMMARY OF EVALUATION", "Rating:", "Remarks:",
      "Signature over printed name of Panelist", "SUPPLIED I", "SUPPLIED II", "Supplied rating", "Supplied remarks",
    ]) expect(text).toContain(label);
    for (const value of ["1.00", "1.25", "1.50", "1.75", "2.00", "2.50"]) {
      expect(items.filter(item => item.str === value)).toHaveLength(2);
    }
    expect(items.filter(item => item.str === "X")).toHaveLength(8);
    expect(text).not.toMatch(/GS-\d+|Rev\.|PASSED|REDEFENSE/);
  });

  it("renders realistic long values within print-safe page bounds and retains their complete text", async () => {
    const long = {
      ...input,
      candidateName: "Maria Alexandra de los Santos-Villanueva",
      course: "PhD in Education - Educational Leadership",
      date: "30 September 2026",
      recommendations: "Clarify the sampling procedure and strengthen the discussion of educational implications. Review the alignment of conclusions with the research objectives.",
      evaluatorPrintedName: "Dr. Maria Esperanza de la Cruz-Villanueva",
    };
    const items = await inspect(await renderOralExamCriteria(long));
    const text = items.map(item => item.str).join(" ");
    for (const value of [long.candidateName, long.course, long.date, long.recommendations, long.evaluatorPrintedName]) {
      expect(text).toContain(value);
    }
    for (const item of items.filter(item => item.str.trim())) {
      expect(item.transform[4]).toBeGreaterThanOrEqual(36);
      expect(item.transform[4] + item.width).toBeLessThanOrEqual(559.28);
      expect(item.transform[5]).toBeGreaterThanOrEqual(36);
      expect(item.transform[5] + item.height).toBeLessThanOrEqual(805.89);
    }
  });

  it("leaves blank rows unmarked and supports supplied PNG signature bytes", async () => {
    const blank = await inspect(await renderOralExamCriteria({
      ...input, groupI: [null, null, null, null, null], groupII: [null, null, null, null],
      // Synthetic 1x1 PNG exercises embedding, never production signature retrieval.
      evaluatorSignature: {
        mimeType: "image/png",
        bytes: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZ1kAAAAASUVORK5CYII=", "base64"),
      },
    }));
    expect(blank.some(item => item.str === "X")).toBe(false);
    expect(blank.map(item => item.str).join(" ")).toContain(input.evaluatorPrintedName);
  });

  it("rejects overflow instead of clipping or silently truncating academic content", async () => {
    await expect(renderOralExamCriteria({ ...input, recommendations: "Long recommendation ".repeat(200) }))
      .rejects.toThrow(/Recommendations exceeds/);
  });

  it("rejects malformed matrices from untyped callers instead of losing criterion values", async () => {
    await expect(renderOralExamCriteria({ ...input, groupI: ["1.00"] } as unknown as OralExamCriteriaRenderInput))
      .rejects.toThrow(/Group I requires 5/);
    await expect(renderOralExamCriteria({ ...input, groupII: ["3.00", null, null, null] } as unknown as OralExamCriteriaRenderInput))
      .rejects.toThrow(/printed institutional matrix/);
  });
});
