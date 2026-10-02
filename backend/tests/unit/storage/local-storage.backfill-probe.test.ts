import { existsSync } from "fs";
import { mkdir, mkdtemp, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { LocalStorageProvider } from "../../../src/storage/local-storage.provider";
import { LocalStorageDiagnostics } from "../../../src/storage/local-storage.diagnostics";
import { calculateSha256 } from "../../../src/utils/checksum";

/**
 * DL-12: legacy path -> actual contained real file -> derived storage key,
 * size and SHA-256. Read-only; never moves/copies/deletes the object.
 */

const cleanups: string[] = [];

async function makeDiag() {
  const base = await mkdtemp(path.join(tmpdir(), "dl12-probe-"));
  cleanups.push(base);
  const root = path.join(base, "root");
  await mkdir(root, { recursive: true });
  const provider = new LocalStorageProvider({ root });
  const diagnostics = new LocalStorageDiagnostics(provider);
  return { base, root, provider, diagnostics };
}

afterEach(async () => {
  while (cleanups.length) {
    await rm(cleanups.pop() as string, { recursive: true, force: true });
  }
});

describe("DL-12 legacyBackfillProbe", () => {
  it("derives an OK key/size/checksum from the actual contained file", async () => {
    const { root, diagnostics } = await makeDiag();
    await writeFile(path.join(root, "legacy-abc123"), "legacy-content");

    const result = await diagnostics.legacyBackfillProbe(
      path.join(root, "legacy-abc123"),
    );

    expect(result).toEqual({
      status: "OK",
      storageKey: "legacy-abc123",
      sizeBytes: "legacy-content".length,
      checksum: calculateSha256("legacy-content"),
    });
  });

  it("preserves current relative-path semantics (basename under root)", async () => {
    const { root, diagnostics } = await makeDiag();
    await writeFile(path.join(root, "only-name.bin"), "bytes");

    const result = await diagnostics.legacyBackfillProbe("only-name.bin");
    expect(result.status).toBe("OK");
    if (result.status === "OK") {
      expect(result.storageKey).toBe("only-name.bin");
    }
  });

  it("returns MISSING for a non-existent legacy file", async () => {
    const { root, diagnostics } = await makeDiag();
    const result = await diagnostics.legacyBackfillProbe(
      path.join(root, "nope.bin"),
    );
    expect(result).toEqual({ status: "MISSING" });
  });

  it("returns UNSAFE for an escaping path", async () => {
    const { base, diagnostics } = await makeDiag();
    const outside = path.join(base, "outside.bin");
    await writeFile(outside, "outside");
    expect(await diagnostics.legacyBackfillProbe(outside)).toEqual({
      status: "UNSAFE",
    });
  });

  it("returns UNSAFE for a directory (not a regular file)", async () => {
    const { root, diagnostics } = await makeDiag();
    const dir = path.join(root, "a-directory");
    await mkdir(dir);
    expect(await diagnostics.legacyBackfillProbe(dir)).toEqual({
      status: "UNSAFE",
    });
  });

  it("returns INVALID_KEY when the contained file cannot be a storage key", async () => {
    const { root, diagnostics } = await makeDiag();
    const weird = path.join(root, "bad name with spaces.pdf");
    await writeFile(weird, "x");

    expect(await diagnostics.legacyBackfillProbe(weird)).toEqual({
      status: "INVALID_KEY",
    });
  });

  it("never deletes or mutates the probed object", async () => {
    const { root, diagnostics } = await makeDiag();
    const file = path.join(root, "keep.bin");
    await writeFile(file, "keep");
    await diagnostics.legacyBackfillProbe(file);
    expect(existsSync(file)).toBe(true);
  });
});
