import { PRIVATE_UPLOAD_ROOT, STORAGE_CONFIG } from "../utils/file.utils";
import { LocalStorageProvider } from "./local-storage.provider";
import { StorageService } from "./storage.service";

/**
 * DL-1: application-wide default storage singletons.
 * Domain services should resolve managed documents through this service rather
 * than constructing absolute paths themselves.
 */
export const storageProvider = new LocalStorageProvider({
  root: PRIVATE_UPLOAD_ROOT,
  provider: STORAGE_CONFIG.provider,
});

export const storageService = new StorageService(storageProvider);

export * from "./storage.types";
export { LocalStorageProvider } from "./local-storage.provider";
export { StorageService } from "./storage.service";
export {
  generateStorageKey,
  isValidStorageKey,
  normalizeStorageKey,
} from "./storage-key";
export {
  DEFAULT_MAX_UPLOAD_BYTES,
  UPLOAD_POLICIES,
  getUploadPolicy,
} from "./upload-policy";
export type { UploadPolicy, UploadPolicyName } from "./upload-policy";
export { CHECKSUM_ALGORITHM, UploadPipeline } from "./upload-pipeline";
export type { PromotedUpload, ValidatedUpload } from "./upload-pipeline";
