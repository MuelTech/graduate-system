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

  /** Absolute private temporary directory for in-flight uploads (lexical). */
  temporaryRoot(): string {
    return path.join(this.rootPath, ".tmp");
  }

  private isRealInside(parent: string, child: string): boolean {
    const relative = path.relative(parent, child);
    return (
      relative !== "" &&
      !relative.startsWith("..") &&
      !path.isAbsolute(relative)
    );
  }

  /**
   * Creates/returns a real directory for trusted relative segments, refusing to
   * traverse an escaping symlink at any level. Each existing component is
   * resolved and must remain inside the real private root; missing components
   * are created one level at a time so a symlinked parent cannot redirect the
   * write outside the root.
   */
  private async ensureRealDirectory(segments: string[]): Promise<string> {
    const realRoot = await this.realRoot();
    let current = realRoot;

    for (const segment of segments) {
      if (!segment || segment === "." || segment === "..") {
        throw new AppError("Access denied", 403);
      }
      const next = path.join(current, segment);
      let info: fs.Stats | null;
      try {
        info = await fsp.lstat(next);
      } catch {
        info = null;
      }

      if (info) {
        if (info.isSymbolicLink()) {
          const real = await fsp.realpath(next);
          if (!this.isRealInside(realRoot, real)) {
            throw new AppError("Access denied", 403);
          }
          current = real;
        } else if (info.isDirectory()) {
          current = next;
        } else {
          throw new AppError("Access denied", 403);
        }
      } else {
        await fsp.mkdir(next);
        current = next;
      }
    }

    return current;
  }

  private async resolveRealTempRoot(): Promise<string> {
    const realRoot = await this.realRoot();
    let realTempRoot: string;
    try {
      realTempRoot = await fsp.realpath(path.join(realRoot, ".tmp"));
    } catch {
      realTempRoot = path.join(realRoot, ".tmp");
    }
    if (!this.isRealInside(realRoot, realTempRoot)) {
      throw new AppError("Access denied", 403);
    }
    return realTempRoot;
  }

  /**
   * Resolves a temporary object to its real path, enforcing real temp-root
   * containment. Missing objects return null (or 404 when required).
   */
  private async resolveRealTempTarget(
    candidate: string,
    options: { required: boolean },
  ): Promise<string | null> {
    const realTempRoot = await this.resolveRealTempRoot();
    let real: string;
    try {
      real = await fsp.realpath(candidate);
    } catch {
      if (options.required) {
        throw new AppError("Temporary upload not found", 404);
      }
      return null;
    }
    if (!this.isRealInside(realTempRoot, real)) {
      throw new AppError("Access denied", 403);
    }
    return real;
  }

  /**
   * Safely creates and returns a private per-request temp directory under the
   * real temporary root. An escaping `.tmp` symlink is rejected before any
   * directory or file is created.
   */
  async ensureTemporaryDirectory(name: string): Promise<string> {
    if (
      !name ||
      name === "." ||
      name === ".." ||
      !/^[A-Za-z0-9._-]+$/.test(name)
    ) {
      throw new AppError("Access denied", 403);
    }

    await this.ensureRealDirectory([".tmp", name]);

    const realTempRoot = await this.resolveRealTempRoot();
    const realDir = await fsp.realpath(path.join(realTempRoot, name));
    if (!this.isRealInside(realTempRoot, realDir)) {
      throw new AppError("Access denied", 403);
    }
    return realDir;
  }

  /**
   * Moves a validated temporary object to a permanent managed storage key.
   * The temporary source must resolve inside the real temporary root, and every
   * permanent destination directory must resolve inside the real private root
   * (escaping namespace symlinks are rejected). Random keys never overwrite.
   */
  async promoteTemporaryFile(
    tempAbsolutePath: string,
    storageKey: string,
  ): Promise<string> {
    const normalized = normalizeStorageKey(storageKey);
    const segments = normalized.split("/");
    const fileName = segments.pop() as string;

    const realTemp = await this.resolveRealTempTarget(tempAbsolutePath, {
      required: true,
    });
    const realParent = await this.ensureRealDirectory(segments);
    const target = path.join(realParent, fileName);

    const existing = await fsp.lstat(target).catch(() => null);
    if (existing) {
      // Random keys should never collide; never overwrite or follow a link.
      throw new AppError("Access denied", 403);
    }

    await fsp.rename(realTemp as string, target);
    return target;
  }

  /** Best-effort temporary cleanup; idempotent for already-missing objects. */
  async discardTemporaryFile(tempAbsolutePath: string): Promise<void> {
    const real = await this.resolveRealTempTarget(tempAbsolutePath, {
      required: false,
    });
    if (!real) return;
    await fsp.unlink(real);
  }

  /**
   * Removes a per-request temporary directory recursively (idempotent). The
   * directory must resolve inside the real temp root; nested symlinks are
   * unlinked, never followed, so an external target cannot be deleted.
   */
  async removeTemporaryDir(dirAbsolutePath: string): Promise<void> {
    const real = await this.resolveRealTempTarget(dirAbsolutePath, {
      required: false,
    });
    if (!real) return;
    await fsp.rm(real, { recursive: true, force: true });
  }
}
