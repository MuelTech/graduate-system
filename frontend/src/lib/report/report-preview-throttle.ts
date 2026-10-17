/**
 * CDW-LIVE-1A — coalesced live-preview sender.
 *
 * At most one preview per interval. Bursts always resolve to the newest
 * snapshot; intermediate bodies are intentionally dropped because the preview is
 * best-effort ephemeral state.
 */

export interface ReportPreviewThrottleOptions<T> {
  intervalMs?: number;
  send: (value: T) => void;
  now?: () => number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}

const DEFAULT_INTERVAL_MS = 750;

export class ReportPreviewThrottle<T> {
  private readonly intervalMs: number;
  private readonly send: (value: T) => void;
  private readonly now: () => number;
  private readonly setTimer: (fn: () => void, ms: number) => unknown;
  private readonly clearTimer: (handle: unknown) => void;

  private pending: { value: T } | null = null;
  private timer: unknown = null;
  private lastSentAt: number | null = null;

  constructor(options: ReportPreviewThrottleOptions<T>) {
    this.intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;
    this.send = options.send;
    this.now = options.now ?? (() => Date.now());
    this.setTimer =
      options.setTimer ?? ((fn, ms) => setTimeout(fn, ms) as unknown);
    this.clearTimer =
      options.clearTimer ??
      ((handle) => clearTimeout(handle as ReturnType<typeof setTimeout>));
  }

  push(value: T): void {
    this.pending = { value };

    if (this.timer !== null) return;

    const elapsed =
      this.lastSentAt === null ? this.intervalMs : this.now() - this.lastSentAt;

    if (elapsed >= this.intervalMs) {
      this.flush();
      return;
    }

    this.timer = this.setTimer(() => {
      this.timer = null;
      this.flush();
    }, this.intervalMs - elapsed);
  }

  /** Drop any unsent trailing snapshot (disconnect/freeze/terminal state). */
  clear(): void {
    this.pending = null;
    if (this.timer !== null) {
      this.clearTimer(this.timer);
      this.timer = null;
    }
  }

  dispose(): void {
    this.clear();
  }

  private flush(): void {
    const pending = this.pending;
    if (!pending) return;
    this.pending = null;
    this.lastSentAt = this.now();
    this.send(pending.value);
  }
}
