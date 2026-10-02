import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppError } from "../../../src/utils/AppError";
import { LocalStorageProvider } from "../../../src/storage/local-storage.provider";

let root: string;
let outside: string;
let provider: LocalStorageProvider;

beforeAll(async () => {
  const base = await mkdtemp(path.join(tmpdir(), "dl1-provider-"));
  root = path.join(base, "root");
  outside = path.join(base, "outside");
  await mkdir(root, { recursive: true });
  await mkdir(outside, { recursive: true });
  provider = new LocalStorageProvider({ root });
});

afterAll(async () => {
  await rm(path.dirname(root), { recursive: true, force: true });
});

describe("LocalStorageProvider storage-key resolution", () => {
  it("resolves an existing object to an absolute path inside the root", async () => {
    await writeFile(path.join(root, "object-1"), "hello");
    const resolved = await provider.resolveStorageKeyReadPath("object-1");
    expect(path.isAbsolute(resolved)).toBe(true);
    expect(await readFile(resolved, "utf8")).toBe("hello");
  });

  it("rejects a traversal key before touching the filesystem", async () => {
    await expect(
      provider.resolveStorageKeyReadPath("../outside/secret"),
    ).rejects.toThrow(AppError);
  });

  it("rejects an absolute key", async () => {
    await expect(
      provider.resolveStorageKeyReadPath("/etc/passwd"),
    ).rejects.toThrow(AppError);
  });

  it("returns a controlled 404 for a missing object", async () => {
    await expect(
      provider.resolveStorageKeyReadPath("does-not-exist"),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("opens an existing object for reading", async () => {
    await writeFile(path.join(root, "read-me"), "stream-content");
    const stream = await provider.openRead("read-me");
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    expect(Buffer.concat(chunks).toString("utf8")).toBe("stream-content");
  });
});

describe("LocalStorageProvider existence and stat", () => {
  it("reports existence correctly", async () => {
    await writeFile(path.join(root, "present"), "abcde");
    await expect(provider.exists("present")).resolves.toBe(true);
    await expect(provider.exists("absent")).resolves.toBe(false);
  });

  it("returns size metadata for an existing object", async () => {
    await writeFile(path.join(root, "sized"), "1234567890");
    const stat = await provider.stat("sized");
    expect(stat).not.toBeNull();
    expect(stat?.sizeBytes).toBe(10);
    expect(stat?.provider).toBe("local");
    expect(stat?.storageKey).toBe("sized");
  });

  it("returns null stat for a missing object", async () => {
    await expect(provider.stat("nope")).resolves.toBeNull();
  });
});

describe("LocalStorageProvider delete", () => {
  it("removes an existing object", async () => {
    await writeFile(path.join(root, "to-delete"), "x");
    await provider.delete("to-delete");
    await expect(provider.exists("to-delete")).resolves.toBe(false);
  });

  it("is idempotent for a missing object", async () => {
    await expect(provider.delete("already-gone")).resolves.toBeUndefined();
  });
});

describe("LocalStorageProvider legacy filePath compatibility", () => {
  it("resolves an absolute legacy path inside the root", async () => {
    const abs = path.join(root, "legacy-abs");
    await writeFile(abs, "legacy");
    await expect(provider.resolveLegacyFilePathReadPath(abs)).resolves.toBe(
      abs,
    );
  });

  it("resolves a relative legacy path using the basename (legacy behavior)", async () => {
    await writeFile(path.join(root, "legacy-base"), "legacy-base");
    const resolved = await provider.resolveLegacyFilePathReadPath(
      "some/subdir/legacy-base",
    );
    expect(resolved).toBe(path.join(await provider.realRoot(), "legacy-base"));
  });

  it("rejects an absolute legacy path outside the root", async () => {
    const abs = path.join(outside, "secret.txt");
    await writeFile(abs, "secret");
    await expect(
      provider.resolveLegacyFilePathReadPath(abs),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("returns a controlled 404 for a missing legacy path", async () => {
    await expect(
      provider.resolveLegacyFilePathReadPath("missing-legacy"),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("rejects symlink escapes when the platform permits symlink creation", async (ctx) => {
    const escapePath = path.join(root, "escape-link");
    try {
      await symlink(path.join(outside, "secret.txt"), escapePath);
    } catch {
      ctx.skip();
      return;
    }
    await expect(
      provider.resolveStorageKeyReadPath("escape-link"),
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});
