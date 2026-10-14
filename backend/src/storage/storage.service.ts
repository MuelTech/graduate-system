import path from "path";
import { AppError } from "../utils/AppError";
import type { StorageProvider } from "./storage.types";

/**
 * DL-1: storage service coordinating managed-document resolution.
 *
 * Retrieval compatibility: modern records resolve through a stable storage
 * key; legacy records fall back to the historical `filePath` behavior. When
 * stored metadata exists, retrieval prefers the verified MIME and original
 * filename instead of deriving them from an extensionless random filename.
 */

const MIME_MAP: Record<string, string> = {
  ".pdf": "application/pdf",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
};

const DEFAULT_MIME = "application/octet-stream";

export interface DocumentStorageFields {
  storageKey?: string | null;
  filePath?: string | null;
  verifiedMimeType?: string | null;
  detectedMimeType?: string | null;
  originalFilename?: string | null;
  filename?: string | null;
}

export class StorageService {
  constructor(private readonly provider: StorageProvider) {}

  get providerName(): string {
    return this.provider.name;
  }

  getProvider(): StorageProvider {
    return this.provider;
  }

  /**
   * Resolves the local read path for a document record. A modern storage key
   * always wins; legacy `filePath` remains supported until backfill.
   */
  async resolveReadPath(record: DocumentStorageFields): Promise<string> {
    if (record.storageKey) {
      return this.provider.resolveStorageKeyReadPath(record.storageKey);
    }
    if (record.filePath) {
      return this.provider.resolveLegacyFilePathReadPath(record.filePath);
    }
    throw new AppError("No file attached to this document", 404);
  }

  /**
   * Prefers stored verified/detected MIME, then falls back to the resolved
   * path's extension for legacy compatibility.
   */
  pickMimeType(
    record: DocumentStorageFields,
    resolvedPath: string,
  ): string {
    const stored = record.verifiedMimeType || record.detectedMimeType;
    if (stored) return stored;
    const ext = path.extname(resolvedPath).toLowerCase();
    return MIME_MAP[ext] || DEFAULT_MIME;
  }

  pickOriginalFilename(
    record: DocumentStorageFields,
    resolvedPath: string,
  ): string {
    return (
      record.originalFilename ||
      record.filename ||
      path.basename(resolvedPath)
    );
  }
}
