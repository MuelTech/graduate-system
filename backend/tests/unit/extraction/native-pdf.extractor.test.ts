import { PDFDocument, StandardFonts } from "pdf-lib";
import { mkdtemp, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  NativePdfTextExtractor,
  hasUsefulNativeText,
} from "../../../src/extraction/native-pdf.extractor";

let workDir: string;
const extractor = new NativePdfTextExtractor();

beforeAll(async () => {
  workDir = await mkdtemp(path.join(tmpdir(), "dl4-native-"));
});

afterAll(async () => {
  await rm(workDir, { recursive: true, force: true });
});

async function writePdf(name: string, bytes: Buffer): Promise<string> {
  const file = path.join(workDir, name);
  await writeFile(file, bytes);
  return file;
}

async function makeTextPdf(pages: string[][]): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (const lines of pages) {
    const page = doc.addPage([400, 400]);
    let y = 350;
    for (const line of lines) {
      page.drawText(line, { x: 40, y, size: 12, font });
      y -= 20;
    }
  }
  return Buffer.from(await doc.save());
}

async function makeBlankPdf(): Promise<Buffer> {
  const doc = await PDFDocument.create();
  doc.addPage([400, 400]);
  return Buffer.from(await doc.save());
}

describe("NativePdfTextExtractor", () => {
  it("returns normalized text, page count and positional items for a text PDF", async () => {
    const file = await writePdf(
      "text.pdf",
      await makeTextPdf([["Sample Registration Document", "Generic Text Value"]]),
    );

    const result = await extractor.extract(file);

    expect(result.pageCount).toBe(1);
    expect(result.text).toContain("Sample Registration Document");
    expect(result.text).toContain("Generic Text Value");
    expect(result.pages).toHaveLength(1);
    expect(result.pages[0].page).toBe(1);

    const item = result.pages[0].items.find(
      (i) => i.text === "Sample Registration Document",
    );
    expect(item).toBeDefined();
    expect(item?.page).toBe(1);
    expect(typeof item?.x).toBe("number");
    expect(typeof item?.y).toBe("number");
    expect(typeof item?.width).toBe("number");
    expect(typeof item?.height).toBe("number");
  });

  it("preserves per-page identity for a multi-page PDF", async () => {
    const file = await writePdf(
      "multi.pdf",
      await makeTextPdf([
        ["First Page Alpha"],
        ["Second Page Bravo"],
      ]),
    );

    const result = await extractor.extract(file);

    expect(result.pageCount).toBe(2);
    expect(result.pages).toHaveLength(2);
    expect(result.pages[0].text).toContain("First Page Alpha");
    expect(result.pages[1].text).toContain("Second Page Bravo");
    expect(result.pages[1].page).toBe(2);
    expect(result.pages[1].items.every((i) => i.page === 2)).toBe(true);
  });

  it("does not require a browser worker to run under Node", async () => {
    const file = await writePdf("worker.pdf", await makeTextPdf([["Hello Worker"]]));
    await expect(extractor.extract(file)).resolves.toBeTruthy();
  });

  it("reports a blank/image-only PDF with no useful native text", async () => {
    const file = await writePdf("blank.pdf", await makeBlankPdf());
    const result = await extractor.extract(file);
    expect(result.pageCount).toBe(1);
    expect(hasUsefulNativeText(result.text)).toBe(false);
  });

  it("fails predictably for a malformed PDF", async () => {
    const file = await writePdf("broken.pdf", Buffer.from("not a real pdf at all"));
    await expect(extractor.extract(file)).rejects.toBeTruthy();
  });

  it("exposes a version identifier for persistence", () => {
    expect(extractor.version).toMatch(/native/);
  });
});

describe("hasUsefulNativeText heuristic", () => {
  it("treats empty/whitespace as unusable", () => {
    expect(hasUsefulNativeText("")).toBe(false);
    expect(hasUsefulNativeText("   \n\t  ")).toBe(false);
  });

  it("treats meaningful non-whitespace content as useful", () => {
    expect(hasUsefulNativeText("Sample Registration Document")).toBe(true);
  });
});
