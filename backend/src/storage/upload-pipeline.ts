import fsp from "fs/promises";
import { fileTypeFromFile } from "file-type";
import { AppError } from "../utils/AppError";
import {
  DEFAULT_CHECKSUM_ALGORITHM,
  calculateFileSha256,
} from "../utils/checksum";
import { generateStorageKey } from "./storage-key";
import type { StorageProvider } from "./storage.types";
import type { UploadPolicy } from "./upload-policy";

/**
 * DL-2: reusable secure-upload pipeline primitives.
 *
 * Responsibilities are deliberately storage/security only:
 * - verify actual byte content (never trust client MIME/extension);
 * - enforce the applicable policy's allowlist;
 * - compute byte size + SHA-256;
 * - promote validated temporary objects into managed permanent storage.
 * Business/workflow authority stays in domain services.
 */

export const CHECKSUM_ALGORITHM = DEFAULT_CHECKSUM_ALGORITHM;

export interface ValidatedUpload {
  tempPath: string;
  originalFilename: string;
  verifiedMimeType: string | null;
  sizeBytes: number;
  checksum: string;
  checksumAlgorithm: string;
  provider: string;
}

export interface PromotedUpload extends ValidatedUpload {
  storageKey: string;
  absolutePath: string;
}

function extensionOf(filename: string): string {
  const lowered = String(filename ?? "").toLowerCase();
  const idx = lowered.lastIndexOf(".");
  return idx >= 0 ? lowered.slice(idx + 1) : "";
}

export class UploadPipeline {
  constructor(private readonly provider: StorageProvider) {}

  /**
   * Byte-validates a temporary upload against its policy and returns verified
   * metadata. Throws AppError on empty/oversized/disallowed content.
   */
  async validateAndHash(
    tempPath: string,
    originalFilename: string,
    policy: UploadPolicy,
  ): Promise<ValidatedUpload> {
    const stat = await fsp.stat(tempPath);
    const sizeBytes = stat.size;

    if (sizeBytes <= 0) {
      throw new AppError("Empty uploads are not allowed.", 400);
    }
    if (sizeBytes > policy.maxBytes) {
      throw new AppError("Uploaded file exceeds the maximum allowed size.", 413);
    }

    const detected = await fileTypeFromFile(tempPath);
    const verifiedMimeType = detected?.mime ?? null;

    if (policy.allowedMimeTypes !== null) {
      const allowed = policy.allowedMimeTypes.includes(
        verifiedMimeType as string,
      );
      const fallbackAllowed =
        !verifiedMimeType &&
        policy.fallbackExtensionsWhenUndetected.includes(
          extensionOf(originalFilename),
        );
      if (!allowed && !fallbackAllowed) {
        throw new AppError(
          "Invalid file content. The uploaded file type is not allowed.",
          400,
        );
      }
    }

    const checksum = await calculateFileSha256(tempPath);

    return {
      tempPath,
      originalFilename,
      verifiedMimeType,
      sizeBytes,
      checksum,
      checksumAlgorithm: CHECKSUM_ALGORITHM,
      provider: this.provider.name,
    };
  }

  /** Promotes a validated temporary object into managed permanent storage. */
  async promote(
    upload: ValidatedUpload,
    policy: UploadPolicy,
  ): Promise<PromotedUpload> {
    const storageKey = generateStorageKey(policy.storagePrefix);
    const absolutePath = await this.provider.promoteTemporaryFile(
      upload.tempPath,
      storageKey,
    );
    return { ...upload, storageKey, absolutePath };
  }

  /** Discards a temporary object (best-effort, idempotent). */
  async discard(tempPath: string): Promise<void> {
    await this.provider.discardTemporaryFile(tempPath);
  }
}
