import type { StorageProvider } from "./storage.types";
import { storageProvider as defaultProvider } from "./index";

/**
 * DL-2: request-scoped upload artifact registry.
 *
 * The secure upload middleware records every object it promotes and the
 * per-request temporary directory here. Controllers/services call
 * `commitRequestUploads` once the domain operation has succeeded, or
 * `cleanupRequestUploads` on any failure, so a failed request cannot leave an
 * orphan and a successful commit is never deleted by a later cleanup.
 */

interface UploadArtifacts {
  tempDir?: string;
  promotedKeys: string[];
  committed: boolean;
}

const registry = new WeakMap<object, UploadArtifacts>();

function artifactsFor(req: object): UploadArtifacts {
  let artifacts = registry.get(req);
  if (!artifacts) {
    artifacts = { promotedKeys: [], committed: false };
    registry.set(req, artifacts);
  }
  return artifacts;
}

export function setRequestTempDir(
  req: object,
  dir: string,
  _provider?: StorageProvider,
): void {
  artifactsFor(req).tempDir = dir;
}

export function registerPromotedUpload(
  req: object,
  storageKey: string,
  _provider?: StorageProvider,
): void {
  artifactsFor(req).promotedKeys.push(storageKey);
}

/** Marks the request successful so later cleanup is a no-op. */
export function commitRequestUploads(req: object): void {
  artifactsFor(req).committed = true;
}

/**
 * Best-effort, idempotent cleanup of everything this request created.
 * Never throws; skips entirely once the request is committed.
 */
export async function cleanupRequestUploads(
  req: object,
  provider: StorageProvider = defaultProvider,
): Promise<void> {
  const artifacts = artifactsFor(req);
  if (artifacts.committed) return;

  const keys = artifacts.promotedKeys.splice(0);
  for (const key of keys) {
    try {
      await provider.delete(key);
    } catch {
      // best-effort
    }
  }

  if (artifacts.tempDir) {
    const dir = artifacts.tempDir;
    artifacts.tempDir = undefined;
    try {
      await provider.removeTemporaryDir(dir);
    } catch {
      // best-effort
    }
  }
}
