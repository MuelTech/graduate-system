import { describe, expect, it } from "vitest";
import { StorageService } from "../../../src/storage/storage.service";
import type { StorageProvider } from "../../../src/storage/storage.types";

function makeProvider() {
  const calls = { storageKey: [] as string[], legacy: [] as unknown[] };
  const provider: StorageProvider = {
    name: "local",
    async resolveStorageKeyReadPath(key: string) {
      calls.storageKey.push(key);
      return `/root/${key}`;
    },
    async resolveLegacyFilePathReadPath(filePath) {
      calls.legacy.push(filePath);
      return `/root/legacy-${String(filePath)}`;
    },
    async openRead() {
      throw new Error("not used");
    },
    async exists() {
      return false;
    },
    async stat() {
      return null;
    },
    async delete() {},
  };
  return { provider, calls };
}

describe("StorageService read-path resolution", () => {
  it("prefers a modern storage key over a legacy filePath", async () => {
    const { provider, calls } = makeProvider();
    const service = new StorageService(provider);
    const resolved = await service.resolveReadPath({
      storageKey: "modern/key",
      filePath: "/legacy/path",
    });
    expect(resolved).toBe("/root/modern/key");
    expect(calls.storageKey).toEqual(["modern/key"]);
    expect(calls.legacy).toEqual([]);
  });

  it("falls back to legacy filePath when no storage key exists", async () => {
    const { provider, calls } = makeProvider();
    const service = new StorageService(provider);
    const resolved = await service.resolveReadPath({
      storageKey: null,
      filePath: "/legacy/path",
    });
    expect(resolved).toBe("/root/legacy-/legacy/path");
    expect(calls.storageKey).toEqual([]);
    expect(calls.legacy).toEqual(["/legacy/path"]);
  });

  it("returns a controlled 404 when neither source is present", async () => {
    const { provider } = makeProvider();
    const service = new StorageService(provider);
    await expect(service.resolveReadPath({})).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

describe("StorageService MIME preference", () => {
  const service = new StorageService(makeProvider().provider);

  it("prefers stored verified MIME", () => {
    expect(
      service.pickMimeType(
        { verifiedMimeType: "application/pdf" },
        "/root/x.bin",
      ),
    ).toBe("application/pdf");
  });

  it("falls back to legacy detected MIME", () => {
    expect(
      service.pickMimeType(
        { detectedMimeType: "image/png" },
        "/root/x.bin",
      ),
    ).toBe("image/png");
  });

  it("falls back to the extension of the resolved path", () => {
    expect(service.pickMimeType({}, "/root/x.JPG")).toBe("image/jpeg");
  });

  it("returns octet-stream for an unknown/extensionless path", () => {
    expect(service.pickMimeType({}, "/root/extensionless")).toBe(
      "application/octet-stream",
    );
  });
});

describe("StorageService original filename preference", () => {
  const service = new StorageService(makeProvider().provider);

  it("prefers the modern original filename", () => {
    expect(
      service.pickOriginalFilename(
        { originalFilename: "modern.pdf" },
        "/root/random",
      ),
    ).toBe("modern.pdf");
  });

  it("falls back to legacy filename then basename", () => {
    expect(
      service.pickOriginalFilename({ filename: "legacy.pdf" }, "/root/random"),
    ).toBe("legacy.pdf");
    expect(service.pickOriginalFilename({}, "/root/random")).toBe("random");
  });
});
