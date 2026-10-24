import { readFile } from "node:fs/promises";
import path from "node:path";
import { decodePDFRawStream, PDFArray, PDFDict, PDFDocument, PDFName, PDFRawStream } from "pdf-lib";
import { beforeAll, describe, expect, expectTypeOf, it } from "vitest";
import { renderAdviserCertification } from "../../../../src/documents/official-defense/adviser-certification/adviser-certification.renderer";
import type { AdviserCertificationRenderInput, AdviserCertificationStage } from "../../../../src/documents/official-defense/adviser-certification/adviser-certification.types";

let input: AdviserCertificationRenderInput;
beforeAll(async () => {
  const assets = path.resolve(__dirname, "../../../../assets/official-forms");
  input = {
    logos: {
      earist: { mimeType: "image/jpeg", bytes: await readFile(path.join(assets, "earist-logo.jpg")) },
      graduateSchool: { mimeType: "image/jpeg", bytes: await readFile(path.join(assets, "graduate-school-logo.jpg")) },
    },
    stage: "proposal",
    manuscriptTitle: "Digital Learning Resources and Student Engagement in Graduate Education",
    studentName: "Alexandra M. Santos", programName: "Master of Arts in Education",
    issuedDay: "24", issuedMonthYear: "October 2026", adviserPrintedName: "Dr. Andrea V. Flores",
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

async function pageContent(bytes: Uint8Array): Promise<string> {
  const doc = await PDFDocument.load(bytes);
  const contents = doc.getPage(0).node.Contents();
  const entries = contents instanceof PDFArray ? contents.asArray() : contents ? [contents] : [];
  return entries.map(entry => {
    const stream = doc.context.lookup(entry);
    return stream instanceof PDFRawStream ? Buffer.from(decodePDFRawStream(stream).decode()).toString("latin1") : "";
  }).join("\n");
}

describe("PREDEF-1A pure GS-017 Adviser Certification renderer", () => {
  it.each(["proposal", "final"] as const)("renders deterministic one-page A4 %s PDF bytes without input mutation", async stage => {
    const supplied = { ...input, stage };
    const before = JSON.stringify(supplied);
    const bytes = await renderAdviserCertification(supplied);
    expect(Buffer.from(bytes).subarray(0, 5).toString()).toBe("%PDF-");
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
    expect(doc.getPage(0).getWidth()).toBeCloseTo(595.28, 2);
    expect(doc.getPage(0).getHeight()).toBeCloseTo(841.89, 2);
    expect(await renderAdviserCertification(supplied)).toEqual(bytes);
    expect(JSON.stringify(supplied)).toBe(before);
  });

  it("preserves the official wording, footer, and explicit display values", async () => {
    const text = joined(await inspect(await renderAdviserCertification(input)));
    for (const label of [
      "Republic of the Philippines", 'EULOGIO "AMANG" RODRIGUEZ', "INSTITUTE OF SCIENCE AND TECHNOLOGY",
      "Nagtahan, Sampaloc, Manila", "GRADUATE SCHOOL", "THESIS/DISSERTATION ADVISER’S CERTIFICATION",
      "This is to certify that the Thesis/Dissertation manuscript titled", "presented by", "(name of student)",
      "under the program of", "was", "reviewed and certified as eligible for thesis/ dissertation",
      "proposal", "final defense.", "Issued this", "day of", "(Month/Year) upon the request of Ms./Mr.",
      "(Adviser’s Printed Name and Signature)", "EARIST-QSF-GS-017 Rev. 01 (06.20.25)",
      input.manuscriptTitle, input.programName, input.issuedDay, input.issuedMonthYear, input.adviserPrintedName,
    ]) expect(text).toContain(label);
    expect(text.match(/Alexandra M\. Santos/g)).toHaveLength(2);
    expect(text).not.toMatch(/Title Defense|PASSED|REDEFENSE|Certified by|Student No\./);
  });

  it.each(["title", "Title", "Proposal", "other", "", null, undefined])("rejects unsupported stage %s at runtime", async stage => {
    await expect(renderAdviserCertification({ ...input, stage: stage as never })).rejects.toThrow(/stage must be proposal or final/);
  });

  it("exposes only Proposal/Final in the typed stage contract", () => {
    expectTypeOf<AdviserCertificationStage>().toEqualTypeOf<"proposal" | "final">();
    expectTypeOf<Extract<"title", AdviserCertificationStage>>().toEqualTypeOf<never>();
  });

  it.each(["proposal", "final"] as const)("marks only %s with two vector segments inside its parentheses", async stage => {
    const bytes = await renderAdviserCertification({ ...input, stage });
    const items = await inspect(bytes);
    expect(items.some(item => item.str === "X")).toBe(false);
    const selection = items.find(item => item.str.includes("reviewed and certified"))!;
    expect(selection).toBeDefined();
    const doc = await PDFDocument.load(bytes);
    const { StandardFonts } = await import("pdf-lib");
    const font = await doc.embedFont(StandardFonts.HelveticaBold);
    const prefix = stage === "proposal" ? "reviewed and certified as eligible for thesis/ dissertation "
      : "reviewed and certified as eligible for thesis/ dissertation (   ) proposal ";
    const left = selection.transform[4] + font.widthOfTextAtSize(prefix + "(", 10);
    const right = left + font.widthOfTextAtSize("   ", 10);
    const segments = [...(await pageContent(bytes)).matchAll(
      /(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+m\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+l/g,
    )].map(match => match.slice(1).map(Number)).filter(([x1, y1, x2, y2]) => x1 !== x2 && y1 !== y2);
    expect(segments).toHaveLength(2);
    for (const [x1, y1, x2, y2] of segments) {
      expect(Math.min(x1, x2)).toBeGreaterThan(left);
      expect(Math.max(x1, x2)).toBeLessThan(right);
      expect(Math.min(y1, y2)).toBeGreaterThan(selection.transform[5]);
      expect(Math.max(y1, y2)).toBeLessThan(selection.transform[5] + selection.height);
    }
  });

  it("keeps blank display values and an omitted signature blank, while retaining the form", async () => {
    const bytes = await renderAdviserCertification({
      ...input, manuscriptTitle: "", studentName: "", programName: "",
      issuedDay: "", issuedMonthYear: "", adviserPrintedName: "", adviserSignature: undefined,
    });
    const text = joined(await inspect(bytes));
    expect(text).toContain("EARIST-QSF-GS-017 Rev. 01 (06.20.25)");
    expect(text).toContain("(Adviser’s Printed Name and Signature)");
    expect(text).not.toMatch(/Alexandra|Andrea|October|2026/);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPage(0).node.Resources()!.lookup(PDFName.of("XObject"), PDFDict).entries()).toHaveLength(2);
  });

  it.each(["image/png", "image/jpeg"] as const)("embeds explicitly supplied %s signature bytes without changing printed identity", async mimeType => {
    const bytes = mimeType === "image/png"
      ? Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZ1kAAAAASUVORK5CYII=", "base64")
      : input.logos.earist.bytes;
    const pdfBytes = await renderAdviserCertification({ ...input, adviserSignature: { mimeType, bytes } });
    const doc = await PDFDocument.load(pdfBytes);
    expect(doc.getPage(0).node.Resources()!.lookup(PDFName.of("XObject"), PDFDict).entries()).toHaveLength(3);
    expect(joined(await inspect(pdfBytes))).toContain(input.adviserPrintedName);
    // The third draw-image transform remains wholly inside the signature box,
    // above the printed-name area and below the request continuation.
    const transforms = [...(await pageContent(pdfBytes)).matchAll(
      /q\s+1 0 0 1 ([\d.]+) ([\d.]+) cm\s+1 0 0 1 0 0 cm\s+([\d.]+) 0 0 ([\d.]+) 0 0 cm\s+1 0 0 1 0 0 cm\s+\/[^\s]+ Do/g,
    )];
    expect(transforms).toHaveLength(3);
    const [x, y, width, height] = transforms[2].slice(1).map(Number);
    expect(x).toBeGreaterThanOrEqual(80);
    expect(x + width).toBeLessThanOrEqual(238);
    expect(841.89 - y - height).toBeGreaterThanOrEqual(488);
    expect(841.89 - y).toBeLessThanOrEqual(522);
  });

  it("preserves four explicit title lines and long unbroken text above their rules", async () => {
    const manuscriptTitle = [
      "Digital Research Services and Academic Collaboration",
      "Institutional Readiness and Accessible Graduate Education",
      "Implementation and Evaluation in Public Higher Education",
      "A".repeat(55),
    ].join("\n");
    const items = await inspect(await renderAdviserCertification({ ...input, manuscriptTitle }));
    for (const [index, line] of manuscriptTitle.split("\n").entries()) {
      const item = items.find(item => item.str.includes(line))!;
      expect(item).toBeDefined();
      // PDF.js may combine the printed opening/closing quote with a title item.
      expect(item.transform[4]).toBeGreaterThanOrEqual(index === 0 ? 76 : 84);
      expect(item.transform[4] + item.width).toBeLessThanOrEqual(526);
      expect(841.89 - item.transform[5]).toBeGreaterThan(252 + index * 15);
      expect(841.89 - item.transform[5]).toBeLessThan(265 + index * 15 - 2);
    }
  });

  it("rejects invalid signature bytes and unsupported image formats instead of silently omitting them", async () => {
    await expect(renderAdviserCertification({
      ...input, adviserSignature: { mimeType: "image/png", bytes: new Uint8Array([1, 2, 3]) },
    })).rejects.toBeDefined();
    await expect(renderAdviserCertification({
      ...input, adviserSignature: { mimeType: "image/gif" as never, bytes: new Uint8Array([1, 2, 3]) },
    })).rejects.toThrow(/PNG or JPEG/);
  });

  it("retains long titles, names, and programs within the intended field areas and keeps readable fonts", async () => {
    const long = {
      ...input,
      manuscriptTitle: "Development and Evaluation of an Accessible Digital Research Support Framework for Graduate Students: Institutional Readiness, Academic Collaboration, and Sustainable Knowledge Management in Public Higher Education Institutions",
      studentName: "Maria Alexandra Esperanza de los Santos-Villanueva",
      programName: "Doctor of Philosophy in Educational Management and Institutional Leadership",
      adviserPrintedName: "Dr. Maria Andrea Fernandez-Villanueva",
      issuedMonthYear: "September 2026",
    };
    const items = await inspect(await renderAdviserCertification(long));
    const fullText = compact(joined(items));
    for (const value of [long.manuscriptTitle, long.studentName, long.programName, long.adviserPrintedName, long.issuedMonthYear]) {
      expect(fullText).toContain(compact(value));
    }
    const fields = [
      { words: long.manuscriptTitle, x: 84, right: 518, top: 252, bottom: 310 },
      { words: long.programName, x: 179, right: 504, top: 372, bottom: 399 },
      { words: long.adviserPrintedName, x: 80, right: 238, top: 536, bottom: 563 },
    ];
    for (const item of items.filter(item => item.str.trim())) {
      expect(item.transform[4]).toBeGreaterThanOrEqual(68);
      expect(item.transform[4] + item.width).toBeLessThanOrEqual(538);
      expect(item.transform[5]).toBeGreaterThan(28);
      expect(item.height).toBeGreaterThanOrEqual(10);
      for (const field of fields) {
        if (!compact(field.words).includes(compact(item.str)) || item.str.trim().length < 3) continue;
        expect(item.transform[4]).toBeGreaterThanOrEqual(field.x - 0.01);
        expect(item.transform[4] + item.width).toBeLessThanOrEqual(field.right + 0.01);
        expect(841.89 - item.transform[5]).toBeGreaterThan(field.top);
        expect(841.89 - item.transform[5]).toBeLessThan(field.bottom);
      }
    }
  });

  it.each([
    ["manuscriptTitle", "Manuscript title"], ["studentName", "Student name"], ["programName", "Program name"],
    ["issuedDay", "Issued day"], ["issuedMonthYear", "Issued month/year"], ["adviserPrintedName", "Adviser printed name"],
  ] as const)("rejects oversized %s instead of clipping or dropping text", async (field, label) => {
    await expect(renderAdviserCertification({ ...input, [field]: "Oversized supplied value ".repeat(100) })).rejects.toThrow(label + " exceeds");
  });

  it("keeps all renderer dependencies inside pdf-lib and the accepted presentation modules", async () => {
    const base = path.resolve(__dirname, "../../../../src/documents/official-defense");
    const allowed = new Set([
      "pdf-lib", "../shared/institutional-header", "../shared/pdf-layout", "../shared/pdf-text",
      "../defense-application/defense-application.renderer", "./adviser-certification.types",
      "./defense-application.types", "./pdf-layout", "./pdf-text",
    ]);
    for (const file of [
      "adviser-certification/adviser-certification.renderer.ts", "adviser-certification/adviser-certification.types.ts",
      "defense-application/defense-application.renderer.ts", "defense-application/defense-application.types.ts",
      "shared/institutional-header.ts", "shared/pdf-layout.ts", "shared/pdf-text.ts",
    ]) {
      const source = await readFile(path.join(base, file), "utf8");
      for (const match of source.matchAll(/from\s+["']([^"']+)["']/g)) expect(allowed.has(match[1]), match[1]).toBe(true);
      expect(source).not.toMatch(/\b(?:require|import)\s*\(|@prisma|node:|fetch\s*\(/);
    }
  });
});
