/**
 * CDW-LIVE-1A — serialized Rapporteur report autosave pipeline.
 *
 * Framework-free so the durability rules can be verified in Node. The
 * authoritative write remains the existing REST PUT report draft with
 * `bodyVersion`/CAS. This controller only decides WHEN to call that save path and
 * how to serialize it; it never becomes an academic authority.
 */

import {
  normalizeReportDocument,
  type ReportDocument,
} from "./report-document.ts";

export type ReportAutosaveStatus =
  | "clean"
  | "dirty"
  | "saving"
  | "saved"
  | "error"
  | "conflict"
  | "offline";

export interface ReportAutosaveState {
  status: ReportAutosaveStatus;
  bodyVersion: number;
  hasUnsavedChanges: boolean;
  error: string | null;
  savedAt: number | null;
}

export interface ReportAutosaveSaveInput {
  body: ReportDocument;
  expectedBodyVersion: number;
}

export interface ReportAutosaveSaveResult {
  bodyVersion: number;
}

export class ReportAutosaveConflictError extends Error {
  constructor(message = "Save conflict. Refresh and reconcile the saved report.") {
    super(message);
    this.name = "ReportAutosaveConflictError";
  }
}

export interface ReportAutosaveControllerOptions {
  save: (input: ReportAutosaveSaveInput) => Promise<ReportAutosaveSaveResult>;
  initialBody: ReportDocument;
  initialBodyVersion: number;
  debounceMs?: number;
  maxWaitMs?: number;
  now?: () => number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
  onStateChange?: (state: ReportAutosaveState) => void;
}

const DEFAULT_DEBOUNCE_MS = 2000;
const DEFAULT_MAX_WAIT_MS = 10000;

function normalizeVersion(value: unknown): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : 0;
}

export class ReportAutosaveController {
  private readonly save: ReportAutosaveControllerOptions["save"];
  private readonly debounceMs: number;
  private readonly maxWaitMs: number;
  private readonly now: () => number;
  private readonly setTimer: (fn: () => void, ms: number) => unknown;
  private readonly clearTimer: (handle: unknown) => void;
  private readonly onStateChange?: (state: ReportAutosaveState) => void;

  private latestBody: ReportDocument;
  private latestKey: string;
  private savedKey: string;
  private savedVersion: number;

  private dirty = false;
  private inFlight = false;
  private conflict = false;
  private online = true;
  private disposed = false;
  private hasPersistedSave: boolean;

  private unsavedSince: number | null = null;
  private idleTimer: unknown = null;
  private maxTimer: unknown = null;

  private status: ReportAutosaveStatus = "clean";
  private error: string | null = null;
  private savedAt: number | null = null;

  constructor(options: ReportAutosaveControllerOptions) {
    this.save = options.save;
    this.debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS;
    this.maxWaitMs = options.maxWaitMs ?? DEFAULT_MAX_WAIT_MS;
    this.now = options.now ?? (() => Date.now());
    this.setTimer =
      options.setTimer ??
      ((fn, ms) => setTimeout(fn, ms) as unknown);
    this.clearTimer =
      options.clearTimer ??
      ((handle) => clearTimeout(handle as ReturnType<typeof setTimeout>));
    this.onStateChange = options.onStateChange;

    this.latestBody = normalizeReportDocument(options.initialBody);
    this.latestKey = JSON.stringify(this.latestBody);
    this.savedKey = this.latestKey;
    this.savedVersion = normalizeVersion(options.initialBodyVersion);
    this.hasPersistedSave = this.savedVersion > 0;

    this.emit();
  }

  getState(): ReportAutosaveState {
    return {
      status: this.status,
      bodyVersion: this.savedVersion,
      hasUnsavedChanges: this.hasUnsavedChanges(),
      error: this.error,
      savedAt: this.savedAt,
    };
  }

  getServerVersion(): number {
    return this.savedVersion;
  }

  hasUnsavedChanges(): boolean {
    return this.dirty || this.inFlight;
  }

  update(body: ReportDocument): void {
    if (this.disposed) return;

    const normalized = normalizeReportDocument(body);
    this.latestBody = normalized;
    this.latestKey = JSON.stringify(normalized);

    if (this.conflict) {
      this.dirty = this.latestKey !== this.savedKey;
      this.emit();
      return;
    }

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
   * Flush the newest body immediately. Used by the explicit Save now button and
   * by blur/visibility handlers. It never starts a competing request.
   */
  flushNow(): boolean {
    if (this.disposed || this.conflict) return false;
    if (this.inFlight) return false;
    if (!this.dirty) return true;

    this.clearTimers();
    void this.requestSave();
    return true;
  }

  setOnline(online: boolean): void {
    if (this.disposed || this.online === online) return;
    this.online = online;

    if (!online) {
      this.clearTimers();
      if (this.dirty) this.setStatus("offline");
      return;
    }

    if (this.dirty && !this.conflict && !this.inFlight) {
      this.clearTimers();
      void this.requestSave();
    }
  }

  /**
   * Adopt a newer authoritative version only while there is no local work that
   * could be silently overwritten.
   */
  syncServerVersion(version: number): void {
    if (this.disposed || this.inFlight || this.conflict) return;
    if (this.dirty) return;
    const next = normalizeVersion(version);
    if (next !== this.savedVersion) {
      this.savedVersion = next;
      this.emit();
    }
  }

  /**
   * Explicit user reconciliation after a conflict: discard local draft and load
   * the authoritative saved body/version. No automatic merge is attempted.
   */
  reloadFromServer(body: ReportDocument, bodyVersion: number): void {
    if (this.disposed) return;
    this.clearTimers();
    this.latestBody = normalizeReportDocument(body);
    this.latestKey = JSON.stringify(this.latestBody);
    this.savedKey = this.latestKey;
    this.savedVersion = normalizeVersion(bodyVersion);
    this.dirty = false;
    this.inFlight = false;
    this.conflict = false;
    this.error = null;
    this.unsavedSince = null;
    this.savedAt = this.savedVersion > 0 ? this.now() : null;
    this.hasPersistedSave = this.savedVersion > 0;
    this.setStatus(this.savedVersion > 0 ? "saved" : "clean");
  }

  dispose(): void {
    this.disposed = true;
    this.clearTimers();
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
    if (
      this.disposed ||
      this.inFlight ||
      this.conflict ||
      !this.dirty
    ) {
      return;
    }

    if (!this.online) {
      this.setStatus("offline");
      return;
    }

    this.clearTimers();

    const snapshotBody = this.latestBody;
    const snapshotKey = this.latestKey;
    const expectedBodyVersion = this.savedVersion;

    this.inFlight = true;
    this.setStatus("saving");

    try {
      const result = await this.save({
        body: snapshotBody,
        expectedBodyVersion,
      });

      if (this.disposed) return;

      this.inFlight = false;
      this.savedVersion = normalizeVersion(result.bodyVersion);
      this.savedKey = snapshotKey;
      this.savedAt = this.now();
      this.hasPersistedSave = true;
      this.error = null;

      if (this.latestKey !== snapshotKey) {
        this.dirty = true;
        if (!this.online) {
          this.setStatus("offline");
          return;
        }
        // The newest local text arrived while this request was in flight. Save it
        // immediately with the bodyVersion the server just returned.
        void this.requestSave();
        return;
      }

      this.dirty = false;
      this.unsavedSince = null;
      this.setStatus("saved");
    } catch (error) {
      if (this.disposed) return;

      this.inFlight = false;
      this.dirty = true;
      this.unsavedSince = this.now();
      this.clearTimers();

      if (error instanceof ReportAutosaveConflictError) {
        this.conflict = true;
        this.error = "Save conflict — refresh/reconcile required.";
        this.setStatus("conflict");
        return;
      }

      this.error =
        error instanceof Error && error.message
          ? error.message
          : "Save failed. Your changes are still in this browser.";
      this.setStatus(this.online ? "error" : "offline");
    }
  }

  private setStatus(status: ReportAutosaveStatus): void {
    this.status = status;
    this.emit();
  }

  private emit(): void {
    this.onStateChange?.(this.getState());
  }
}
