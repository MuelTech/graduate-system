import { PDFDocument, StandardFonts } from "pdf-lib";
import { mkdtemp, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { CorExtractionService } from "../../../src/extraction/cor-extraction.service";
import { NativePdfTextExtractor } from "../../../src/extraction/native-pdf.extractor";
import { UnavailableOcrExtractor } from "../../../src/extraction/ocr.extractor";
import { EARIST_COR_PARSER_VERSION } from "../../../src/extraction/earist-cor.parser";

let workDir: string;

beforeAll(async () => {
  workDir = await mkdtemp(path.join(tmpdir(), "dl4-orch-"));
});

afterAll(async () => {
  await rm(workDir, { recursive: true, force: true });
});

async function writeTextPdf(name: string): Promise<string> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([400, 400]);
  page.drawText("Sample Registration Document", { x: 40, y: 350, size: 12, font });
  const file = path.join(workDir, name);
  await writeFile(file, await doc.save());
  return file;
}

async function writeBlankPdf(name: string): Promise<string> {
  const doc = await PDFDocument.create();
  doc.addPage([400, 400]);
  const file = path.join(workDir, name);
  await writeFile(file, await doc.save());
  return file;
}

async function writeBytes(name: string, bytes: Buffer): Promise<string> {
  const file = path.join(workDir, name);
  await writeFile(file, bytes);
  return file;
}

/**
 * COR-2: draws a synthetic EARIST COR layout so the service's real native PDF
 * path produces normalized text for the parser. All values are fictitious.
 */
async function writeCorPdf(name: string, lines: string[]): Promise<string> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([612, 792]);
  let y = 740;
  for (const line of lines) {
    page.drawText(line, { x: 40, y, size: 11, font });
    y -= 20;
  }
  const file = path.join(workDir, name);
  await writeFile(file, await doc.save());
  return file;
}

const COR_FULL_LINES = [
  "Registration No : 1234567890",
  "Student No : 123-45678A",
  "Name : DELA CRUZ, JUAN SANTOS",
  "Program : Master in Information Technology",
  "College : Graduate School",
  "Email Address : juan.delacruz@example.com",
];

const EMPTY_SUGGESTIONS = {
  studentNumber: null,
  registrationNumber: null,
  studentName: null,
  program: null,
  college: null,
  emailAddress: null,
};

function makeHarness(source: Record<string, unknown> | null, resolvePath?: (p: string) => string) {
  const corRepository = {
    getExtractionSource: vi.fn().mockResolvedValue(source),
    // Authority methods that must never be called by extraction.
    verifyAndPromote: vi.fn(),
    createUploadWithAudit: vi.fn(),
    rejectUpload: vi.fn(),
  };
  const extractionRepository = {
    upsertResult: vi.fn(async (_id: string, result: unknown) => result),
  };
  const storage = {
    resolveReadPath: vi.fn(async (record: { filePath?: string | null }) =>
      resolvePath ? resolvePath(String(record.filePath)) : String(record.filePath),
    ),
  };
  const service = new CorExtractionService(
    new NativePdfTextExtractor(),
    new UnavailableOcrExtractor(),
    corRepository as never,
    extractionRepository as never,
    storage as never,
  );
  return { service, corRepository, extractionRepository, storage };
}

function persistedByStatus(
  extractionRepository: { upsertResult: { mock: { calls: unknown[][] } } },
  status: string,
): Record<string, unknown> | undefined {
  const calls = extractionRepository.upsertResult.mock.calls as [
    string,
    { status: string },
  ][];
  const match = calls.find(([, result]) => result.status === status);
  return match?.[1] as Record<string, unknown> | undefined;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("CorExtractionService native PDF path", () => {
  it("persists PROCESSING then COMPLETED for a text PDF", async () => {
    const file = await writeTextPdf("text.pdf");
    const { service, extractionRepository } = makeHarness({
      id: "cor-1",
      storageKey: null,
      storageProvider: null,
      filePath: file,
      detectedMimeType: "application/pdf",
      originalFilename: "cor.pdf",
    });

    const result = await service.processUpload("cor-1");

    expect(result.status).toBe("COMPLETED");
    expect(result.method).toBe("NATIVE_PDF");
    expect(result.extractorVersion).toMatch(/native/);
    expect(result.parserVersion).toBe(EARIST_COR_PARSER_VERSION);
    expect(result.pageCount).toBe(1);
    expect(result.text).toContain("Sample Registration Document");
    expect(result.pages?.length).toBe(1);
    // COR-2: the parser runs on useful text; generic text yields partial (all
    // null) suggestions rather than a null parser boundary.
    expect(result.suggestions).toEqual(EMPTY_SUGGESTIONS);
    expect(result.processedAt).toBeInstanceOf(Date);

    const statuses = extractionRepository.upsertResult.mock.calls.map(
      ([, r]: [string, { status: string }]) => r.status,
    );
    expect(statuses).toEqual(["PROCESSING", "COMPLETED"]);
    expect(extractionRepository.upsertResult).toHaveBeenLastCalledWith("cor-1", expect.anything());
  });

  it("persists MANUAL_REQUIRED for a blank/image-only PDF", async () => {
    const file = await writeBlankPdf("blank.pdf");
    const { service } = makeHarness({
      id: "cor-2",
      storageKey: null,
      storageProvider: null,
      filePath: file,
      detectedMimeType: "application/pdf",
      originalFilename: "blank.pdf",
    });

    const result = await service.processUpload("cor-2");

    expect(result.status).toBe("MANUAL_REQUIRED");
    expect(result.method).toBe("NATIVE_PDF");
    expect(result.text).toBeNull();
    expect(result.suggestions).toBeNull();
    expect(result.parserVersion).toBeNull();
    expect(result.diagnostic).toMatch(/no useful native text/i);
  });

  it("persists FAILED for a malformed PDF without rejecting the upload", async () => {
    const file = await writeBytes("broken.pdf", Buffer.from("not a real pdf"));
    const { service } = makeHarness({
      id: "cor-3",
      storageKey: null,
      storageProvider: null,
      filePath: file,
      detectedMimeType: "application/pdf",
      originalFilename: "broken.pdf",
    });

    const result = await service.processUpload("cor-3");

    expect(result.status).toBe("FAILED");
    expect(result.method).toBe("NATIVE_PDF");
    expect(result.suggestions).toBeNull();
    expect(result.parserVersion).toBeNull();
    expect(result.diagnostic).toBe("Native PDF parsing failed.");
  });

  it("persists FAILED when the storage path cannot be resolved", async () => {
    const { service, storage } = makeHarness(
      {
        id: "cor-4",
        storageKey: "cor/missing",
        storageProvider: "local",
        filePath: null,
        detectedMimeType: "application/pdf",
        originalFilename: "cor.pdf",
      },
      () => {
        throw new Error("File not found on disk");
      },
    );

    const result = await service.processUpload("cor-4");

    expect(result.status).toBe("FAILED");
    expect(result.suggestions).toBeNull();
    expect(result.parserVersion).toBeNull();
    expect(result.diagnostic).toBe("Unable to read stored COR document.");
    expect(storage.resolveReadPath).toHaveBeenCalled();
  });

  it("never persists a private filesystem path from a read error", async () => {
    const privatePath =
      "/var/lib/graduate-system/private/cor/secret-file.pdf";
    const { service, extractionRepository } = makeHarness({
      id: "cor-path",
      storageKey: null,
      storageProvider: null,
      // Resolves, but the file does not exist: fs.readFile throws ENOENT whose
      // message embeds this absolute path.
      filePath: privatePath,
      detectedMimeType: "application/pdf",
      originalFilename: "cor.pdf",
    });

    const result = await service.processUpload("cor-path");

    expect(result.status).toBe("FAILED");
    expect(result.diagnostic).toBe("Unable to read stored COR document.");
    expect(result.diagnostic).not.toContain(privatePath);
    expect(result.diagnostic).not.toContain("graduate-system");
    expect(result.diagnostic).not.toContain("/var/lib");

    const calls = extractionRepository.upsertResult.mock.calls;
    const persisted = calls[calls.length - 1]?.[1] as {
      diagnostic: string | null;
    };
    expect(persisted.diagnostic).toBe("Unable to read stored COR document.");
    expect(JSON.stringify(persisted)).not.toContain(privatePath);
  });
});

describe("CorExtractionService COR-2 parser suggestion persistence", () => {
  it("runs the EARIST parser and persists typed v1 suggestions for a native-text COR", async () => {
    const file = await writeCorPdf("cor-full.pdf", COR_FULL_LINES);
    const { service, extractionRepository } = makeHarness({
      id: "cor-full",
      storageKey: null,
      storageProvider: null,
      filePath: file,
      detectedMimeType: "application/pdf",
      originalFilename: "cor-full.pdf",
    });

    const result = await service.processUpload("cor-full");

    expect(result.status).toBe("COMPLETED");
    expect(result.method).toBe("NATIVE_PDF");
    expect(result.suggestions).toEqual({
      studentNumber: "123-45678A",
      registrationNumber: "1234567890",
      studentName: {
        raw: "DELA CRUZ, JUAN SANTOS",
        surname: "DELA CRUZ",
        firstName: "JUAN",
        middleNameOrInitial: "SANTOS",
      },
      program: "Master in Information Technology",
      college: "Graduate School",
      emailAddress: "juan.delacruz@example.com",
    });

    const completed = persistedByStatus(extractionRepository, "COMPLETED");
    expect(completed?.suggestions).toEqual(result.suggestions);
  });

  it("persists native extractor version and EARIST parser version distinctly", async () => {
    const file = await writeCorPdf("cor-versions.pdf", COR_FULL_LINES);
    const { service } = makeHarness({
      id: "cor-versions",
      storageKey: null,
      storageProvider: null,
      filePath: file,
      detectedMimeType: "application/pdf",
      originalFilename: "cor-versions.pdf",
    });

    const result = await service.processUpload("cor-versions");

    expect(result.extractorVersion).toMatch(/native/);
    expect(result.parserVersion).toBe(EARIST_COR_PARSER_VERSION);
    expect(result.parserVersion).not.toBe(result.extractorVersion);
  });

  it("starts PROCESSING without suggestions/parserVersion and completes with suggestions", async () => {
    const file = await writeCorPdf("cor-lifecycle.pdf", COR_FULL_LINES);
    const { service, extractionRepository } = makeHarness({
      id: "cor-lifecycle",
      storageKey: null,
      storageProvider: null,
      filePath: file,
      detectedMimeType: "application/pdf",
      originalFilename: "cor-lifecycle.pdf",
    });

    await service.processUpload("cor-lifecycle");

    const processing = persistedByStatus(extractionRepository, "PROCESSING");
    expect(processing?.suggestions).toBeNull();
    expect(processing?.parserVersion).toBeNull();

    const completed = persistedByStatus(extractionRepository, "COMPLETED");
    expect(completed?.suggestions).toMatchObject({ studentNumber: "123-45678A" });
    expect(completed?.parserVersion).toBe(EARIST_COR_PARSER_VERSION);
  });

  it("keeps COMPLETED with partial suggestions when supported fields are missing", async () => {
    const file = await writeCorPdf("cor-partial.pdf", [
      "Student No : 123-45678A",
      "Name : DELA CRUZ, JUAN SANTOS",
    ]);
    const { service } = makeHarness({
      id: "cor-partial",
      storageKey: null,
      storageProvider: null,
      filePath: file,
      detectedMimeType: "application/pdf",
      originalFilename: "cor-partial.pdf",
    });

    const result = await service.processUpload("cor-partial");

    expect(result.status).toBe("COMPLETED");
    expect(result.suggestions).toMatchObject({
      studentNumber: "123-45678A",
      registrationNumber: null,
      studentName: {
        raw: "DELA CRUZ, JUAN SANTOS",
        surname: "DELA CRUZ",
        firstName: "JUAN",
        middleNameOrInitial: "SANTOS",
      },
      program: null,
      college: null,
      emailAddress: null,
    });
    expect(result.parserVersion).toBe(EARIST_COR_PARSER_VERSION);
  });

  it("does not invent parser suggestions for a blank/image-only PDF", async () => {
    const file = await writeBlankPdf("cor-blank.pdf");
    const { service, extractionRepository } = makeHarness({
      id: "cor-blank",
      storageKey: null,
      storageProvider: null,
      filePath: file,
      detectedMimeType: "application/pdf",
      originalFilename: "cor-blank.pdf",
    });

    const result = await service.processUpload("cor-blank");

    expect(result.status).toBe("MANUAL_REQUIRED");
    expect(result.suggestions).toBeNull();
    expect(result.parserVersion).toBeNull();
    const persisted = extractionRepository.upsertResult.mock.calls.map(
      ([, r]: [string, { suggestions: unknown }]) => r.suggestions,
    );
    expect(persisted.length).toBeGreaterThan(0);
    expect(persisted.every((s) => s === null)).toBe(true);
  });
});

describe("CorExtractionService non-PDF fallback", () => {
  it("does not run native PDF extraction for JPEG and records MANUAL_REQUIRED", async () => {
    const { service, extractionRepository, storage } = makeHarness({
      id: "cor-jpg",
      storageKey: null,
      storageProvider: null,
      filePath: "/does/not/matter.jpg",
      detectedMimeType: "image/jpeg",
      originalFilename: "cor.jpg",
    });

    const result = await service.processUpload("cor-jpg");

    expect(result.status).toBe("MANUAL_REQUIRED");
    expect(result.method).toBe("MANUAL");
    expect(result.suggestions).toBeNull();
    expect(result.parserVersion).toBeNull();
    expect(storage.resolveReadPath).not.toHaveBeenCalled();
    expect(extractionRepository.upsertResult).toHaveBeenCalledTimes(1);
    expect(extractionRepository.upsertResult).toHaveBeenCalledWith(
      "cor-jpg",
      expect.objectContaining({ status: "MANUAL_REQUIRED", method: "MANUAL" }),
    );
  });

  it("does not run native PDF extraction for PNG", async () => {
    const { service, storage } = makeHarness({
      id: "cor-png",
      storageKey: null,
      storageProvider: null,
      filePath: "/does/not/matter.png",
      detectedMimeType: "image/png",
      originalFilename: "cor.png",
    });

    const result = await service.processUpload("cor-png");
    expect(result.status).toBe("MANUAL_REQUIRED");
    expect(result.method).toBe("MANUAL");
    expect(result.suggestions).toBeNull();
    expect(result.parserVersion).toBeNull();
    expect(storage.resolveReadPath).not.toHaveBeenCalled();
  });
});

describe("CorExtractionService authority + historical isolation", () => {
  it("never invokes COR verification/promotion authority", async () => {
    const file = await writeTextPdf("authority.pdf");
    const { service, corRepository } = makeHarness({
      id: "cor-auth",
      storageKey: null,
      storageProvider: null,
      filePath: file,
      detectedMimeType: "application/pdf",
      originalFilename: "cor.pdf",
    });

    await service.processUpload("cor-auth");

    expect(corRepository.verifyAndPromote).not.toHaveBeenCalled();
    expect(corRepository.createUploadWithAudit).not.toHaveBeenCalled();
    expect(corRepository.rejectUpload).not.toHaveBeenCalled();
  });

  it("addresses each exact CorUpload id and does not mutate a historical submission", async () => {
    const fileA = await writeCorPdf("a.pdf", [
      "Student No : 111-11111A",
      "Name : ALPHA, BETA GAMMA",
    ]);
    const fileB = await writeCorPdf("b.pdf", [
      "Student No : 222-22222B",
      "Name : DELTA, EPSILON ZETA",
    ]);

    const sourceById: Record<string, Record<string, unknown>> = {
      A: {
        id: "A",
        storageKey: null,
        storageProvider: null,
        filePath: fileA,
        detectedMimeType: "application/pdf",
        originalFilename: "a.pdf",
      },
      B: {
        id: "B",
        storageKey: null,
        storageProvider: null,
        filePath: fileB,
        detectedMimeType: "application/pdf",
        originalFilename: "b.pdf",
      },
    };
    const corRepository = {
      getExtractionSource: vi.fn(async (id: string) => sourceById[id] ?? null),
      verifyAndPromote: vi.fn(),
    };
    const extractionRepository = {
      upsertResult: vi.fn(async (_id: string, result: unknown) => result),
    };
    const service = new CorExtractionService(
      new NativePdfTextExtractor(),
      new UnavailableOcrExtractor(),
      corRepository as never,
      extractionRepository as never,
      { resolveReadPath: vi.fn(async (r: { filePath?: string }) => String(r.filePath)) } as never,
    );

    await service.processUpload("A");
    await service.processUpload("B");

    const ids = extractionRepository.upsertResult.mock.calls.map(
      ([id]: [string]) => id,
    );
    expect(ids).toContain("A");
    expect(ids).toContain("B");
    // Processing B never re-addresses A's row.
    const afterB = extractionRepository.upsertResult.mock.calls.filter(
      ([id]: [string]) => id === "A",
    );
    expect(afterB.length).toBe(2); // PROCESSING + COMPLETED for A only

    // Suggestions are bound to the exact CorUpload processed.
    const completedA = extractionRepository.upsertResult.mock.calls.find(
      ([id, r]: [string, { status: string; suggestions?: { studentNumber?: string | null } }]) =>
        id === "A" && r.status === "COMPLETED",
    )?.[1] as { suggestions?: { studentNumber?: string | null } } | undefined;
    const completedB = extractionRepository.upsertResult.mock.calls.find(
      ([id, r]: [string, { status: string; suggestions?: { studentNumber?: string | null } }]) =>
        id === "B" && r.status === "COMPLETED",
    )?.[1] as { suggestions?: { studentNumber?: string | null } } | undefined;

    expect(completedA?.suggestions?.studentNumber).toBe("111-11111A");
    expect(completedB?.suggestions?.studentNumber).toBe("222-22222B");
  });
});
