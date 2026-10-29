import { describe, expect, it, vi } from "vitest";
// Dry-run/default mode must never load a DB connection or private storage provider.
vi.mock("../../../src/config/database", () => { throw new Error("Preflight imported the database"); });
vi.mock("../../../src/storage/index", () => { throw new Error("Preflight imported private storage"); });
import { parseExamImportArgs, runExamContentImportCli } from "../../../src/cli/exam-content-import";

describe("operator-only verified-import CLI", () => {
  it("defaults to preflight and requires explicit --apply for persistence", () => {
    expect(parseExamImportArgs([])).toEqual({ apply: false });
    expect(parseExamImportArgs(["--dry-run"])).toEqual({ apply: false });
    expect(parseExamImportArgs(["--apply"])).toEqual({ apply: true });
  });

  it.each([["--apply", "--dry-run"], ["--root", "C:/other"], ["--apply", "--apply"], ["--force"]])("rejects unsafe/ambiguous arguments %j", (...argv) => {
    expect(() => parseExamImportArgs(argv)).toThrow();
  });

  it("validates the fixed real package without importing DB or private storage modules", async () => {
    const result = await runExamContentImportCli([]);
    expect(result).toMatchObject({ status: "PREFLIGHT_OK", questionsValidated: 72, assets: 108, questionsImported: 0, mediaObjectsCreated: 0 });
    expect(JSON.stringify(result)).not.toMatch(/storageKey|provider|assets\/|isCorrect|correctAnswer|fingerprint/);
  });
});
