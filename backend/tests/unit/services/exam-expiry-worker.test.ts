import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const db = vi.hoisted(() => ({ entranceExamApplication: { findMany: vi.fn() } }));
const expire = vi.hoisted(() => vi.fn());
vi.mock("../../../src/config/database", () => ({ default: db }));
vi.mock("../../../src/repositories/exam-finalization.repository", () => ({ ExamFinalizationRepository: class { expire = expire; } }));
import { startExamExpiryWorker, sweepExpiredExaminations } from "../../../src/workers/exam-expiry.worker";
beforeEach(() => { vi.resetAllMocks(); vi.useFakeTimers(); vi.spyOn(console, "error").mockImplementation(() => {}); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
describe("B6 bounded expiry worker", () => {
  it("runs startup catch-up immediately, prevents overlapping intervals and stops", async () => {
    let release!: (value: { examined: number; finalized: number }) => void;
    const sweep = vi.fn().mockImplementationOnce(() => new Promise(done => { release = done; })).mockResolvedValue({ examined: 0, finalized: 0 });
    const worker = startExamExpiryWorker(sweep, 1000); expect(sweep).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(5000); expect(sweep).toHaveBeenCalledTimes(1);
    release({ examined: 1, finalized: 1 }); await Promise.resolve(); await vi.advanceTimersByTimeAsync(1000); expect(sweep).toHaveBeenCalledTimes(2);
    worker.stop(); await vi.advanceTimersByTimeAsync(5000); await worker.run(); expect(sweep).toHaveBeenCalledTimes(2);
  });
  it("logs sweep errors and permits later interval recovery", async () => {
    const sweep = vi.fn().mockRejectedValueOnce(new Error("temporary failure")).mockResolvedValue({ examined: 0, finalized: 0 });
    const worker = startExamExpiryWorker(sweep, 1000); await vi.advanceTimersByTimeAsync(1000);
    expect(sweep).toHaveBeenCalledTimes(2); expect(console.error).toHaveBeenCalled(); worker.stop();
  });
  it("filters started/unfinalized candidates, delegates each to the same authority, isolates application failure", async () => {
    db.entranceExamApplication.findMany.mockResolvedValue([{ id: "bad" }, { id: "good" }]);
    expire.mockRejectedValueOnce(new Error("invalid binding")).mockResolvedValueOnce({ receiptId: "receipt" });
    expect(await sweepExpiredExaminations()).toEqual({ examined: 2, finalized: 1 });
    const args = db.entranceExamApplication.findMany.mock.calls[0][0];
    expect(args.where).toMatchObject({ status: { in: ["PENDING", "APPROVED"] }, finalizedAt: null, actualStartedAt: { not: null }, contentRevisionId: { not: null } });
    expect(args.where.deadlineAt.lte).toBeInstanceOf(Date); expect(args.take).toBe(100);
    expect(expire.mock.calls).toEqual([["bad"], ["good"]]); expect(console.error).toHaveBeenCalled();
  });
  it("pages past a full failed batch rather than starving later executions", async () => {
    const batch = Array.from({ length: 100 }, (_, index) => ({ id: String(index).padStart(3, "0") }));
    db.entranceExamApplication.findMany.mockResolvedValueOnce(batch).mockResolvedValueOnce([{ id: "100" }]);
    expire.mockImplementation(async id => { if (id !== "100") throw new Error("bad binding"); return { receiptId: "safe" }; });
    expect(await sweepExpiredExaminations()).toEqual({ examined: 101, finalized: 1 });
    expect(db.entranceExamApplication.findMany.mock.calls[1][0].where.id).toEqual({ gt: "099" });
  });
});
