import { resolveStorageConfig } from "../config/storage.config";

/**
 * DL-1: resolved, production-validated private storage configuration.
 * `PRIVATE_UPLOAD_ROOT` is retained for backward compatibility with existing
 * consumers (Multer destination, retrieval containment). New code should
 * prefer the storage service/provider abstraction.
 */
export const STORAGE_CONFIG = resolveStorageConfig({
  uploadDir: process.env.UPLOAD_DIR,
  nodeEnv: process.env.NODE_ENV,
  cwd: process.cwd(),
});

export const PRIVATE_UPLOAD_ROOT = STORAGE_CONFIG.root;
