import { mkdir, mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { LocalStorageProvider } from "../../../src/storage/local-storage.provider";
import { calculateFileSha256 } from "../../../src/utils/checksum";

/**
 * DL-12: automated persistence rehearsal. A managed object promoted by one
 * provider instance is still resolvable, byte-identical, by a fresh provider
 * instance pointed at the same persistent root — simulating application
 * restart/redeploy against persistent local storage. Isolated temp root only.
 */

const cleanups: string[] = [];

afterEach(async () => {
  while (cleanups.length) {
    await rm(cleanups.pop() as string, { recursive: true, force: true });
  }
});

describe("DL-12 provider-recreation persistence rehearsal", () => {
  it("resolves the same bytes and checksum after the provider is recreated", async () => {
    const base = await mkdtemp(path.join(tmpdir(), "dl12-persist-"));
    cleanups.push(base);
    const root = path.join(base, "root");
    await mkdir(root, { recursive: true });

    const bytes = "persistent managed object bytes";
    const providerA = new LocalStorageProvider({ root });
    const tempDir = await providerA.ensureTemporaryDirectory("req-1");
    const tempFile = path.join(tempDir, "upload");
    await writeFile(tempFile, bytes);
    const permanentA = await providerA.promoteTemporaryFile(
      tempFile,
      "cor/persist-abc",
    );
    const checksumA = await calculateFileSha256(permanentA);

    // "Release" provider A and create a fresh provider against the same root.
    const providerB = new LocalStorageProvider({ root });
    const resolvedB = await providerB.resolveStorageKeyReadPath("cor/persist-abc");

    expect(await readFile(resolvedB, "utf8")).toBe(bytes);
    expect(await calculateFileSha256(resolvedB)).toBe(checksumA);

    const statB = await providerB.stat("cor/persist-abc");
    expect(statB?.sizeBytes).toBe(bytes.length);
    expect(statB?.provider).toBe("local");
  });
});
