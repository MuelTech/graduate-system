import { mkdir, mkdtemp, rm, writeFile } from "fs/promises";
import { existsSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { LocalStorageProvider } from "../../../src/storage/local-storage.provider";
import {
  cleanupRequestUploads,
  commitRequestUploads,
  registerPromotedUpload,
  setRequestTempDir,
} from "../../../src/storage/request-uploads";

let base: string;
let provider: LocalStorageProvider;

beforeAll(async () => {
  base = await mkdtemp(path.join(tmpdir(), "dl2-cleanup-"));
  provider = new LocalStorageProvider({ root: path.join(base, "root") });
});

afterAll(async () => {
  await rm(base, { recursive: true, force: true });
});

async function promote(bytes: string, key: string): Promise<string> {
  const dir = path.join(provider.temporaryRoot(), "req");
  await mkdir(dir, { recursive: true });
  const temp = path.join(dir, "f");
  await writeFile(temp, bytes);
  return provider.promoteTemporaryFile(temp, key);
}

describe("request upload cleanup registry", () => {
  it("deletes promoted objects and the request temp dir on failure", async () => {
    const req: any = {};
    const permanent = await promote("data", "evidence/one");
    registerPromotedUpload(req, "evidence/one", provider);
    const tempDir = path.join(provider.temporaryRoot(), "req");
    setRequestTempDir(req, tempDir, provider);

    await cleanupRequestUploads(req, provider);

    expect(existsSync(permanent)).toBe(false);
    expect(existsSync(tempDir)).toBe(false);
  });

  it("is idempotent when called twice", async () => {
    const req: any = {};
    await promote("data", "evidence/two");
    registerPromotedUpload(req, "evidence/two", provider);
    await cleanupRequestUploads(req, provider);
    await expect(cleanupRequestUploads(req, provider)).resolves.toBeUndefined();
  });

  it("does not delete promoted objects after a successful commit", async () => {
    const req: any = {};
    const permanent = await promote("data", "evidence/keep");
    registerPromotedUpload(req, "evidence/keep", provider);

    commitRequestUploads(req);
    await cleanupRequestUploads(req, provider);

    expect(existsSync(permanent)).toBe(true);
  });
});
