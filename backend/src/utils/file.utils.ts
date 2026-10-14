import {
  resolveStorageConfig,
  resolveStorageOperationsConfig,
} from "../config/storage.config";

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

/**
 * DL-11: resolved operational diagnostics configuration. Classification-only —
 * never deletion/retention policy.
 */
export const STORAGE_OPERATIONS_CONFIG = resolveStorageOperationsConfig({
  staleTempHours: process.env.STORAGE_STALE_TEMP_HOURS,
  minFreePercent: process.env.STORAGE_MIN_FREE_PERCENT,
});
