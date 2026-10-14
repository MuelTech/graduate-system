import { mkdtemp, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  DEFAULT_CHECKSUM_ALGORITHM,
  calculateFileSha256,
  calculateSha256,
} from "../../../src/utils/checksum";

// Well-known SHA-256 test vector for the ASCII string "abc".
const ABC_SHA256 =
  "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";

let workDir: string;

beforeAll(async () => {
  workDir = await mkdtemp(path.join(tmpdir(), "dl1-checksum-"));
});

afterAll(async () => {
  await rm(workDir, { recursive: true, force: true });
});

describe("SHA-256 checksum helper", () => {
  it("uses sha256 as the default algorithm", () => {
    expect(DEFAULT_CHECKSUM_ALGORITHM).toBe("sha256");
  });

  it("returns the deterministic digest for a known string input", () => {
    expect(calculateSha256("abc")).toBe(ABC_SHA256);
  });

  it("returns the deterministic digest for a known buffer input", () => {
    expect(calculateSha256(Buffer.from("abc", "utf8"))).toBe(ABC_SHA256);
  });

  it("returns the same digest whether input is a string or a file", async () => {
    const filePath = path.join(workDir, "abc.bin");
    await writeFile(filePath, "abc");
    await expect(calculateFileSha256(filePath)).resolves.toBe(ABC_SHA256);
  });

  it("produces a 64-character lowercase hex digest", () => {
    const digest = calculateSha256("representative thesis content");
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
  });
});
