import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ExamDraftQueue, type SavedDraft } from "../../../../frontend/src/lib/exam-drafts";
const read = vi.fn(), write = vi.fn();
let queue: ExamDraftQueue, rows: SavedDraft[];
const choice = (id: string | null) => ({ selectedOptionId: id });
const essay = (text: string) => ({ essayAnswer: text });
const tick = () => Promise.resolve();
beforeEach(async () => {
  vi.useFakeTimers(); vi.clearAllMocks(); rows = [];
  read.mockImplementation(async () => rows);
  write.mockImplementation(async ({ expectedRevision, ...value }) => {
    const saved = { ...value, revision: expectedRevision + 1 }; rows = [...rows.filter(r => r.questionId !== value.questionId), saved]; return saved;
  });
  queue = new ExamDraftQueue({ read, write }); await queue.activate();
});
afterEach(() => { queue.pause(); vi.useRealTimers(); });
describe("B5 executable Applicant draft queue", () => {
  it("hydrates acknowledged choices, essay and explicit clear from a fresh mounted queue", async () => {
    rows = [{ questionId: "q", ...choice("o"), revision: 4 }, { questionId: "e", ...essay("restored"), revision: 8 }, { questionId: "blank", ...essay(""), revision: 1 }];
    await queue.resync(); expect(queue.snapshot()).toMatchObject({ ready: true, status: "saved", values: { q: choice("o"), e: essay("restored"), blank: essay("") } });
    const reopened = new ExamDraftQueue({ read, write }); await reopened.activate(); expect(reopened.snapshot()).toEqual(queue.snapshot()); reopened.pause();
  });
  it("saves MCQ selection/change/clear promptly and retains revision on clear", async () => {
    queue.change("q", choice("a")); expect(queue.snapshot().status).toBe("unsaved");
    await vi.advanceTimersByTimeAsync(100); queue.change("q", choice("b")); await vi.advanceTimersByTimeAsync(100);
    queue.change("q", choice(null)); await queue.flush();
    expect(write.mock.calls.map(c => c[0])).toEqual([
      { questionId: "q", ...choice("a"), expectedRevision: 0 }, { questionId: "q", ...choice("b"), expectedRevision: 1 }, { questionId: "q", ...choice(null), expectedRevision: 2 },
    ]); expect(rows[0]).toMatchObject({ selectedOptionId: null, revision: 3 });
  });
  it("bounds continuous essay typing with max wait and persists an explicit blank", async () => {
    for (let i = 0; i < 40; i++) { queue.change("e", essay(`text ${i}`)); await vi.advanceTimersByTimeAsync(100); }
    expect(write).toHaveBeenCalled(); await queue.flush(); queue.change("e", essay("")); await queue.flush();
    expect(rows[0]).toMatchObject({ essayAnswer: "", revision: expect.any(Number) });
  });
  it("keeps a newer local value when an older in-flight response arrives, then drains in order", async () => {
    let resolve!: (value: SavedDraft) => void;
    write.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    queue.change("e", essay("first")); const pending = queue.flush(); expect(queue.snapshot().status).toBe("saving");
    queue.change("e", essay("second")); expect(queue.snapshot().values.e).toEqual(essay("second"));
    resolve({ questionId: "e", ...essay("first"), revision: 1 }); await pending;
    expect(write.mock.calls[1][0]).toEqual({ questionId: "e", ...essay("second"), expectedRevision: 1 }); expect(queue.snapshot().status).toBe("saved");
  });
  it("retains failed local edits without success, resynchronizes before retry, and pauses offline", async () => {
    write.mockRejectedValueOnce(new Error("offline")); queue.change("e", essay("local")); expect(await queue.flush()).toBe(false);
    expect(queue.snapshot()).toMatchObject({ status: "error", values: { e: essay("local") } });
    queue.pause(); await vi.advanceTimersByTimeAsync(10000); expect(write).toHaveBeenCalledTimes(1);
    await queue.activate(); expect(await queue.prepare()).toBe(true); expect(read.mock.invocationCallOrder.at(-1)).toBeLessThan(write.mock.invocationCallOrder.at(-1)!);
    expect(rows[0]).toMatchObject({ essayAnswer: "local" });
  });
  it("detects competing acknowledged work on reconnect and never blindly resends stale content", async () => {
    rows = [{ questionId: "e", ...essay("base"), revision: 4 }]; await queue.resync(); queue.change("e", essay("local")); queue.pause();
    rows = [{ questionId: "e", ...essay("other device"), revision: 5 }]; await queue.activate();
    expect(queue.snapshot()).toMatchObject({ status: "conflict", values: { e: essay("local") } }); expect(await queue.prepare()).toBe(false); expect(write).not.toHaveBeenCalled();
    await queue.resync(true); expect(queue.snapshot()).toMatchObject({ status: "saved", values: { e: essay("other device") } });
  });
  it("stale-write rejection requires explicit authoritative refresh", async () => {
    write.mockRejectedValueOnce({ statusCode: 409 }); queue.change("q", choice("a")); await queue.flush(); expect(queue.snapshot().status).toBe("conflict");
    expect(await queue.prepare()).toBe(false); rows = [{ questionId: "q", ...choice("b"), revision: 1 }]; await queue.resync(true);
    expect(queue.snapshot().values.q).toEqual(choice("b")); expect(write).toHaveBeenCalledTimes(1);
  });
  it("lost response after commit reconciles the same acknowledged value without replay", async () => {
    write.mockImplementationOnce(async ({ expectedRevision, ...value }) => { rows = [{ ...value, revision: expectedRevision + 1 }]; throw new Error("response lost"); });
    queue.change("e", essay("committed")); await queue.flush(); expect(await queue.prepare()).toBe(true); expect(write).toHaveBeenCalledTimes(1); expect(queue.snapshot().status).toBe("saved");
  });
  it("submission preparation settles the in-flight write before reporting ready", async () => {
    let done!: (v: SavedDraft) => void; write.mockImplementationOnce(() => new Promise(resolve => { done = resolve; }));
    queue.change("q", choice("a")); void queue.flush(); let ready = false; const preparing = queue.prepare().then(value => { ready = value; });
    await tick(); expect(ready).toBe(false); rows = [{ questionId: "q", ...choice("a"), revision: 1 }]; done(rows[0]); await preparing; expect(ready).toBe(true);
  });
  it("read failure blocks recovery/readiness and deadline pause prevents queued writes", async () => {
    read.mockRejectedValueOnce(new Error("unavailable")); expect(await queue.prepare()).toBe(false); expect(queue.snapshot().status).toBe("error");
    await queue.resync(); queue.change("q", choice("a")); queue.pause(); await vi.advanceTimersByTimeAsync(5000); expect(write).not.toHaveBeenCalled(); expect(await queue.flush()).toBe(false);
  });
});
