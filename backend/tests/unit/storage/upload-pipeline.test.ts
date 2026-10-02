import { mkdir, mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { existsSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { LocalStorageProvider } from "../../../src/storage/local-storage.provider";
import { UploadPipeline } from "../../../src/storage/upload-pipeline";
import { getUploadPolicy } from "../../../src/storage/upload-policy";
import { calculateSha256 } from "../../../src/utils/checksum";

const PDF_BYTES = Buffer.from("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF\n");
const PNG_BYTES = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
]);
const TEXT_BYTES = Buffer.from("this is definitely not a document signature");

let base: string;
let provider: LocalStorageProvider;
let pipeline: UploadPipeline;
let seq = 0;

beforeAll(async () => {
  base = await mkdtemp(path.join(tmpdir(), "dl2-pipeline-"));
  provider = new LocalStorageProvider({ root: path.join(base, "root") });
  pipeline = new UploadPipeline(provider);
});

afterAll(async () => {
  await rm(base, { recursive: true, force: true });
});

async function tempFile(bytes: Buffer): Promise<string> {
  const dir = path.join(provider.temporaryRoot(), `req-${seq++}`);
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, "upload");
  await writeFile(file, bytes);
  return file;
}

describe("UploadPipeline.validateAndHash", () => {
  it("accepts allowed byte content and records detected MIME, size, checksum", async () => {
    const temp = await tempFile(PDF_BYTES);
    const result = await pipeline.validateAndHash(
      temp,
      "thesis.pdf",
      getUploadPolicy("applicant-cor"),
    );
    expect(result.verifiedMimeType).toBe("application/pdf");
    expect(result.sizeBytes).toBe(PDF_BYTES.length);
    expect(result.checksumAlgorithm).toBe("sha256");
    expect(result.checksum).toBe(calculateSha256(PDF_BYTES));
    expect(result.originalFilename).toBe("thesis.pdf");
    expect(result.provider).toBe("local");
  });

  it("rejects a spoofed filename/client type whose bytes are disallowed", async () => {
    const temp = await tempFile(TEXT_BYTES);
    await expect(
      pipeline.validateAndHash(temp, "fake.pdf", getUploadPolicy("applicant-cor")),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rejects unsupported actual content for a strict policy", async () => {
    const temp = await tempFile(PNG_BYTES);
    await expect(
      pipeline.validateAndHash(temp, "scan.png", getUploadPolicy("proposal-manuscript")),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rejects empty uploads", async () => {
    const temp = await tempFile(Buffer.alloc(0));
    await expect(
      pipeline.validateAndHash(temp, "empty.pdf", getUploadPolicy("defense-evidence")),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("preserves legacy Word extension fallback only when detection is empty", async () => {
    const temp = await tempFile(TEXT_BYTES);
    const result = await pipeline.validateAndHash(
      temp,
      "chapter.doc",
      getUploadPolicy("proposal-manuscript"),
    );
    expect(result.verifiedMimeType).toBeNull();
  });

  it("keeps permissive categories accepting unknown real content", async () => {
    const temp = await tempFile(TEXT_BYTES);
    const result = await pipeline.validateAndHash(
      temp,
      "instrument.bin",
      getUploadPolicy("evaluation-instrument"),
    );
    expect(result.sizeBytes).toBe(TEXT_BYTES.length);
  });
});

describe("UploadPipeline.promote", () => {
  it("moves the validated object to a permanent managed key", async () => {
    const temp = await tempFile(PDF_BYTES);
    const policy = getUploadPolicy("evaluation-instrument");
    const validated = await pipeline.validateAndHash(temp, "x.bin", policy);
    const promoted = await pipeline.promote(validated, policy);
    expect(existsSync(temp)).toBe(false);
    expect(promoted.storageKey.startsWith("instruments/")).toBe(true);
    expect(promoted.absolutePath).toBe(path.join(base, "root", ...promoted.storageKey.split("/")));
    expect(await readFile(promoted.absolutePath)).toEqual(PDF_BYTES);
  });

  it("discards a temporary object", async () => {
    const temp = await tempFile(PDF_BYTES);
    await pipeline.discard(temp);
    expect(existsSync(temp)).toBe(false);
  });
});
