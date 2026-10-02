import type { SecureMulterFile } from "./secure-upload";

/**
 * DL-6: typed managed-upload information passed from controllers to domain
 * services. Controllers must not construct persistence rows themselves; the
 * domain service owns stage/slot/currentness decisions.
 */
export interface ManagedUploadInput {
  filePath: string;
  storageKey: string | null;
  storageProvider: string | null;
  originalFilename: string | null;
  verifiedMimeType: string | null;
  sizeBytes: number | null;
  checksum: string | null;
  checksumAlgorithm: string | null;
  uploadedById: string | null;
}

/** Maps a DL-2-promoted multer file (already validated/promoted) to input. */
export function managedUploadFromMulter(
  file: Express.Multer.File,
  uploadedById: string | null,
): ManagedUploadInput {
  const meta = (file as SecureMulterFile).storageMeta;
  return {
    filePath: file.path,
    storageKey: meta?.storageKey ?? null,
    storageProvider: meta?.storageProvider ?? null,
    originalFilename: meta?.originalFilename ?? file.originalname ?? null,
    verifiedMimeType: meta?.verifiedMimeType ?? null,
    sizeBytes: meta?.sizeBytes ?? null,
    checksum: meta?.checksum ?? null,
    checksumAlgorithm: meta?.checksumAlgorithm ?? null,
    uploadedById,
  };
}
