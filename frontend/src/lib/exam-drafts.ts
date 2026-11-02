export type DraftValue =
  | { selectedOptionId: string | null }
  | { essayAnswer: string };
export type SavedDraft = DraftValue & { questionId: string; revision: number };
export type DraftStatus =
  | "loading"
  | "unsaved"
  | "saving"
  | "saved"
  | "error"
  | "conflict";
type DraftState = {
  values: Record<string, DraftValue>;
  status: DraftStatus;
  ready: boolean;
};
type Transport = {
  read: () => Promise<SavedDraft[]>;
  write: (
    value: DraftValue & { questionId: string; expectedRevision: number },
  ) => Promise<SavedDraft>;
};
const equal = (a: DraftValue | undefined, b: DraftValue | undefined) =>
  JSON.stringify(a) === JSON.stringify(b);

/** Mounted presentation state only. The server owns recovery and revisions. */
export class ExamDraftQueue {
  private state: DraftState = { values: {}, status: "loading", ready: false };
  private listeners = new Set<() => void>();
  private saved: Record<string, SavedDraft> = {};
  private dirty = new Map<string, number>();
  private timer?: ReturnType<typeof setTimeout>;
  private running?: Promise<boolean>;
  private syncing?: Promise<boolean>;
  private enabled = false;
  constructor(private transport: Transport) {}
  snapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private publish(
    status: DraftStatus,
    values = this.state.values,
    ready = this.state.ready,
  ) {
    this.state = { values, status, ready };
    this.listeners.forEach((listener) => listener());
  }
  pause() {
    this.enabled = false;
    clearTimeout(this.timer);
  }
  activate() {
    this.enabled = true;
    return this.resync();
  }
  change(questionId: string, value: DraftValue) {
    if (!this.enabled || !this.state.ready || this.state.status === "conflict")
      return;
    if (equal(this.state.values[questionId], value)) return;
    if (!this.dirty.has(questionId))
      this.dirty.set(questionId, performance.now());
    this.publish(this.state.status === "error" ? "error" : "unsaved", {
      ...this.state.values,
      [questionId]: value,
    });
    if (this.state.status !== "error")
      this.schedule("selectedOptionId" in value ? 100 : 600);
  }
  private schedule(debounce = 600) {
    clearTimeout(this.timer);
    if (
      !this.enabled ||
      !this.dirty.size ||
      ["error", "conflict"].includes(this.state.status)
    )
      return;
    const first = Math.min(...this.dirty.values());
    this.timer = setTimeout(
      () => {
        void this.flush();
      },
      Math.max(0, Math.min(debounce, first + 3000 - performance.now())),
    );
  }
  flush(): Promise<boolean> {
    clearTimeout(this.timer);
    if (this.syncing)
      return this.syncing.then((ok) => (ok ? this.flush() : false));
    if (this.running) return this.running;
    if (
      !this.enabled ||
      !this.state.ready ||
      ["error", "conflict"].includes(this.state.status)
    )
      return Promise.resolve(false);
    this.running = this.saveLoop().finally(() => {
      this.running = undefined;
    });
    return this.running;
  }
  private async saveLoop() {
    while (this.dirty.size && this.enabled) {
      const questionId = this.dirty.keys().next().value!;
      const value = this.state.values[questionId];
      this.publish("saving");
      try {
        const response = await this.transport.write({
          questionId,
          ...value,
          expectedRevision: this.saved[questionId]?.revision ?? 0,
        });
        this.saved[questionId] = response;
        // Never replace a newer local edit with an older network acknowledgment.
        if (equal(this.state.values[questionId], value))
          this.dirty.delete(questionId);
      } catch (error) {
        this.publish(
          (error as { statusCode?: number }).statusCode === 409
            ? "conflict"
            : "error",
        );
        return false;
      }
    }
    this.publish(this.dirty.size ? "unsaved" : "saved");
    return !this.dirty.size && this.enabled;
  }
  resync(discardLocal = false): Promise<boolean> {
    if (this.syncing) return this.syncing;
    clearTimeout(this.timer);
    this.syncing = this.readServer(discardLocal).finally(() => {
      this.syncing = undefined;
      this.schedule();
    });
    return this.syncing;
  }
  private async readServer(discardLocal: boolean) {
    if (this.running) await this.running;
    if (!this.enabled) return false;
    this.publish("saving");
    try {
      const rows = await this.transport.read();
      const latest = Object.fromEntries(
        rows.map((row) => [row.questionId, row]),
      );
      const values = { ...this.state.values };
      let conflict = false;
      for (const id of new Set([
        ...Object.keys(values),
        ...Object.keys(latest),
      ])) {
        const row = latest[id];
        const value: DraftValue | undefined = row
          ? "essayAnswer" in row
            ? { essayAnswer: row.essayAnswer }
            : { selectedOptionId: row.selectedOptionId }
          : undefined;
        if (
          !discardLocal &&
          this.dirty.has(id) &&
          (row?.revision ?? 0) !== (this.saved[id]?.revision ?? 0) &&
          !equal(value, values[id])
        ) {
          conflict = true;
          continue; // Keep visible local text until the Applicant chooses refresh.
        }
        if (discardLocal || !this.dirty.has(id) || equal(value, values[id])) {
          if (value) values[id] = value;
          else delete values[id];
          this.dirty.delete(id);
        }
        if (row) this.saved[id] = row;
        else delete this.saved[id];
      }
      if (discardLocal) this.dirty.clear();
      this.publish(
        conflict ? "conflict" : this.dirty.size ? "unsaved" : "saved",
        values,
        true,
      );
      return !conflict;
    } catch {
      this.publish("error");
      return false;
    }
  }
  /** Resolve authority, then drain before opening confirmation or sending submit. */
  async prepare() {
    if (this.state.status === "conflict") return false;
    if (!(await this.resync())) return false;
    return this.flush();
  }
}

export const draftStatusText: Record<DraftStatus, string> = {
  loading: "Loading saved answers…",
  unsaved: "Unsaved changes",
  saving: "Saving…",
  saved: "Saved",
  error: "Save failed. Your local edits are still here. Retry when connected.",
  conflict:
    "Answers changed elsewhere. Refresh saved answers to replace local edits.",
};
