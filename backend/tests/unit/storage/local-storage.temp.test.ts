import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "fs/promises";
import { existsSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { LocalStorageProvider } from "../../../src/storage/local-storage.provider";

let base: string;
let root: string;
let provider: LocalStorageProvider;

beforeAll(async () => {
  base = await mkdtemp(path.join(tmpdir(), "dl2-provider-"));
  root = path.join(base, "root");
  await mkdir(root, { recursive: true });
  provider = new LocalStorageProvider({ root });
});

afterAll(async () => {
  await rm(base, { recursive: true, force: true });
});

async function writeTemp(name: string, content: string): Promise<string> {
  const dir = path.join(provider.temporaryRoot(), "req-1");
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, name);
  await writeFile(file, content);
  return file;
}

describe("LocalStorageProvider temporary storage primitives", () => {
  it("exposes a temporary root underneath the private storage root", () => {
    const tempRoot = provider.temporaryRoot();
    expect(path.isAbsolute(tempRoot)).toBe(true);
    expect(path.relative(root, tempRoot).startsWith("..")).toBe(false);
  });

  it("promotes a temporary object to a contained permanent key", async () => {
    const temp = await writeTemp("a", "promote-me");
    const permanent = await provider.promoteTemporaryFile(temp, "cor/abc123");
    expect(existsSync(temp)).toBe(false);
    expect(permanent).toBe(path.join(root, "cor", "abc123"));
    expect(await readFile(permanent, "utf8")).toBe("promote-me");
    const info = await stat(permanent);
    expect(info.isFile()).toBe(true);
  });

  it("rejects a storage key that escapes the root", async () => {
    const temp = await writeTemp("b", "x");
    await expect(
      provider.promoteTemporaryFile(temp, "../escape/key"),
    ).rejects.toThrow();
  });

  it("rejects a source path outside the temporary area", async () => {
    const outside = path.join(root, "not-in-temp");
    await writeFile(outside, "x");
    await expect(
      provider.promoteTemporaryFile(outside, "cor/zzz"),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("returns a controlled 404 when the temporary object is missing", async () => {
    const missing = path.join(provider.temporaryRoot(), "req-1", "nope");
    await expect(
      provider.promoteTemporaryFile(missing, "cor/missing"),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("discards a temporary object and is idempotent", async () => {
    const temp = await writeTemp("c", "discard-me");
    await provider.discardTemporaryFile(temp);
    expect(existsSync(temp)).toBe(false);
    await expect(provider.discardTemporaryFile(temp)).resolves.toBeUndefined();
  });

  it("rejects discarding a path outside the temporary area", async () => {
    const outside = path.join(root, "keep.txt");
    await writeFile(outside, "keep");
    await expect(
      provider.discardTemporaryFile(outside),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("removes a request temporary directory recursively", async () => {
    const dir = path.join(provider.temporaryRoot(), "req-remove");
    await mkdir(path.join(dir, "nested"), { recursive: true });
    await writeFile(path.join(dir, "nested", "f"), "x");
    await provider.removeTemporaryDir(dir);
    expect(existsSync(dir)).toBe(false);
  });
});
