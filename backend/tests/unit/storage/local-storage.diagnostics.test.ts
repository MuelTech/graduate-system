import { existsSync } from "fs";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  utimes,
  writeFile,
} from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { LocalStorageProvider } from "../../../src/storage/local-storage.provider";
import { LocalStorageDiagnostics } from "../../../src/storage/local-storage.diagnostics";
import { MANAGED_STORAGE_PREFIXES } from "../../../src/storage/upload-policy";
import { calculateSha256 } from "../../../src/utils/checksum";

/**
 * DL-11: local read-only storage diagnostics against an isolated temp tree.
 * Never touches real production storage.
 */

const cleanups: string[] = [];

async function makeDiag() {
  const base = await mkdtemp(path.join(tmpdir(), "dl11-diag-"));
  cleanups.push(base);
  const root = path.join(base, "root");
  await mkdir(root, { recursive: true });
  const provider = new LocalStorageProvider({ root });
  const diagnostics = new LocalStorageDiagnostics(provider);
  return { base, root, provider, diagnostics };
}

async function trySymlink(target: string, linkPath: string): Promise<boolean> {
  // On Windows a plain directory symlink needs privilege; a junction does not
  // (and Node reports it as a symbolic link via lstat). Try junction first so
  // containment tests actually execute on Windows CI/dev machines.
  const types: Array<"junction" | "dir"> =
    process.platform === "win32" ? ["junction", "dir"] : ["dir"];
  for (const type of types) {
    try {
      await symlink(target, linkPath, type);
      return true;
    } catch {
      // try the next strategy
    }
  }
  return false;
}

afterEach(async () => {
  while (cleanups.length) {
    await rm(cleanups.pop() as string, { recursive: true, force: true });
  }
});

describe("LocalStorageDiagnostics managed objects", () => {
  it("derives managed namespaces from upload policies", () => {
    expect(MANAGED_STORAGE_PREFIXES).toContain("cor");
    expect(MANAGED_STORAGE_PREFIXES).toContain("manuscripts");
    expect(MANAGED_STORAGE_PREFIXES).toContain("evidence");
    expect(MANAGED_STORAGE_PREFIXES).toContain("instruments");
    expect(new Set(MANAGED_STORAGE_PREFIXES).size).toBe(
      MANAGED_STORAGE_PREFIXES.length,
    );
  });

  it("counts regular managed files and bytes, excluding .tmp", async () => {
    const { root, diagnostics } = await makeDiag();
    await mkdir(path.join(root, "cor"), { recursive: true });
    await mkdir(path.join(root, "manuscripts"), { recursive: true });
    await mkdir(path.join(root, ".tmp", "req"), { recursive: true });
    await writeFile(path.join(root, "cor", "a"), "0123456789");
    await writeFile(path.join(root, "manuscripts", "b"), "12345");
    await writeFile(path.join(root, ".tmp", "req", "inflight"), "temp");

    const listing = await diagnostics.listManagedObjects(MANAGED_STORAGE_PREFIXES);

    expect(listing.objects).toHaveLength(2);
    const total = listing.objects.reduce((sum, o) => sum + o.sizeBytes, 0);
    expect(total).toBe(15);
    expect(listing.objects.map((o) => o.namespace).sort()).toEqual([
      "cor",
      "manuscripts",
    ]);
    // internal enumeration may carry the key, but callers must never serialize it
    expect(listing.objects.every((o) => typeof o.storageKey === "string")).toBe(
      true,
    );
  });

  it("does not classify root-level legacy files as managed objects", async () => {
    const { root, diagnostics } = await makeDiag();
    await mkdir(path.join(root, "cor"), { recursive: true });
    await writeFile(path.join(root, "cor", "managed"), "12345");
    await writeFile(path.join(root, "legacy-random-name"), "legacy-bytes");
    await mkdir(path.join(root, "databank"), { recursive: true });
    await writeFile(path.join(root, "databank", "old"), "xx");

    const listing = await diagnostics.listManagedObjects(MANAGED_STORAGE_PREFIXES);
    const legacy = await diagnostics.legacyOrUnclassifiedSummary(
      MANAGED_STORAGE_PREFIXES,
    );

    expect(listing.objects).toHaveLength(1);
    expect(legacy.count).toBe(2);
    expect(legacy.totalBytes).toBe("legacy-bytes".length + 2);
  });

  it("reports a symlink inside a managed namespace without following it", async (ctx) => {
    const { base, root, diagnostics } = await makeDiag();
    const outside = path.join(base, "outside");
    await mkdir(outside, { recursive: true });
    await writeFile(path.join(outside, "victim"), "secret");
    await mkdir(path.join(root, "evidence"), { recursive: true });
    if (
      !(await trySymlink(outside, path.join(root, "evidence", "link")))
    ) {
      ctx.skip();
      return;
    }

    const listing = await diagnostics.listManagedObjects(MANAGED_STORAGE_PREFIXES);

    expect(listing.objects).toHaveLength(0);
    expect(listing.symlinks).toHaveLength(1);
    expect(listing.symlinks[0].namespace).toBe("evidence");
    // The external target must still be untouched/unread.
    expect(existsSync(path.join(outside, "victim"))).toBe(true);
  });
});

describe("LocalStorageDiagnostics capacity + probes", () => {
  it("returns a safe capacity shape without a mount path", async () => {
    const { diagnostics } = await makeDiag();
    const capacity = await diagnostics.capacity();
    expect(typeof capacity.available).toBe("boolean");
    const serialized = JSON.stringify(capacity);
    expect(serialized).not.toContain("root");
    expect(serialized).not.toContain(path.sep + path.sep);
    if (capacity.available) {
      expect(capacity.totalBytes).toBeGreaterThan(0);
      expect(capacity.freeBytes).toBeGreaterThanOrEqual(0);
    }
  });

  it("probes managed objects and rejects invalid/traversal keys", async () => {
    const { root, diagnostics } = await makeDiag();
    await mkdir(path.join(root, "cor"), { recursive: true });
    await writeFile(path.join(root, "cor", "present"), "12345");

    const found = await diagnostics.probe("cor/present");
    expect(found.exists).toBe(true);
    expect(found.sizeBytes).toBe(5);
    expect(typeof found.modifiedAt).toBe("string");

    expect((await diagnostics.probe("cor/missing")).exists).toBe(false);
    expect((await diagnostics.probe("../escape")).exists).toBe(false);
  });

  it("computes a streaming sha256 checksum for a managed object", async () => {
    const { root, diagnostics } = await makeDiag();
    await mkdir(path.join(root, "cor"), { recursive: true });
    await writeFile(path.join(root, "cor", "c"), "checksum-me");

    const checksum = await diagnostics.checksum("cor/c");
    expect(checksum).toBe(calculateSha256("checksum-me"));
    expect(await diagnostics.checksum("cor/nope")).toBeNull();
  });

  it("classifies legacy file paths as OK/MISSING/UNSAFE without exposing a path", async () => {
    const { base, root, diagnostics } = await makeDiag();
    await writeFile(path.join(root, "legacy.bin"), "legacy");

    expect(await diagnostics.legacyFileProbe(path.join(root, "legacy.bin"))).toBe(
      "OK",
    );
    expect(
      await diagnostics.legacyFileProbe(path.join(root, "missing.bin")),
    ).toBe("MISSING");

    const outside = path.join(base, "outside.bin");
    await writeFile(outside, "outside");
    expect(await diagnostics.legacyFileProbe(outside)).toBe("UNSAFE");
  });
});

describe("LocalStorageDiagnostics temporary summary", () => {
  it("classifies stale temp files without deleting anything", async () => {
    const { provider, diagnostics } = await makeDiag();
    const oldDir = await provider.ensureTemporaryDirectory("old");
    const newDir = await provider.ensureTemporaryDirectory("new");
    const oldFile = path.join(oldDir, "f");
    const newFile = path.join(newDir, "f");
    await writeFile(oldFile, "old-bytes");
    await writeFile(newFile, "new-bytes");

    const twoHoursAgo = new Date(Date.now() - 2 * 3600 * 1000);
    await utimes(oldFile, twoHoursAgo, twoHoursAgo);

    const summary = await diagnostics.tempSummary(1);

    expect(summary.requestDirectories).toBe(2);
    expect(summary.fileCount).toBe(2);
    expect(summary.totalBytes).toBe("old-bytes".length + "new-bytes".length);
    expect(summary.staleFiles).toBe(1);
    expect(summary.staleRequestDirectories).toBe(1);
    expect(summary.oldestModifiedAt).not.toBeNull();

    // Read-only: nothing was removed.
    expect(existsSync(oldFile)).toBe(true);
    expect(existsSync(newFile)).toBe(true);
  });

  it("returns a zero summary when no temp root exists", async () => {
    const { diagnostics } = await makeDiag();
    const summary = await diagnostics.tempSummary(24);
    expect(summary).toEqual({
      requestDirectories: 0,
      fileCount: 0,
      totalBytes: 0,
      oldestModifiedAt: null,
      staleRequestDirectories: 0,
      staleFiles: 0,
      unsafeRootDetected: false,
    });
  });

  it("does not follow a symlink inside the temp root", async (ctx) => {
    const { base, provider, diagnostics } = await makeDiag();
    const outside = path.join(base, "outside-temp");
    await mkdir(outside, { recursive: true });
    await writeFile(path.join(outside, "victim"), "secret");
    await provider.ensureTemporaryDirectory("req");
    if (
      !(await trySymlink(outside, path.join(provider.temporaryRoot(), "req", "link")))
    ) {
      ctx.skip();
      return;
    }

    const summary = await diagnostics.tempSummary(24);

    expect(summary.fileCount).toBe(0);
    expect(existsSync(path.join(outside, "victim"))).toBe(true);
  });
});

describe("DL-11 diagnostic containment hardening", () => {
  it("does not follow a managed namespace root symlink and never enumerates its target", async (ctx) => {
    const { base, root, diagnostics } = await makeDiag();
    const outside = path.join(base, "outside-cor");
    await mkdir(outside, { recursive: true });
    await writeFile(path.join(outside, "secret-file"), "external-secret");
    if (!(await trySymlink(outside, path.join(root, "cor")))) {
      ctx.skip();
      return;
    }

    const listing = await diagnostics.listManagedObjects(MANAGED_STORAGE_PREFIXES);

    // The external target is not enumerated as a managed object or orphan.
    expect(listing.objects).toHaveLength(0);
    // The namespace-root symlink is reported using only the safe namespace id.
    expect(listing.symlinks).toHaveLength(1);
    expect(listing.symlinks[0].namespace).toBe("cor");
    expect(listing.symlinks[0].storageKey).toBe("cor");
    const serialized = JSON.stringify(listing);
    expect(serialized).not.toContain("outside-cor");
    expect(serialized).not.toContain("secret-file");
    // Untouched.
    expect(existsSync(path.join(outside, "secret-file"))).toBe(true);
  });

  it("does not follow a .tmp root symlink and never enumerates its target", async (ctx) => {
    const { base, root, diagnostics } = await makeDiag();
    const outsideTemp = path.join(base, "outside-tmp-root");
    await mkdir(outsideTemp, { recursive: true });
    await writeFile(path.join(outsideTemp, "secret-file"), "external-secret");
    if (!(await trySymlink(outsideTemp, path.join(root, ".tmp")))) {
      ctx.skip();
      return;
    }

    const summary = await diagnostics.tempSummary(24);

    expect(summary.unsafeRootDetected).toBe(true);
    expect(summary.fileCount).toBe(0);
    expect(summary.totalBytes).toBe(0);
    expect(summary.requestDirectories).toBe(0);
    const serialized = JSON.stringify(summary);
    expect(serialized).not.toContain("outside-tmp-root");
    expect(serialized).not.toContain("secret-file");
    // Untouched, not deleted or repaired.
    expect(existsSync(path.join(outsideTemp, "secret-file"))).toBe(true);
  });

  it("flags a non-directory .tmp root as unsafe without touching it", async () => {
    const { root, diagnostics } = await makeDiag();
    const tmpFile = path.join(root, ".tmp");
    await writeFile(tmpFile, "not-a-directory");

    const summary = await diagnostics.tempSummary(24);

    expect(summary).toEqual({
      requestDirectories: 0,
      fileCount: 0,
      totalBytes: 0,
      oldestModifiedAt: null,
      staleRequestDirectories: 0,
      staleFiles: 0,
      unsafeRootDetected: true,
    });
    // Untouched, not deleted or repaired.
    expect(existsSync(tmpFile)).toBe(true);
    expect(await readFile(tmpFile, "utf8")).toBe("not-a-directory");
  });
});
