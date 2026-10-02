import crypto from "crypto";
import fsp from "fs/promises";
import path from "path";
import { calculateFileSha256 } from "../utils/checksum";
import type { LocalStorageProvider } from "./local-storage.provider";
import type {
  CapacityAvailability,
  LegacyOrUnclassifiedSummary,
  LegacyProbeResult,
  ManagedObjectInfo,
  ManagedObjectListing,
  ObjectProbe,
  StorageDiagnosticsProvider,
  SymlinkFinding,
  TempSummary,
} from "./storage-diagnostics.types";

/**
 * DL-11: read-only local-filesystem diagnostics.
 *
 * Strictly non-destructive: this class only reads directories, stats objects,
 * and streams checksums. It never deletes, moves, renames, repairs, or writes.
 * All traversal is contained within the configured real private root; symbolic
 * links are detected with `lstat` and never followed.
 */

const ZERO_TEMP: TempSummary = {
  requestDirectories: 0,
  fileCount: 0,
  totalBytes: 0,
  oldestModifiedAt: null,
  staleRequestDirectories: 0,
  staleFiles: 0,
  unsafeRootDetected: false,
};

function toPosix(relative: string): string {
  return relative.split(path.sep).join("/");
}

/** True when `child` resolves strictly inside `parent` (both real paths). */
function isRealInside(parent: string, child: string): boolean {
  const relative = path.relative(parent, child);
  return (
    relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative)
  );
}

export class LocalStorageDiagnostics implements StorageDiagnosticsProvider {
  readonly providerName: string;

  constructor(private readonly provider: LocalStorageProvider) {
    this.providerName = provider.name;
  }

  /** Non-reversible diagnostic identifier for a physical object. */
  fingerprint(storageKey: string): string {
    return crypto
      .createHash("sha256")
      .update(storageKey)
      .digest("hex")
      .slice(0, 16);
  }

  async listManagedObjects(
    prefixes: readonly string[],
  ): Promise<ManagedObjectListing> {
    const realRoot = await this.provider.realRoot();
    const objects: ManagedObjectInfo[] = [];
    const symlinks: SymlinkFinding[] = [];

    const walk = async (dir: string, namespace: string): Promise<void> => {
      let entries;
      try {
        entries = await fsp.readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        const storageKey = toPosix(path.relative(realRoot, full));
        if (entry.isSymbolicLink()) {
          symlinks.push({ storageKey, namespace });
          continue;
        }
        if (entry.isDirectory()) {
          await walk(full, namespace);
          continue;
        }
        if (!entry.isFile()) continue;
        let info;
        try {
          info = await fsp.lstat(full);
        } catch {
          continue;
        }
        if (!info.isFile()) continue;
        objects.push({
          storageKey,
          namespace,
          sizeBytes: info.size,
          modifiedAt: info.mtime.toISOString(),
        });
      }
    };

    for (const prefix of prefixes) {
      const candidate = path.join(realRoot, prefix);
      let rootInfo;
      try {
        rootInfo = await fsp.lstat(candidate);
      } catch {
        // Namespace not created yet.
        continue;
      }
      if (rootInfo.isSymbolicLink()) {
        // Never follow a namespace-root symlink; report using the safe
        // namespace identity only (never the external target).
        symlinks.push({ storageKey: prefix, namespace: prefix });
        continue;
      }
      if (!rootInfo.isDirectory()) continue;

      let realDir: string;
      try {
        realDir = await fsp.realpath(candidate);
      } catch {
        continue;
      }
      // Prove the resolved namespace root is still inside the real private
      // root before traversing it.
      if (!isRealInside(realRoot, realDir)) continue;

      await walk(realDir, prefix);
    }

    return { objects, symlinks };
  }

  /**
   * Root-level and non-managed files. Never called an orphan: they are neither
   * proven managed nor proven orphan. `.tmp` and managed namespaces are skipped.
   */
  async legacyOrUnclassifiedSummary(
    prefixes: readonly string[],
  ): Promise<LegacyOrUnclassifiedSummary> {
    const realRoot = await this.provider.realRoot();
    const managed = new Set(prefixes);
    let count = 0;
    let totalBytes = 0;

    const walk = async (dir: string, isRoot: boolean): Promise<void> => {
      let entries;
      try {
        entries = await fsp.readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        if (isRoot && entry.name === ".tmp") continue;
        if (isRoot && entry.isDirectory() && managed.has(entry.name)) continue;
        const full = path.join(dir, entry.name);
        if (entry.isSymbolicLink()) continue;
        if (entry.isDirectory()) {
          await walk(full, false);
          continue;
        }
        if (!entry.isFile()) continue;
        let info;
        try {
          info = await fsp.lstat(full);
        } catch {
          continue;
        }
        if (!info.isFile()) continue;
        count += 1;
        totalBytes += info.size;
      }
    };

    await walk(realRoot, true);
    return { count, totalBytes };
  }

  async tempSummary(staleTempHours: number): Promise<TempSummary> {
    const realRoot = await this.provider.realRoot();
    const lexicalTempRoot = this.provider.temporaryRoot();

    // Validate the `.tmp` root itself (lstat) before any traversal. A symlinked
    // or non-contained temp root must never be followed.
    let tempRootInfo;
    try {
      tempRootInfo = await fsp.lstat(lexicalTempRoot);
    } catch {
      return { ...ZERO_TEMP };
    }
    if (tempRootInfo.isSymbolicLink()) {
      return { ...ZERO_TEMP, unsafeRootDetected: true };
    }
    if (!tempRootInfo.isDirectory()) {
      // A regular file / FIFO / socket / device at the `.tmp` path is a broken
      // temp-storage configuration: never traverse, report the anomaly, and
      // return zero counts. The object is never deleted or repaired.
      return { ...ZERO_TEMP, unsafeRootDetected: true };
    }

    let realTempRoot: string;
    try {
      realTempRoot = await fsp.realpath(lexicalTempRoot);
    } catch {
      return { ...ZERO_TEMP, unsafeRootDetected: true };
    }
    if (!isRealInside(realRoot, realTempRoot)) {
      return { ...ZERO_TEMP, unsafeRootDetected: true };
    }

    const unsafeRootDetected = false;

    const cutoff = Date.now() - staleTempHours * 3600 * 1000;
    let requestDirectories = 0;
    let fileCount = 0;
    let totalBytes = 0;
    let staleFiles = 0;
    let staleRequestDirectories = 0;
    let oldest: number | null = null;

    const scanDirectory = async (
      dir: string,
    ): Promise<{ count: number; bytes: number; oldest: number | null; newest: number | null }> => {
      let entries;
      try {
        entries = await fsp.readdir(dir, { withFileTypes: true });
      } catch {
        return { count: 0, bytes: 0, oldest: null, newest: null };
      }
      let count = 0;
      let bytes = 0;
      let localOldest: number | null = null;
      let localNewest: number | null = null;
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isSymbolicLink()) continue;
        if (entry.isDirectory()) {
          const sub = await scanDirectory(full);
          count += sub.count;
          bytes += sub.bytes;
          if (sub.oldest !== null) {
            localOldest = localOldest === null ? sub.oldest : Math.min(localOldest, sub.oldest);
          }
          if (sub.newest !== null) {
            localNewest = localNewest === null ? sub.newest : Math.max(localNewest, sub.newest);
          }
          continue;
        }
        if (!entry.isFile()) continue;
        let info;
        try {
          info = await fsp.lstat(full);
        } catch {
          continue;
        }
        if (!info.isFile()) continue;
        count += 1;
        bytes += info.size;
        const mtime = info.mtimeMs;
        localOldest = localOldest === null ? mtime : Math.min(localOldest, mtime);
        localNewest = localNewest === null ? mtime : Math.max(localNewest, mtime);
        if (mtime < cutoff) staleFiles += 1;
      }
      return { count, bytes, oldest: localOldest, newest: localNewest };
    };

    let topEntries;
    try {
      topEntries = await fsp.readdir(realTempRoot, { withFileTypes: true });
    } catch {
      return { ...ZERO_TEMP };
    }

    for (const entry of topEntries) {
      const full = path.join(realTempRoot, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        requestDirectories += 1;
        const sub = await scanDirectory(full);
        fileCount += sub.count;
        totalBytes += sub.bytes;
        if (sub.oldest !== null) {
          oldest = oldest === null ? sub.oldest : Math.min(oldest, sub.oldest);
        }
        let dirMtime: number;
        try {
          dirMtime = (await fsp.lstat(full)).mtimeMs;
        } catch {
          dirMtime = Date.now();
        }
        const newest = sub.newest ?? dirMtime;
        if (newest < cutoff) staleRequestDirectories += 1;
        continue;
      }
      if (!entry.isFile()) continue;
      let info;
      try {
        info = await fsp.lstat(full);
      } catch {
        continue;
      }
      if (!info.isFile()) continue;
      fileCount += 1;
      totalBytes += info.size;
      oldest = oldest === null ? info.mtimeMs : Math.min(oldest, info.mtimeMs);
      if (info.mtimeMs < cutoff) staleFiles += 1;
    }

    return {
      requestDirectories,
      fileCount,
      totalBytes,
      oldestModifiedAt: oldest === null ? null : new Date(oldest).toISOString(),
      staleRequestDirectories,
      staleFiles,
      unsafeRootDetected,
    };
  }

  async capacity(): Promise<CapacityAvailability> {
    try {
      const realRoot = await this.provider.realRoot();
      const stats = await fsp.statfs(realRoot);
      const totalBytes = stats.bsize * stats.blocks;
      const freeBytes = stats.bsize * stats.bavail;
      const usedBytes = totalBytes - freeBytes;
      const result: CapacityAvailability = {
        available: true,
        totalBytes,
        freeBytes,
        usedBytes,
      };
      if (totalBytes > 0) {
        result.freePercent = (freeBytes / totalBytes) * 100;
      }
      return result;
    } catch {
      return { available: false };
    }
  }

  async probe(storageKey: string): Promise<ObjectProbe> {
    try {
      const real = await this.provider.resolveStorageKeyReadPath(storageKey);
      const info = await fsp.stat(real);
      if (!info.isFile()) return { exists: false };
      return {
        exists: true,
        sizeBytes: info.size,
        modifiedAt: info.mtime.toISOString(),
      };
    } catch {
      return { exists: false };
    }
  }

  async checksum(storageKey: string): Promise<string | null> {
    try {
      const real = await this.provider.resolveStorageKeyReadPath(storageKey);
      return await calculateFileSha256(real);
    } catch {
      return null;
    }
  }

  async legacyFileProbe(filePath: string): Promise<LegacyProbeResult> {
    try {
      const real = await this.provider.resolveLegacyFilePathReadPath(filePath);
      const info = await fsp.stat(real);
      return info.isFile() ? "OK" : "MISSING";
    } catch (error) {
      return (error as { statusCode?: number })?.statusCode === 403
        ? "UNSAFE"
        : "MISSING";
    }
  }
}
