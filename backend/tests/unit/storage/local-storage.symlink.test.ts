import { existsSync } from "fs";
import { mkdir, mkdtemp, readdir, rm, symlink, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { LocalStorageProvider } from "../../../src/storage/local-storage.provider";

const cleanups: string[] = [];

async function makeProvider() {
  const base = await mkdtemp(path.join(tmpdir(), "dl2-symlink-"));
  cleanups.push(base);
  const root = path.join(base, "root");
  await mkdir(root, { recursive: true });
  return { base, root, provider: new LocalStorageProvider({ root }) };
}

async function trySymlink(target: string, linkPath: string): Promise<boolean> {
  try {
    await symlink(target, linkPath, "dir");
    return true;
  } catch {
    return false;
  }
}

afterEach(async () => {
  while (cleanups.length) {
    const dir = cleanups.pop() as string;
    await rm(dir, { recursive: true, force: true });
  }
});

describe("LocalStorageProvider write-path symlink containment", () => {
  it("rejects promotion through an escaping namespace symlink and writes nothing outside", async (ctx) => {
    const { base, root, provider } = await makeProvider();
    const outside = path.join(base, "outside");
    await mkdir(outside, { recursive: true });
    if (!(await trySymlink(outside, path.join(root, "evidence")))) {
      ctx.skip();
      return;
    }

    const tempDir = await provider.ensureTemporaryDirectory("req1");
    const temp = path.join(tempDir, "f");
    await writeFile(temp, "payload");

    await expect(
      provider.promoteTemporaryFile(temp, "evidence/abc123"),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(await readdir(outside)).toEqual([]);
  });

  it("rejects an escaping .tmp symlink before creating request directories", async (ctx) => {
    const { base, root, provider } = await makeProvider();
    const outside = path.join(base, "outside-tmp");
    await mkdir(outside, { recursive: true });
    if (!(await trySymlink(outside, path.join(root, ".tmp")))) {
      ctx.skip();
      return;
    }

    await expect(
      provider.ensureTemporaryDirectory("req1"),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(await readdir(outside)).toEqual([]);
  });

  it("recursive temp cleanup cannot delete an external target through a nested symlink", async (ctx) => {
    const { base, provider } = await makeProvider();
    const outside = path.join(base, "outside-victim");
    await mkdir(outside, { recursive: true });
    await writeFile(path.join(outside, "victim.txt"), "keep");

    const reqDir = await provider.ensureTemporaryDirectory("req1");
    if (!(await trySymlink(outside, path.join(reqDir, "link")))) {
      ctx.skip();
      return;
    }

    await provider.removeTemporaryDir(reqDir);

    expect(existsSync(path.join(outside, "victim.txt"))).toBe(true);
    expect(existsSync(reqDir)).toBe(false);
  });

  it("allows a contained .tmp symlink and promotes normally", async (ctx) => {
    const { root, provider } = await makeProvider();
    const realTmp = path.join(root, "realtmp");
    await mkdir(realTmp, { recursive: true });
    if (!(await trySymlink(realTmp, path.join(root, ".tmp")))) {
      ctx.skip();
      return;
    }

    const requestDir = await provider.ensureTemporaryDirectory("req1");
    expect(requestDir.startsWith(realTmp)).toBe(true);

    const temp = path.join(requestDir, "f");
    await writeFile(temp, "ok");
    const permanent = await provider.promoteTemporaryFile(temp, "docs/xyz");

    expect(existsSync(permanent)).toBe(true);
    expect(permanent).toBe(path.join(root, "docs", "xyz"));
  });

  it("rejects discarding a path outside the temporary area", async () => {
    const { root, provider } = await makeProvider();
    await provider.ensureTemporaryDirectory("req1");
    const outside = path.join(root, "keep.txt");
    await writeFile(outside, "keep");
    await expect(
      provider.discardTemporaryFile(outside),
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});
