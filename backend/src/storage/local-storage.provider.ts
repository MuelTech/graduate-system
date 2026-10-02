import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import { AppError } from "../utils/AppError";
import { normalizeStorageKey } from "./storage-key";
import type { StorageObjectStat, StorageProvider } from "./storage.types";

/**
 * DL-1: private local filesystem storage provider.
 *
 * Responsibilities:
 * - resolve a stable storage key to a contained absolute path;
 * - resolve legacy `filePath` records without breaking existing behavior;
 * - expose existence/stat/delete primitives for later packages;
 * - centralize path-traversal and symlink/realpath containment checks.
 *
 * The provider never returns a public URL and never exposes the storage root
 * to clients. Error messages/status codes are preserved from the previous
 * DocumentService behavior (404 missing, 403 escape).
 */

export interface LocalStorageProviderOptions {
  root: string;
  provider?: string;
}

export class LocalStorageProvider implements StorageProvider {
  readonly name: string;
  private readonly rootPath: string;
  private realRootPromise?: Promise<string>;

  constructor(options: LocalStorageProviderOptions) {
    if (!options?.root) {
      throw new AppError("Storage root is not configured.", 500);
    }
    this.rootPath = path.resolve(options.root);
    this.name = options.provider ?? "local";
  }

  /** Absolute, symlink-resolved storage root (created on first use). */
  async realRoot(): Promise<string> {
    if (!this.realRootPromise) {
      this.realRootPromise = (async () => {
        await fsp.mkdir(this.rootPath, { recursive: true });
        return fsp.realpath(this.rootPath);
      })();
    }
    return this.realRootPromise;
  }

  private assertLexicallyContained(candidate: string): void {
    const relative = path.relative(this.rootPath, candidate);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new AppError("Access denied", 403);
    }
  }

  private async assertRealContained(realCandidate: string): Promise<void> {
    const realRoot = await this.realRoot();
    const relative = path.relative(realRoot, realCandidate);
    if (
      relative === "" ||
      relative.startsWith("..") ||
      path.isAbsolute(relative)
    ) {
      throw new AppError("Access denied", 403);
    }
  }

  private keyCandidate(normalizedKey: string): string {
    return path.join(this.rootPath, ...normalizedKey.split("/"));
  }

  /**
   * Resolves a modern managed document by stable storage key. Traversal and
   * symlink/realpath escapes are rejected; missing objects yield a controlled
   * 404.
   */
  async resolveStorageKeyReadPath(storageKey: string): Promise<string> {
    const normalized = normalizeStorageKey(storageKey);
    const candidate = this.keyCandidate(normalized);
    this.assertLexicallyContained(candidate);

    let real: string;
    try {
      real = await fsp.realpath(candidate);
    } catch {
      throw new AppError("File not found on disk", 404);
    }
    await this.assertRealContained(real);
    return real;
  }

  /**
   * Resolves a legacy `filePath` record. Preserves the historical behavior:
   * absolute paths are used as given (then contained), relative paths are
   * joined to the root by basename.
   */
  async resolveLegacyFilePathReadPath(
    filePath: string | null | undefined,
  ): Promise<string> {
    if (!filePath) {
      throw new AppError("No file attached to this document", 404);
    }

    const isAbsolute = path.isAbsolute(filePath);
    const candidate = isAbsolute
      ? filePath
      : path.join(this.rootPath, path.basename(filePath));

    let real: string;
    try {
      real = await fsp.realpath(candidate);
    } catch {
      throw new AppError("File not found on disk", 404);
    }
    await this.assertRealContained(real);
    return real;
  }

  async openRead(storageKey: string): Promise<fs.ReadStream> {
    const resolved = await this.resolveStorageKeyReadPath(storageKey);
    return fs.createReadStream(resolved);
  }

  async exists(storageKey: string): Promise<boolean> {
    let normalized: string;
    try {
      normalized = normalizeStorageKey(storageKey);
    } catch {
      return false;
    }
    const candidate = this.keyCandidate(normalized);
    try {
      this.assertLexicallyContained(candidate);
      const real = await fsp.realpath(candidate);
      await this.assertRealContained(real);
      const stat = await fsp.stat(real);
      return stat.isFile();
    } catch {
      return false;
    }
  }

  async stat(storageKey: string): Promise<StorageObjectStat | null> {
    const normalized = normalizeStorageKey(storageKey);
    const candidate = this.keyCandidate(normalized);
    this.assertLexicallyContained(candidate);

    let real: string;
    try {
      real = await fsp.realpath(candidate);
    } catch {
      return null;
    }
    try {
      await this.assertRealContained(real);
    } catch {
      return null;
    }
    const stat = await fsp.stat(real);
    if (!stat.isFile()) return null;
    return {
      storageKey: normalized,
      provider: this.name,
      sizeBytes: stat.size,
    };
  }

  /**
   * Controlled delete for cleanup/maintenance only. Idempotent for missing
   * objects; never deletes outside the configured root.
   */
  async delete(storageKey: string): Promise<void> {
    const normalized = normalizeStorageKey(storageKey);
    const candidate = this.keyCandidate(normalized);
    this.assertLexicallyContained(candidate);

    let real: string;
    try {
      real = await fsp.realpath(candidate);
    } catch {
      return;
    }
    await this.assertRealContained(real);
    await fsp.unlink(real);
  }

  // ── DL-2: private temporary/quarantine lifecycle ──────────────────────

  /** Absolute private temporary directory for in-flight uploads. */
  temporaryRoot(): string {
    return path.join(this.rootPath, ".tmp");
  }

  private assertWithinTemp(tempAbsolutePath: string): void {
    const relative = path.relative(this.temporaryRoot(), tempAbsolutePath);
    if (relative === "" || relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new AppError("Access denied", 403);
    }
  }

  private async assertRealWithinTemp(realTempPath: string): Promise<void> {
    const realTempRoot = path.join(await this.realRoot(), ".tmp");
    const relative = path.relative(realTempRoot, realTempPath);
    if (relative === "" || relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new AppError("Access denied", 403);
    }
  }

  /**
   * Moves a validated temporary object to a permanent managed storage key.
   * Both the temporary source and the permanent destination are contained;
   * the caller is responsible for having validated content beforehand.
   */
  async promoteTemporaryFile(
    tempAbsolutePath: string,
    storageKey: string,
  ): Promise<string> {
    const normalized = normalizeStorageKey(storageKey);
    const permanentCandidate = this.keyCandidate(normalized);
    this.assertLexicallyContained(permanentCandidate);
    this.assertWithinTemp(tempAbsolutePath);

    let realTemp: string;
    try {
      realTemp = await fsp.realpath(tempAbsolutePath);
    } catch {
      throw new AppError("Temporary upload not found", 404);
    }
    await this.assertRealWithinTemp(realTemp);

    await fsp.mkdir(path.dirname(permanentCandidate), { recursive: true });
    await fsp.rename(realTemp, permanentCandidate);
    return permanentCandidate;
  }

  /** Best-effort temporary cleanup; idempotent for already-missing objects. */
  async discardTemporaryFile(tempAbsolutePath: string): Promise<void> {
    this.assertWithinTemp(tempAbsolutePath);
    try {
      await fsp.unlink(tempAbsolutePath);
    } catch {
      // already removed
    }
  }

  /** Removes a per-request temporary directory recursively (idempotent). */
  async removeTemporaryDir(dirAbsolutePath: string): Promise<void> {
    this.assertWithinTemp(dirAbsolutePath);
    await fsp.rm(dirAbsolutePath, { recursive: true, force: true });
  }
}
