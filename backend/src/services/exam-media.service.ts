import { randomUUID } from "crypto";
import fsp from "fs/promises";
import path from "path";
import { fileTypeFromBuffer } from "file-type";
import { ExamMediaRepository } from "../repositories/exam-media.repository";
import { storageProvider } from "../storage";
import type { StorageProvider } from "../storage/storage.types";
import { UploadPipeline } from "../storage/upload-pipeline";
import { getUploadPolicy } from "../storage/upload-policy";
import { normalizeStorageKey } from "../storage/storage-key";
import { calculateSha256, DEFAULT_CHECKSUM_ALGORITHM } from "../utils/checksum";
import { AppError } from "../utils/AppError";
import { examMediaId } from "./exam-content.rules";
import { ExamEngineService } from "./exam-engine.service";

interface MediaActor { userId: string; role: string }
export interface ExamImageContent { bytes: Buffer; mimeType: "image/png" | "image/jpeg" }

function unavailable(): AppError { return new AppError("Exam media not found.", 404); }

export class ExamMediaService {
  constructor(
    private readonly repo = new ExamMediaRepository(),
    private readonly provider: StorageProvider = storageProvider,
    private readonly examAccess: Pick<ExamEngineService, "assertApplicantQuestionAccess"> = new ExamEngineService(),
  ) {}

  /**
   * Internal creation primitive for a future authorized importer/editor.
   * Accepts bytes, never a caller-controlled path or URL. No HTTP upload API yet.
   * Images are immutable: replacing content creates a new identity.
   */
  async createImage(bytes: Buffer): Promise<{ id: string }> {
    const policy = getUploadPolicy("exam-media");
    if (!Buffer.isBuffer(bytes) || bytes.length === 0) throw new AppError("An image is required.", 400);
    if (bytes.length > policy.maxBytes) throw new AppError("Exam image exceeds the maximum allowed size.", 413);

    let tempDir: string | undefined;
    let promotedKey: string | undefined;
    let persisted = false;
    try {
      tempDir = await this.provider.ensureTemporaryDirectory(randomUUID());
      const tempPath = path.join(tempDir, randomUUID());
      await fsp.writeFile(tempPath, bytes, { flag: "wx", mode: 0o600 });
      const pipeline = new UploadPipeline(this.provider);
      const validated = await pipeline.validateAndHash(tempPath, "exam-image", policy);
      const promoted = await pipeline.promote(validated, policy);
      promotedKey = promoted.storageKey;
      // Finish temporary cleanup before creating the authoritative DB record.
      await this.provider.removeTemporaryDir(tempDir);
      tempDir = undefined;
      const result = await this.repo.create({
        id: randomUUID(),
        storageKey: promoted.storageKey,
        storageProvider: promoted.provider,
        verifiedMimeType: promoted.verifiedMimeType!,
        sizeBytes: promoted.sizeBytes,
        checksum: promoted.checksum,
        checksumAlgorithm: promoted.checksumAlgorithm,
      });
      persisted = true;
      return { id: result.id };
    } finally {
      // Storage and DB cannot share a transaction: compensate on failure.
      // Never remove an object after its media record has committed.
      if (promotedKey && !persisted) {
        await this.provider.delete(promotedKey).catch(() => {
          console.error("Exam media promotion cleanup failed; storage integrity review required.");
        });
      }
      if (tempDir) {
        await this.provider.removeTemporaryDir(tempDir).catch(() => {
          console.error("Exam media temporary cleanup failed; storage integrity review required.");
        });
      }
    }
  }

  async getContent(id: string, actor: MediaActor | undefined): Promise<ExamImageContent> {
    if (!actor?.userId) throw new AppError("Unauthorized.", 401);
    if (actor.role !== "ADMIN" && actor.role !== "APPLICANT") throw new AppError("Forbidden.", 403);
    if (actor.role === "APPLICANT") {
      try { await this.examAccess.assertApplicantQuestionAccess(actor.userId); }
      catch { throw unavailable(); }
    }
    try { if (!examMediaId(id)) throw unavailable(); }
    catch { throw unavailable(); }

    const media = actor.role === "ADMIN"
      ? await this.repo.findForAdmin(id)
      : await this.repo.findForApplicant(id);
    if (!media) throw unavailable();

    const policy = getUploadPolicy("exam-media");
    if (media.storageProvider !== this.provider.name ||
        !policy.allowedMimeTypes?.includes(media.verifiedMimeType) ||
        media.checksumAlgorithm !== DEFAULT_CHECKSUM_ALGORITHM ||
        media.sizeBytes <= 0 || media.sizeBytes > policy.maxBytes) throw unavailable();

    try {
      const key = normalizeStorageKey(media.storageKey);
      if (!key.startsWith(`${policy.storagePrefix}/`)) throw unavailable();
      const stat = await this.provider.stat(key);
      if (!stat || stat.sizeBytes !== media.sizeBytes) throw unavailable();
      const stream = await this.provider.openRead(key);
      const chunks: Buffer[] = [];
      let size = 0;
      // Bound memory and validate the complete object before sending any bytes.
      for await (const chunk of stream) {
        const part = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        size += part.length;
        if (size > policy.maxBytes || size > media.sizeBytes) throw unavailable();
        chunks.push(part);
      }
      const bytes = Buffer.concat(chunks);
      if (size !== media.sizeBytes || calculateSha256(bytes) !== media.checksum) throw unavailable();
      const detected = await fileTypeFromBuffer(bytes);
      if (detected?.mime !== media.verifiedMimeType) throw unavailable();
      return { bytes, mimeType: media.verifiedMimeType as ExamImageContent["mimeType"] };
    } catch {
      // Missing files, containment failures and corrupt content reveal no storage details.
      throw unavailable();
    }
  }

  /** Internal compensation for IDs created by a failed import, never an HTTP API. */
  async discardUnreferencedImage(id: string): Promise<boolean> {
    if (!examMediaId(id)) throw new AppError("Invalid media cleanup identity.", 400);
    const media = await this.repo.findForAdmin(id);
    if (!media) return true;
    const key = normalizeStorageKey(media.storageKey);
    if (media.storageProvider !== this.provider.name || !key.startsWith("exam-media/")) {
      throw new AppError("Media cleanup requires storage integrity review.", 500);
    }
    const deleted = await this.repo.deleteUnreferenced(id, key, media.storageProvider);
    if (deleted.count !== 1) return false;
    // Delete the row first: restrictive FKs and the guarded delete prevent an
    // authoritative question losing its bytes. A failed file delete is an orphan
    // reported by the existing integrity scanner, never a dangling live question.
    await this.provider.delete(key);
    return true;
  }
}
