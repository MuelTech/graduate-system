import { readFile } from "node:fs/promises";
import path from "node:path";
import { decodePDFRawStream, PDFArray, PDFDict, PDFDocument, PDFName, PDFRawStream } from "pdf-lib";
import { beforeAll, describe, expect, expectTypeOf, it } from "vitest";
import { renderAdviserRequest } from "../../../../src/documents/official-defense/adviser-request/adviser-request.renderer";
import type { AdviserRequestRenderInput } from "../../../../src/documents/official-defense/adviser-request/adviser-request.types";

let input: AdviserRequestRenderInput;
beforeAll(async () => {
  const assets = path.resolve(__dirname, "../../../../assets/official-forms");
  input = {
    logos: {
      earist: { mimeType: "image/jpeg", bytes: await readFile(path.join(assets, "earist-logo.jpg")) },
      graduateSchool: { mimeType: "image/jpeg", bytes: await readFile(path.join(assets, "graduate-school-logo.jpg")) },
    },
    requestDate: "October 25, 2026", requestedAdviserName: "Dr. Andrea V. Flores",
    reason: "her expertise in educational technology will support the development of my study.",
    studentName: "Alexandra M. Santos", studentNumber: "2026-00123",
    programName: "Master of Arts in Education",
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
const topOfBaseline = (item: TextItem) => 841.89 - item.transform[5];

async function pageContent(bytes: Uint8Array): Promise<string> {
  const doc = await PDFDocument.load(bytes);
  const contents = doc.getPage(0).node.Contents();
  const entries = contents instanceof PDFArray ? contents.asArray() : contents ? [contents] : [];
  return entries.map(entry => {
    const stream = doc.context.lookup(entry);
    return stream instanceof PDFRawStream ? Buffer.from(decodePDFRawStream(stream).decode()).toString("latin1") : "";
  }).join("\n");
}

async function imageTransforms(bytes: Uint8Array): Promise<number[][]> {
  return [...(await pageContent(bytes)).matchAll(
    /q\s+1 0 0 1 ([\d.]+) ([\d.]+) cm\s+1 0 0 1 0 0 cm\s+([\d.]+) 0 0 ([\d.]+) 0 0 cm\s+1 0 0 1 0 0 cm\s+\/[^\s]+ Do/g,
  )].map(match => match.slice(1).map(Number));
}

describe("GS020-1A pure official Adviser Request renderer", () => {
  it("renders deterministic one-page A4 PDF bytes without mutating the supplied input", async () => {
    const supplied = Object.freeze({ ...input, logos: Object.freeze({ ...input.logos }) });
    const before = JSON.stringify(supplied);
    const bytes = await renderAdviserRequest(supplied);
    expect(Buffer.from(bytes).subarray(0, 5).toString()).toBe("%PDF-");
    const doc = await PDFDocument.load(bytes, { updateMetadata: false });
    expect(doc.getPageCount()).toBe(1);
    expect(doc.getPage(0).getWidth()).toBeCloseTo(595.28, 2);
    expect(doc.getPage(0).getHeight()).toBeCloseTo(841.89, 2);
    expect(doc.getCreationDate()).toEqual(new Date(0));
    expect(doc.getModificationDate()).toEqual(new Date(0));
    expect(await renderAdviserRequest(supplied)).toEqual(bytes);
    expect(JSON.stringify(supplied)).toBe(before);
  });

  it("retains the official wording, footer, and explicit supplied display values", async () => {
    const text = joined(await inspect(await renderAdviserRequest(input)));
    for (const value of [
      "Republic of the Philippines", 'EULOGIO "AMANG" RODRIGUEZ', "INSTITUTE OF SCIENCE AND TECHNOLOGY",
      "Nagtahan, Sampaloc, Manila", "GRADUATE SCHOOL", "Adviser Request", "Date:",
      "The DEAN", "Graduate Studies", "EARIST, Manila", "Sir:", "May I respectfully request",
      "to be my thesis/", "dissertation adviser for the reason", "Very truly yours,",
      "Graduate Student", "(Signature Over Printed Name)", "Student No.:", "Program:",
      "CONFORME:", "Adviser", "Approved:", "Dean, Graduate School",
      "EARIST-QSF-GS-020 Rev. 00 (06.20.25)",
      input.requestDate, input.studentName, input.studentNumber, input.programName, input.reason,
    ]) expect(compact(text)).toContain(compact(value));
    expect(text.match(/Dr\. Andrea V\. Flores/g)).toHaveLength(2);
    expect(text).not.toMatch(/Title:|Thesis\/Dissertation Title|PASSED|REDEFENSE|Score|Verdict|Defense Stage/);
  });

  it("has only the approved display contract, with no second Adviser or Dean authority", () => {
    expectTypeOf<keyof AdviserRequestRenderInput>().toEqualTypeOf<
      "logos" | "requestDate" | "requestedAdviserName" | "reason" | "studentName"
      | "studentNumber" | "programName" | "studentSignature"
    >();
  });

  it("prints display-ready date text verbatim and ignores unrelated runtime domain fields", async () => {
    const supplied = {
      ...input, requestDate: "DISPLAY-DATE",
      deanName: "DO NOT PRINT DEAN", adviserName: "DO NOT PRINT SECOND ADVISER",
      manuscriptTitle: "DO NOT PRINT TITLE", stage: "final", verdict: "PASSED", score: "1.00",
      adviserRespondedAt: "RESPONSE-TIME", deanReviewedAt: "APPROVAL-TIME",
    };
    const text = joined(await inspect(await renderAdviserRequest(supplied)));
    expect(text).toContain("DISPLAY-DATE");
    expect(text).not.toMatch(/DO NOT PRINT|final|PASSED|1\.00|RESPONSE-TIME|APPROVAL-TIME/);
  });

  it("leaves all empty display fields and omitted Student signature blank", async () => {
    const bytes = await renderAdviserRequest({
      ...input, requestDate: "", requestedAdviserName: "", reason: "", studentName: "",
      studentNumber: "", programName: "", studentSignature: undefined,
    });
    const text = joined(await inspect(bytes));
    expect(text).toContain("EARIST-QSF-GS-020 Rev. 00 (06.20.25)");
    expect(text).toContain("(Signature Over Printed Name)");
    expect(text).not.toMatch(/Alexandra|Andrea|October|2026|expertise/);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPage(0).node.Resources()!.lookup(PDFName.of("XObject"), PDFDict).entries()).toHaveLength(2);
    expect(await imageTransforms(bytes)).toHaveLength(2);
  });

  it.each(["image/png", "image/jpeg"] as const)("contains the supplied %s signature above the Student printed name", async mimeType => {
    // Wide 240x60 geometric dummy from the accepted sample generator, or square JPEG.
    const script = await readFile(path.resolve(__dirname, "../../../../scripts/generate-adviser-request-samples.ts"), "utf8");
    const bytes = mimeType === "image/png"
      ? Buffer.from(script.match(/"(iVBOR[^"]+)"/)![1], "base64") : input.logos.earist.bytes;
    const supplied = { ...input, studentSignature: { mimeType, bytes } };
    const before = JSON.stringify(supplied);
    const pdfBytes = await renderAdviserRequest(supplied);
    expect(JSON.stringify(supplied)).toBe(before);
    expect(await renderAdviserRequest(supplied)).toEqual(pdfBytes);
    const doc = await PDFDocument.load(pdfBytes);
    expect(doc.getPage(0).node.Resources()!.lookup(PDFName.of("XObject"), PDFDict).entries()).toHaveLength(3);
    const transforms = await imageTransforms(pdfBytes);
    expect(transforms).toHaveLength(3);
    const [x, y, width, height] = transforms[2];
    expect(x).toBeGreaterThanOrEqual(330);
    expect(x + width).toBeLessThanOrEqual(502);
    expect(841.89 - y - height).toBeGreaterThanOrEqual(460);
    expect(841.89 - y).toBeLessThanOrEqual(484);
    expect(width / height).toBeCloseTo(mimeType === "image/png" ? 4 : 1, 6);
    expect(joined(await inspect(pdfBytes))).toContain(input.studentName);
  });

  it.each(["image/png", "image/jpeg", "image/gif"])("rejects invalid or unsupported %s signature data", async mimeType => {
    await expect(renderAdviserRequest({
      ...input, studentSignature: { mimeType: mimeType as never, bytes: new Uint8Array([1, 2, 3]) },
    })).rejects.toBeDefined();
  });

  it("preserves four explicit reason lines, unbroken text, and the shorter last rule", async () => {
    const lines = ["First supplied paragraph.", "Second supplied paragraph.", "A".repeat(60), "Last supplied paragraph."];
    const bytes = await renderAdviserRequest({ ...input, reason: lines.join("\r\n") });
    const items = await inspect(bytes);
    for (const [index, line] of lines.entries()) {
      const item = items.find(item => item.str === line)!;
      expect(item).toBeDefined();
      const x = index === 0 ? 240 : 76;
      const right = index === 3 ? 426 : 526;
      expect(item.transform[4]).toBeGreaterThanOrEqual(x);
      expect(item.transform[4] + item.width).toBeLessThanOrEqual(right);
      expect(topOfBaseline(item)).toBeGreaterThan(346 + index * 19);
      expect(topOfBaseline(item)).toBeLessThan(358 + index * 19);
    }
    const content = await pageContent(bytes);
    expect(content).toContain("76 426.89 m\n426 426.89 l");
  });

  it("retains explicit empty paragraphs in the reason", async () => {
    const items = await inspect(await renderAdviserRequest({ ...input, reason: "First line.\n\nThird line." }));
    const first = items.find(item => item.str === "First line.")!;
    const third = items.find(item => item.str === "Third line.")!;
    expect(first.transform[5] - third.transform[5]).toBeCloseTo(38, 6);
  });

  it("keeps long values readable within their fields and lower official regions stable", async () => {
    const long = {
      ...input,
      requestedAdviserName: "Dr. Maria Andrea Fernandez-Villanueva",
      studentName: "Maria Alexandra Esperanza de los Santos-Villanueva",
      studentNumber: "GS202600123456789012345678901234",
      programName: "Doctor of Philosophy in Educational Management and Institutional Leadership",
      reason: "her experience in educational management, accessible digital research services, and institutional leadership will help me develop a rigorous framework. Her guidance in research design, analysis, and ethical practice will strengthen the quality and relevance of my dissertation in public higher education.",
    };
    const items = await inspect(await renderAdviserRequest(long));
    const normal = await inspect(await renderAdviserRequest(input));
    const fields = [
      { value: long.requestedAdviserName, x: 240, right: 442, top: 312, bottom: 338 },
      { value: long.reason, x: 76, right: 526, top: 346, bottom: 415 },
      { value: long.studentName, x: 330, right: 502, top: 486, bottom: 513 },
      { value: long.studentNumber, x: 388, right: 512, top: 546, bottom: 571 },
      { value: long.programName, x: 374, right: 512, top: 576, bottom: 616 },
      { value: long.requestedAdviserName, x: 80, right: 238, top: 610, bottom: 637 },
    ];
    for (const field of fields) {
      const inside = items.filter(item => item.str.trim() && item.transform[4] >= field.x - 0.01
        && item.transform[4] < field.right && topOfBaseline(item) > field.top && topOfBaseline(item) < field.bottom);
      expect(compact(joined(inside))).toContain(compact(field.value));
      for (const item of inside) {
        expect(item.transform[4] + item.width).toBeLessThanOrEqual(field.right + 0.01);
        expect(item.height).toBeGreaterThanOrEqual(10);
      }
    }
    const reason = items.filter(item => item.str.trim() && topOfBaseline(item) > 346 && topOfBaseline(item) < 415 && item.transform[4] >= 240);
    expect(reason[0].transform[4]).toBe(240);
    for (const label of ["CONFORME:", "Adviser", "Approved:", "Dean, Graduate School", "EARIST-QSF-GS-020 Rev. 00 (06.20.25)"]) {
      expect(items.find(item => item.str === label)!.transform).toEqual(normal.find(item => item.str === label)!.transform);
    }
  });

  it("keeps the Dean identity/signature region empty", async () => {
    const bytes = await renderAdviserRequest(input);
    const items = await inspect(bytes);
    expect(items.filter(item => item.str.trim() && item.transform[4] < 242
      && topOfBaseline(item) > 719 && topOfBaseline(item) < 764)).toEqual([]);
    expect(await imageTransforms(bytes)).toHaveLength(2);
    const segments = [...(await pageContent(bytes)).matchAll(/76 ([\d.]+) m\s+214 ([\d.]+) l/g)];
    expect(segments).toHaveLength(1);
    expect(Number(segments[0][1])).toBeCloseTo(77.89, 6);
    expect(Number(segments[0][2])).toBeCloseTo(77.89, 6);
  });

  it.each([
    ["requestDate", "Request date"], ["requestedAdviserName", "Requested Adviser name"],
    ["reason", "Request reason"], ["studentName", "Student name"],
    ["studentNumber", "Student Number"], ["programName", "Program name"],
  ] as const)("rejects oversized %s with a field-specific error instead of truncating", async (field, label) => {
    await expect(renderAdviserRequest({ ...input, [field]: "Oversized supplied value ".repeat(100) }))
      .rejects.toThrow(new RangeError(`${label} exceeds the available space in the one-page form.`));
  });

  it("rejects a fifth explicit reason line even when the paragraphs are short", async () => {
    await expect(renderAdviserRequest({ ...input, reason: "a\nb\nc\nd\ne" })).rejects.toThrow(/Request reason exceeds/);
  });

  it("keeps the renderer and all transitive dependencies presentation-only", async () => {
    const base = path.resolve(__dirname, "../../../../src/documents/official-defense");
    const allowed = new Set([
      "pdf-lib", "../shared/institutional-header", "../shared/pdf-layout", "../shared/pdf-text",
      "./adviser-request.types", "./pdf-layout", "./pdf-text",
    ]);
    for (const file of [
      "adviser-request/adviser-request.renderer.ts", "adviser-request/adviser-request.types.ts",
      "shared/institutional-header.ts", "shared/pdf-layout.ts", "shared/pdf-text.ts",
    ]) {
      const source = await readFile(path.join(base, file), "utf8");
      for (const match of source.matchAll(/from\s+["']([^"']+)["']/g)) expect(allowed.has(match[1]), match[1]).toBe(true);
      expect(source).not.toMatch(/\b(?:require|import)\s*\(|@prisma|node:|fetch\s*\(|process\.|Date\.(?:now|parse)|new Date\(\s*\)/);
      for (const match of source.matchAll(/new Date\(([^)]*)\)/g)) expect(match[1]).toBe("0");
    }
  });
});
