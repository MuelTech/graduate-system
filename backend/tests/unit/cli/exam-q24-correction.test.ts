import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ reconcile: vi.fn(), disconnect: vi.fn() }));
vi.mock("../../../src/repositories/exam-q24-correction.repository", () => ({
  ExamQ24CorrectionRepository: class {
    reconcile = state.reconcile;
  },
}));
vi.mock("../../../src/config/database", () => ({
  default: { $disconnect: state.disconnect },
}));
vi.mock("../../../src/storage/index", () => {
  throw new Error("Correction CLI must not load private storage");
});
import { runQ24CorrectionCli } from "../../../src/cli/exam-q24-correction";
import { Q24_CORRECTION } from "../../../src/services/exam-q24-correction.service";
beforeEach(() => {
  vi.resetAllMocks();
  state.reconcile.mockResolvedValue({
    status: "PREFLIGHT_OK",
    optionRowsChanged: 0,
    importMarkersChanged: 0,
  });
});
describe("fixed-package Q24 correction CLI", () => {
  it("defaults to read-only reconciliation after validating the actual corrected package", async () => {
    expect(await runQ24CorrectionCli([])).toMatchObject({
      status: "PREFLIGHT_OK",
      optionRowsChanged: 0,
    });
    expect(state.reconcile).toHaveBeenCalledWith(
      expect.objectContaining({ fingerprint: Q24_CORRECTION.newFingerprint }),
      false,
    );
    expect(state.disconnect).toHaveBeenCalledOnce();
  });
  it("requires explicit apply for writes", async () => {
    await runQ24CorrectionCli(["--apply"]);
    expect(state.reconcile.mock.calls[0][1]).toBe(true);
  });
  it("disconnects on reconciliation failure", async () => {
    state.reconcile.mockRejectedValue(
      new Error("Synthetic transaction failure"),
    );
    await expect(runQ24CorrectionCli(["--apply"])).rejects.toThrow();
    expect(state.disconnect).toHaveBeenCalledOnce();
  });
  it.each([
    ["--force"],
    ["--apply", "--dry-run"],
    ["--apply", "--apply"],
    ["--root", "other"],
  ])("rejects unsafe arguments %j before DB operations", async (...argv) => {
    await expect(runQ24CorrectionCli(argv)).rejects.toThrow();
    expect(state.reconcile).not.toHaveBeenCalled();
    expect(state.disconnect).not.toHaveBeenCalled();
  });
});
