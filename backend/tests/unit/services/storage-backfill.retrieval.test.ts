import { readFile, rm, mkdtemp, mkdir, writeFile } from "fs/promises";
import { existsSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LocalStorageProvider } from "../../../src/storage/local-storage.provider";
import { LocalStorageDiagnostics } from "../../../src/storage/local-storage.diagnostics";
import { StorageBackfillService } from "../../../src/services/storage-backfill.service";
import { calculateFileSha256 } from "../../../src/utils/checksum";

/**
 * DL-12: backfill only adds metadata. Before apply the object resolves via
 * filePath; after apply it resolves via the derived storageKey — same bytes,
 * no copy/move/delete.
 */

const cleanups: string[] = [];

afterEach(async () => {
  while (cleanups.length) {
    await rm(cleanups.pop() as string, { recursive: true, force: true });
  }
});

describe("DL-12 backfill retrieval equivalence", () => {
  it("resolves the same physical bytes via filePath before and storageKey after apply", async () => {
    const base = await mkdtemp(path.join(tmpdir(), "dl12-retrieval-"));
    cleanups.push(base);
    const root = path.join(base, "root");
    await mkdir(root, { recursive: true });
    const provider = new LocalStorageProvider({ root });
    const diagnostics = new LocalStorageDiagnostics(provider);

    const legacyFile = path.join(root, "legacy-xyz");
    const bytes = "the exact original bytes";
    await writeFile(legacyFile, bytes);

    const applyCorBackfill = vi.fn().mockResolvedValue(1);
    const repo = {
      listLegacyCandidates: vi.fn().mockResolvedValue({
        cor: [
          {
            id: "cor-1",
            filePath: legacyFile,
            storageKey: null,
            storageProvider: null,
            sizeBytes: null,
            checksum: null,
            checksumAlgorithm: null,
          },
        ],
        thesis: [],
      }),
      countManaged: vi
        .fn()
        .mockResolvedValue({ managedCorUploads: 0, managedThesisDocuments: 0 }),
      applyCorBackfill,
      applyThesisBackfill: vi.fn(),
      countLegacyPathDebt: vi.fn().mockResolvedValue({}),
    };

    const service = new StorageBackfillService(
      repo as never,
      diagnostics as never,
      200,
    );

    // Before apply: legacy filePath resolution works.
    const beforePath = await provider.resolveLegacyFilePathReadPath(legacyFile);
    expect(await readFile(beforePath, "utf8")).toBe(bytes);

    const report = await service.apply();
    expect(report.summary.APPLIED).toBe(1);

    const [, , data] = applyCorBackfill.mock.calls[0];
    const derivedKey = (data as { storageKey: string }).storageKey;

    // After apply: storageKey resolution resolves the same bytes.
    const afterPath = await provider.resolveStorageKeyReadPath(derivedKey);
    expect(await readFile(afterPath, "utf8")).toBe(bytes);
    expect(await calculateFileSha256(afterPath)).toBe(
      await calculateFileSha256(legacyFile),
    );

    // No physical move/copy/delete: the legacy object is still in place.
    expect(existsSync(legacyFile)).toBe(true);
  });
});
