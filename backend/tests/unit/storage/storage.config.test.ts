import { mkdtemp, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  StorageConfigError,
  resolveStorageConfig,
} from "../../../src/config/storage.config";

let workDir: string;

beforeAll(async () => {
  workDir = await mkdtemp(path.join(tmpdir(), "dl1-storage-config-"));
});

afterAll(async () => {
  await rm(workDir, { recursive: true, force: true });
});

describe("storage configuration", () => {
  it("supports the practical development default", () => {
    const config = resolveStorageConfig({
      nodeEnv: "development",
      cwd: "D:\\app",
    });
    expect(config.isProduction).toBe(false);
    expect(config.provider).toBe("local");
    expect(config.root).toBe(path.resolve("D:\\app", "./uploads"));
  });

  it("resolves a relative development root to a predictable absolute path", () => {
    const config = resolveStorageConfig({
      uploadDir: "./private-uploads",
      nodeEnv: "test",
      cwd: "/srv/app",
    });
    expect(path.isAbsolute(config.root)).toBe(true);
    expect(config.root).toBe(path.resolve("/srv/app", "./private-uploads"));
  });

  it("refuses to use an implicit default root in production", () => {
    expect(() =>
      resolveStorageConfig({ nodeEnv: "production", cwd: "/srv/app" }),
    ).toThrow(StorageConfigError);
  });

  it("accepts an explicit persistent production root outside the app directory", () => {
    const config = resolveStorageConfig({
      uploadDir: "/srv/graduate-private-digitized-storage",
      nodeEnv: "production",
      cwd: "/srv/app",
    });
    expect(config.isProduction).toBe(true);
    expect(config.root).toBe(
      path.resolve("/srv/graduate-private-digitized-storage"),
    );
  });

  it("rejects a production root inside a public/static webroot", () => {
    expect(() =>
      resolveStorageConfig({
        uploadDir: "/srv/app/public/uploads",
        nodeEnv: "production",
        cwd: "/srv/app",
      }),
    ).toThrow(StorageConfigError);

    expect(() =>
      resolveStorageConfig({
        uploadDir: "/srv/app/static/uploads",
        nodeEnv: "production",
        cwd: "/srv/app",
      }),
    ).toThrow(StorageConfigError);
  });

  it("rejects a production root inside a disposable build directory", () => {
    expect(() =>
      resolveStorageConfig({
        uploadDir: "/srv/app/dist/uploads",
        nodeEnv: "production",
        cwd: "/srv/app",
      }),
    ).toThrow(StorageConfigError);
  });

  it("rejects a production root equal to the application directory", () => {
    expect(() =>
      resolveStorageConfig({
        uploadDir: "/srv/app",
        nodeEnv: "production",
        cwd: "/srv/app",
      }),
    ).toThrow(StorageConfigError);
  });

  it("rejects a root that points at an existing file", async () => {
    const filePath = path.join(workDir, "not-a-dir.txt");
    await writeFile(filePath, "x");
    expect(() =>
      resolveStorageConfig({
        uploadDir: filePath,
        nodeEnv: "development",
        cwd: workDir,
      }),
    ).toThrow(StorageConfigError);
  });
});
