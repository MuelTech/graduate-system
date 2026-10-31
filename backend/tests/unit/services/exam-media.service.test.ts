import { mkdtemp, readFile, readdir, rm, writeFile } from "fs/promises";
import path from "path";
import { tmpdir } from "os";
import { Readable } from "stream";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EXAM_PNG, EXAM_JPEG } from "../../fixtures/exam-images";
import { LocalStorageProvider } from "../../../src/storage/local-storage.provider";
import { getUploadPolicy } from "../../../src/storage/upload-policy";
import { calculateSha256 } from "../../../src/utils/checksum";
import type { ExamMediaRepository } from "../../../src/repositories/exam-media.repository";

vi.mock("../../../src/config/database", () => ({ default: {} }));
import { ExamMediaService } from "../../../src/services/exam-media.service";

type Media = NonNullable<Awaited<ReturnType<ExamMediaRepository["findForAdmin"]>>>;
let base: string;
let provider: LocalStorageProvider;
let service: ExamMediaService;
let saved: Media | undefined;
let attached: boolean;
const repo = { create: vi.fn(), findForAdmin: vi.fn(), findForApplicant: vi.fn(), deleteUnreferenced: vi.fn() };
const access = { assertApplicantQuestionAccess: vi.fn() };
const admin = { userId: "admin1", role: "ADMIN" };
const applicant = { userId: "applicant1", role: "APPLICANT" };

beforeEach(async () => {
  vi.resetAllMocks();
  base = await mkdtemp(path.join(tmpdir(), "exam-media-"));
  provider = new LocalStorageProvider({ root: base });
  saved = undefined;
  attached = false;
  repo.create.mockImplementation(async (data: Media) => { saved = data; return { id: data.id }; });
  repo.findForAdmin.mockImplementation(async (id: string) => saved?.id === id ? saved : null);
  repo.findForApplicant.mockImplementation(async (id: string) => attached && saved?.id === id ? saved : null);
  repo.deleteUnreferenced.mockImplementation(async (id: string) => {
    if (attached || saved?.id !== id) return { count: 0 };
    saved = undefined;
    return { count: 1 };
  });
  access.assertApplicantQuestionAccess.mockResolvedValue(undefined);
  service = new ExamMediaService(repo, provider, access);
});

afterEach(async () => {
  vi.restoreAllMocks();
  if (path.dirname(path.resolve(base)) !== path.resolve(tmpdir()) || !path.basename(base).startsWith("exam-media-")) throw new Error("Unexpected test cleanup target.");
  await rm(base, { recursive: true, force: true });
});

describe("private exam image creation using the real managed pipeline", () => {
  it("rejects unvalidated/spoofed promoted metadata before registration", async () => {
    const invalid = [undefined, {
      storageKey: "exam-media/key", storageProvider: "other", verifiedMimeType: "image/png",
      sizeBytes: 12, checksum: "a".repeat(64), checksumAlgorithm: "sha256",
    }, {
      storageKey: "exam-media/key", storageProvider: "local", verifiedMimeType: "application/pdf",
      sizeBytes: 12, checksum: "a".repeat(64), checksumAlgorithm: "sha256",
    }, {
      storageKey: "exam-media/key", storageProvider: "local", verifiedMimeType: "image/png",
      sizeBytes: 12, checksum: "not-a-sha256", checksumAlgorithm: "sha256",
    }];
    for (const storageMeta of invalid) await expect(service.registerPromotedImage({ storageMeta } as never)).rejects.toMatchObject({ statusCode: 400 });
    expect(repo.create).not.toHaveBeenCalled();
  });

  it.each([["PNG", EXAM_PNG, "image/png"], ["JPEG", EXAM_JPEG, "image/jpeg"]] as const)("validates and promotes %s content with internal integrity metadata", async (_name, bytes, mime) => {
    const result = await service.createImage(bytes);
    expect(result).toEqual({ id: expect.stringMatching(/^[0-9a-f-]{36}$/) });
    expect(saved).toMatchObject({
      id: result.id, storageKey: expect.stringMatching(/^exam-media\/[0-9a-f]{48}$/),
      storageProvider: "local", verifiedMimeType: mime, sizeBytes: bytes.length,
      checksum: calculateSha256(bytes), checksumAlgorithm: "sha256",
    });
    expect(await readFile(await provider.resolveStorageKeyReadPath(saved!.storageKey))).toEqual(bytes);
    expect(await readdir(provider.temporaryRoot())).toEqual([]);
    expect(saved).not.toHaveProperty("filePath");
    expect(saved).not.toHaveProperty("originalFilename");
    expect(JSON.stringify(result)).not.toContain("storage");
  });

  it("uses an image-only bounded policy without extension fallbacks", () => {
    expect(getUploadPolicy("exam-media")).toMatchObject({ maxFiles: 1, storagePrefix: "exam-media", allowedMimeTypes: ["image/png", "image/jpeg"], fallbackExtensionsWhenUndetected: [] });
    expect(getUploadPolicy("exam-media").maxBytes).toBeLessThanOrEqual(5 * 1024 * 1024);
  });

  it.each([
    ["spoofed image", Buffer.from("fake png bytes that are plain text")],
    ["PDF", Buffer.from("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF\n")],
    ["SVG", Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')],
    ["GIF", Buffer.from("GIF89a0000000000000000000000000000")],
  ])("rejects %s and removes temporary input", async (_name, bytes) => {
    await expect(service.createImage(bytes as Buffer)).rejects.toThrow();
    expect(repo.create).not.toHaveBeenCalled();
    expect(await readdir(provider.temporaryRoot())).toEqual([]);
  });

  it("rejects empty and oversized input before writing", async () => {
    const ensure = vi.spyOn(provider, "ensureTemporaryDirectory");
    await expect(service.createImage(Buffer.alloc(0))).rejects.toMatchObject({ statusCode: 400 });
    await expect(service.createImage(Buffer.alloc(getUploadPolicy("exam-media").maxBytes + 1))).rejects.toMatchObject({ statusCode: 413 });
    expect(ensure).not.toHaveBeenCalled();
    expect(repo.create).not.toHaveBeenCalled();
  });

  it("removes promoted bytes on a DB failure", async () => {
    repo.create.mockRejectedValue(new Error("DB failure"));
    await expect(service.createImage(EXAM_PNG)).rejects.toThrow("DB failure");
    expect(await readdir(path.join(base, "exam-media"))).toEqual([]);
    expect(await readdir(provider.temporaryRoot())).toEqual([]);
  });

  it("removes temporary input when promotion fails", async () => {
    vi.spyOn(provider, "promoteTemporaryFile").mockRejectedValue(new Error("Promotion failed"));
    await expect(service.createImage(EXAM_PNG)).rejects.toThrow("Promotion failed");
    expect(repo.create).not.toHaveBeenCalled();
    expect(await readdir(provider.temporaryRoot())).toEqual([]);
  });

  it("compensates promotion when temporary finalization fails before persistence", async () => {
    vi.spyOn(provider, "removeTemporaryDir").mockRejectedValueOnce(new Error("Temp cleanup failed"));
    await expect(service.createImage(EXAM_PNG)).rejects.toThrow("Temp cleanup failed");
    expect(repo.create).not.toHaveBeenCalled();
    expect(await readdir(path.join(base, "exam-media"))).toEqual([]);
    expect(await readdir(provider.temporaryRoot())).toEqual([]);
  });

  it("keeps the original failure and records a sanitized cleanup warning if compensation fails", async () => {
    repo.create.mockRejectedValue(new Error("DB failed"));
    vi.spyOn(provider, "delete").mockRejectedValue(new Error("private/key/path"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(service.createImage(EXAM_PNG)).rejects.toThrow("DB failed");
    expect(log).toHaveBeenCalledWith("Exam media promotion cleanup failed; storage integrity review required.");
    expect(JSON.stringify(log.mock.calls)).not.toContain("private/key/path");
  });
});

describe("guarded failed-import media compensation", () => {
  it("removes only an unreferenced media row and its private object", async () => {
    const { id } = await service.createImage(EXAM_PNG);
    const key = saved!.storageKey;
    expect(await service.discardUnreferencedImage(id)).toBe(true);
    expect(saved).toBeUndefined();
    expect(await provider.exists(key)).toBe(false);
    expect(repo.deleteUnreferenced).toHaveBeenCalledWith(id, key, "local");
  });

  it("retains media when a question/option became authoritative before cleanup", async () => {
    const { id } = await service.createImage(EXAM_PNG);
    const key = saved!.storageKey;
    attached = true;
    expect(await service.discardUnreferencedImage(id)).toBe(false);
    expect(saved!.id).toBe(id);
    expect(await provider.exists(key)).toBe(true);
  });

  it("does not remove bytes when guarded DB deletion fails", async () => {
    const { id } = await service.createImage(EXAM_PNG);
    const key = saved!.storageKey;
    repo.deleteUnreferenced.mockRejectedValue(new Error("Foreign-key race"));
    await expect(service.discardUnreferencedImage(id)).rejects.toThrow("Foreign-key race");
    expect(await provider.exists(key)).toBe(true);
  });

  it("reports a failed physical deletion after removing an unreferenced row", async () => {
    const { id } = await service.createImage(EXAM_PNG);
    const key = saved!.storageKey;
    vi.spyOn(provider, "delete").mockRejectedValue(new Error("File delete failed"));
    await expect(service.discardUnreferencedImage(id)).rejects.toThrow("File delete failed");
    expect(saved).toBeUndefined();
    expect(await provider.exists(key)).toBe(true);
  });

  it("rejects cleanup of a different provider or invalid namespace before DB deletion", async () => {
    const { id } = await service.createImage(EXAM_PNG);
    saved!.storageProvider = "other";
    await expect(service.discardUnreferencedImage(id)).rejects.toThrow();
    expect(repo.deleteUnreferenced).not.toHaveBeenCalled();
  });
});

describe("confidential exam media retrieval", () => {
  it("lets Admin retrieve an image even before attachment, without exposing metadata", async () => {
    const { id } = await service.createImage(EXAM_PNG);
    const result = await service.getContent(id, admin);
    expect(result).toEqual({ bytes: EXAM_PNG, mimeType: "image/png" });
    expect(Object.keys(result).sort()).toEqual(["bytes", "mimeType"]);
    expect(access.assertApplicantQuestionAccess).not.toHaveBeenCalled();
  });

  it("requires the Applicant's own eligible exam context and an attached image", async () => {
    const { id } = await service.createImage(EXAM_PNG);
    attached = true;
    expect(await service.getContent(id, applicant)).toEqual({ bytes: EXAM_PNG, mimeType: "image/png" });
    expect(access.assertApplicantQuestionAccess).toHaveBeenCalledWith("applicant1");
    expect(repo.findForApplicant).toHaveBeenCalledWith(id);
    expect(repo.findForAdmin).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated/unauthorized actors before media lookup or storage access", async () => {
    const stat = vi.spyOn(provider, "stat");
    await expect(service.getContent("irrelevant", undefined)).rejects.toMatchObject({ statusCode: 401 });
    for (const role of ["STUDENT", "PANELIST", "OTHER"]) await expect(service.getContent("irrelevant", { userId: "u", role })).rejects.toMatchObject({ statusCode: 403 });
    expect(repo.findForAdmin).not.toHaveBeenCalled();
    expect(repo.findForApplicant).not.toHaveBeenCalled();
    expect(stat).not.toHaveBeenCalled();
  });

  it.each(["No exam application", "Window not started", "Window expired"])("does not reveal existence when Applicant context fails: %s", async reason => {
    const { id } = await service.createImage(EXAM_PNG);
    attached = true;
    access.assertApplicantQuestionAccess.mockRejectedValue(new Error(reason));
    const open = vi.spyOn(provider, "openRead");
    await expect(service.getContent(id, applicant)).rejects.toMatchObject({ statusCode: 404, message: "Exam media not found." });
    expect(repo.findForApplicant).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
  });

  it("uses the same response for detached, unknown and malformed media identities", async () => {
    const { id } = await service.createImage(EXAM_PNG);
    for (const target of [id, "d9fdcc08-cdc1-44bf-9a4b-779fe1a49d0c", "../private/path", "https://example.com/image.png"]) {
      await expect(service.getContent(target, applicant)).rejects.toMatchObject({ statusCode: 404, message: "Exam media not found." });
    }
  });

  it("fails safely when the DB record or stored object is missing", async () => {
    await expect(service.getContent("d9fdcc08-cdc1-44bf-9a4b-779fe1a49d0c", admin)).rejects.toMatchObject({ statusCode: 404 });
    const { id } = await service.createImage(EXAM_PNG);
    await provider.delete(saved!.storageKey);
    await expect(service.getContent(id, admin)).rejects.toMatchObject({ statusCode: 404, message: "Exam media not found." });
  });

  it.each([
    { storageKey: "../private/path" }, { storageKey: "cor/secret" },
    { storageProvider: "other" }, { verifiedMimeType: "application/pdf" },
    { checksumAlgorithm: "md5" }, { checksum: "wrong" }, { sizeBytes: -1 },
    { sizeBytes: 999999999 }, { sizeBytes: 1 },
  ])("rejects invalid or inconsistent internal metadata %# without disclosing it", async patch => {
    const { id } = await service.createImage(EXAM_PNG);
    saved = { ...saved!, ...patch };
    await expect(service.getContent(id, admin)).rejects.toMatchObject({ statusCode: 404, message: "Exam media not found." });
  });

  it("verifies SHA-256 before returning corrupted bytes", async () => {
    const { id } = await service.createImage(EXAM_PNG);
    const corrupt = Buffer.from(EXAM_PNG);
    corrupt[corrupt.length - 1] ^= 1;
    await writeFile(await provider.resolveStorageKeyReadPath(saved!.storageKey), corrupt);
    await expect(service.getContent(id, admin)).rejects.toMatchObject({ statusCode: 404 });
  });

  it("rechecks detected content type even if stored size and checksum agree", async () => {
    const { id } = await service.createImage(EXAM_PNG);
    await writeFile(await provider.resolveStorageKeyReadPath(saved!.storageKey), EXAM_JPEG);
    saved = { ...saved!, sizeBytes: EXAM_JPEG.length, checksum: calculateSha256(EXAM_JPEG) };
    await expect(service.getContent(id, admin)).rejects.toMatchObject({ statusCode: 404 });
  });

  it("bounds bytes read and closes a stream that grows beyond recorded size", async () => {
    const { id } = await service.createImage(EXAM_PNG);
    const stream = Readable.from([Buffer.alloc(EXAM_PNG.length + 1)]);
    vi.spyOn(provider, "openRead").mockResolvedValue(stream as never);
    await expect(service.getContent(id, admin)).rejects.toMatchObject({ statusCode: 404 });
    expect(stream.destroyed).toBe(true);
  });

  it("masks provider errors containing filesystem details", async () => {
    const { id } = await service.createImage(EXAM_PNG);
    vi.spyOn(provider, "openRead").mockRejectedValue(new Error("C:/private/storage/secret"));
    await expect(service.getContent(id, admin)).rejects.toMatchObject({ statusCode: 404, message: "Exam media not found." });
  });
});
