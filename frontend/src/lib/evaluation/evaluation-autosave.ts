/**
 * CDW-LIVE-1B — private individual evaluation DRAFT autosave.
 *
 * Framework-free so durability/serialization can be verified in Node. The
 * authoritative write remains the existing authenticated REST evaluation draft
 * endpoint; this controller only decides when to call it and how to serialize
 * writes. It never handles signatures or finalization.
 */

export interface EvaluationDraftSnapshot {
  criteria: Record<string, number | null>;
  recommendations: string;
}

export type EvaluationAutosaveStatus =
  | "clean"
  | "dirty"
  | "saving"
  | "saved"
  | "error"
  | "offline";

export type EvaluationAutosaveLifecycle = "active" | "draining" | "disposed";

export interface EvaluationAutosaveState {
  status: EvaluationAutosaveStatus;
  hasUnsavedChanges: boolean;
  error: string | null;
  savedAt: number | null;
}

export interface EvaluationAutosaveControllerOptions {
  save: (snapshot: EvaluationDraftSnapshot) => Promise<void>;
  initialSnapshot: EvaluationDraftSnapshot;
  /** True only when an authoritative server draft was already loaded. */
  initialPersisted?: boolean;
  debounceMs?: number;
  maxWaitMs?: number;
  now?: () => number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
  onStateChange?: (state: EvaluationAutosaveState) => void;
}

const DEFAULT_DEBOUNCE_MS = 2000;
const DEFAULT_MAX_WAIT_MS = 10000;

function normalizeSnapshot(snapshot: EvaluationDraftSnapshot): EvaluationDraftSnapshot {
  const criteria: Record<string, number | null> = {};
  for (const key of Object.keys(snapshot.criteria ?? {}).sort()) {
    const value = snapshot.criteria[key];
    criteria[key] =
      typeof value === "number" && Number.isFinite(value) ? value : null;
  }
  return {
    criteria,
    recommendations: String(snapshot.recommendations ?? ""),
  };
}

export class EvaluationAutosaveController {
  private readonly save: (snapshot: EvaluationDraftSnapshot) => Promise<void>;
  private readonly debounceMs: number;
  private readonly maxWaitMs: number;
  private readonly now: () => number;
  private readonly setTimer: (fn: () => void, ms: number) => unknown;
  private readonly clearTimer: (handle: unknown) => void;
  private readonly onStateChange?: (state: EvaluationAutosaveState) => void;

  private latestSnapshot: EvaluationDraftSnapshot;
  private latestKey: string;
  private savedKey: string;

  private dirty = false;
  private inFlight = false;
  private online = true;
  private lifecycle: EvaluationAutosaveLifecycle = "active";
  private hasPersistedSave: boolean;

  private unsavedSince: number | null = null;
  private idleTimer: unknown = null;
  private maxTimer: unknown = null;

  private status: EvaluationAutosaveStatus = "clean";
  private error: string | null = null;
  private savedAt: number | null = null;

  private settleWaiters: Array<(ok: boolean) => void> = [];
  private disposePromise: Promise<void> | null = null;
  private resolveDispose: (() => void) | null = null;

  constructor(options: EvaluationAutosaveControllerOptions) {
    this.save = options.save;
    this.debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS;
    this.maxWaitMs = options.maxWaitMs ?? DEFAULT_MAX_WAIT_MS;
    this.now = options.now ?? (() => Date.now());
    this.setTimer =
      options.setTimer ?? ((fn, ms) => setTimeout(fn, ms) as unknown);
    this.clearTimer =
      options.clearTimer ??
      ((handle) => clearTimeout(handle as ReturnType<typeof setTimeout>));
    this.onStateChange = options.onStateChange;

    this.latestSnapshot = normalizeSnapshot(options.initialSnapshot);
    this.latestKey = JSON.stringify(this.latestSnapshot);
    this.savedKey = this.latestKey;
    this.hasPersistedSave = options.initialPersisted === true;

    this.emit();
  }

  getState(): EvaluationAutosaveState {
    return {
      status: this.status,
      hasUnsavedChanges: this.hasUnsavedChanges(),
      error: this.error,
      savedAt: this.savedAt,
    };
  }

  getLifecycleState(): EvaluationAutosaveLifecycle {
    return this.lifecycle;
  }

  hasUnsavedChanges(): boolean {
    return this.dirty || this.inFlight;
  }

  update(snapshot: EvaluationDraftSnapshot): void {
    if (this.lifecycle !== "active") return;

    const normalized = normalizeSnapshot(snapshot);
    this.latestSnapshot = normalized;
    this.latestKey = JSON.stringify(normalized);

    if (this.latestKey === this.savedKey) {
      this.dirty = false;
      this.unsavedSince = null;
      this.clearTimers();
      this.error = null;
      this.setStatus(this.hasPersistedSave ? "saved" : "clean");
      return;
    }

    this.dirty = true;
    this.error = null;

    if (this.unsavedSince === null) {
      this.unsavedSince = this.now();
    }

    if (!this.online) {
      this.clearTimers();
      this.setStatus("offline");
      return;
    }

    this.scheduleIdleSave();
    this.armMaxWait();

    if (!this.inFlight) {
      this.setStatus("dirty");
    } else {
      this.emit();
    }
  }

  /**
   * Flush the newest snapshot immediately through the same serialized pipeline.
   * Returns false when a request is already in flight or the controller cannot
   * save (offline/lifecycle no longer active).
   */
  flushNow(): boolean {
    if (this.lifecycle !== "active") return false;
    if (this.inFlight) return false;
    if (!this.dirty) return true;
    if (!this.online) {
      this.setStatus("offline");
      return false;
    }

    this.clearTimers();
    void this.requestSave();
    return true;
  }

  /**
   * Finalization boundary helper: resolve true only when the newest local draft
   * has been persisted, false when saving failed or is impossible. Never
   * finalizes anything itself.
   */
  flushAndWait(): Promise<boolean> {
    if (this.lifecycle !== "active") return Promise.resolve(false);
    if (!this.dirty && !this.inFlight) {
      return Promise.resolve(this.status !== "error" && this.status !== "offline");
    }
    if (!this.online) return Promise.resolve(false);

    this.clearTimers();

    return new Promise<boolean>((resolve) => {
      this.settleWaiters.push(resolve);
      if (!this.inFlight) {
        void this.requestSave();
      }
    });
  }

  setOnline(online: boolean): void {
    if (this.lifecycle === "disposed" || this.online === online) return;
    this.online = online;

    if (this.lifecycle !== "active") return;

    if (!online) {
      this.clearTimers();
      if (this.dirty) this.setStatus("offline");
      return;
    }

    if (this.dirty && !this.inFlight) {
      this.clearTimers();
      void this.requestSave();
    }
  }

  /**
   * Request unmount cleanup. Rejects new edits, waits for any in-flight request,
   * and drains the newest dirty state before settling. Hard browser unload is
   * still not guaranteed.
   */
  dispose(): Promise<void> {
    if (this.lifecycle === "disposed") return Promise.resolve();
    if (this.disposePromise) return this.disposePromise;

    this.lifecycle = "draining";
    this.clearTimers();

    this.disposePromise = new Promise<void>((resolve) => {
      this.resolveDispose = resolve;
    });

    if (!this.inFlight) {
      if (this.dirty && this.online) {
        void this.requestSave();
      } else {
        this.finishDispose();
      }
    }

    return this.disposePromise;
  }

  private scheduleIdleSave(): void {
    if (this.idleTimer !== null) {
      this.clearTimer(this.idleTimer);
    }
    this.idleTimer = this.setTimer(() => {
      this.idleTimer = null;
      void this.requestSave();
    }, this.debounceMs);
  }

  private armMaxWait(): void {
    if (this.maxTimer !== null || this.unsavedSince === null) return;
    const elapsed = this.now() - this.unsavedSince;
    const remaining = Math.max(0, this.maxWaitMs - elapsed);
    this.maxTimer = this.setTimer(() => {
      this.maxTimer = null;
      void this.requestSave();
    }, remaining);
  }

  private clearTimers(): void {
    if (this.idleTimer !== null) {
      this.clearTimer(this.idleTimer);
      this.idleTimer = null;
    }
    if (this.maxTimer !== null) {
      this.clearTimer(this.maxTimer);
      this.maxTimer = null;
    }
  }

  private async requestSave(): Promise<void> {
    if (this.lifecycle === "disposed") return;

    if (this.inFlight || !this.dirty) {
      if (this.lifecycle === "draining" && !this.inFlight) {
        this.finishDispose();
      }
      return;
    }

    if (!this.online) {
      this.setStatus("offline");
      if (this.lifecycle === "draining") this.finishDispose();
      return;
    }

    this.clearTimers();

    const snapshot = this.latestSnapshot;
    const snapshotKey = this.latestKey;

    this.inFlight = true;
    this.setStatus("saving");

    try {
      await this.save(snapshot);

      this.inFlight = false;
      this.savedKey = snapshotKey;
      this.savedAt = this.now();
      this.hasPersistedSave = true;
      this.error = null;

      if (this.latestKey !== snapshotKey) {
        this.dirty = true;
        if (!this.online) {
          this.setStatus("offline");
          if (this.lifecycle === "draining") this.finishDispose();
          return;
        }
        // Newest local state arrived while this request was in flight. Save it
        // now through the same single-in-flight pipeline.
        void this.requestSave();
        return;
      }

      this.dirty = false;
      this.unsavedSince = null;
      this.setStatus("saved");
      if (this.lifecycle === "draining") this.finishDispose();
    } catch (error) {
      this.inFlight = false;
      this.dirty = true;
      this.unsavedSince = this.now();
      this.clearTimers();
      this.error =
        error instanceof Error && error.message
          ? error.message
          : "Evaluation draft could not be saved. Your changes are still in this browser.";
      this.setStatus(this.online ? "error" : "offline");
      if (this.lifecycle === "draining") this.finishDispose();
    }
  }

  private finishDispose(): void {
    if (this.lifecycle !== "draining" || this.inFlight) return;

    this.lifecycle = "disposed";
    this.clearTimers();
    this.resolveSettleWaiters(false);
    const resolve = this.resolveDispose;
    this.resolveDispose = null;
    resolve?.();
  }

  private resolveSettleWaiters(ok: boolean): void {
    if (this.settleWaiters.length === 0) return;
    const waiters = this.settleWaiters;
    this.settleWaiters = [];
    for (const resolve of waiters) resolve(ok);
  }

  private notifySettled(): void {
    if (this.inFlight || this.settleWaiters.length === 0) return;

    if (!this.dirty && this.status !== "error" && this.status !== "offline") {
      this.resolveSettleWaiters(true);
      return;
    }

    if (this.status === "error" || this.status === "offline") {
      this.resolveSettleWaiters(false);
    }
  }

  private setStatus(status: EvaluationAutosaveStatus): void {
    this.status = status;
    if (this.lifecycle === "active") {
      this.emit();
    }
    this.notifySettled();
  }

  private emit(): void {
    this.onStateChange?.(this.getState());
  }
}
