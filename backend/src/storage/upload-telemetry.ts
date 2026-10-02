/**
 * DL-11: process-local secure-upload pipeline telemetry.
 *
 * This is intentionally NOT persisted business audit data. It resets when the
 * backend process restarts (`scope = PROCESS_LOCAL_PIPELINE`). It records only
 * sanitized operational metadata: a timestamp, a coarse pipeline stage, and an
 * HTTP status class. It never records filenames, user identity, storage keys,
 * paths, checksums, multipart fields, or document contents.
 *
 * Telemetry is best-effort: recording must never throw or affect an upload.
 */

export const UPLOAD_FAILURE_STAGES = [
  "MULTIPART",
  "VALIDATION",
  "PROMOTION",
  "TEMP_STORAGE",
  "UNKNOWN",
] as const;

export type UploadFailureStage = (typeof UPLOAD_FAILURE_STAGES)[number];

export interface UploadFailureEvent {
  timestamp: string;
  stage: UploadFailureStage;
  statusClass: "4xx" | "5xx" | null;
}

export interface UploadTelemetrySnapshot {
  scope: "PROCESS_LOCAL_PIPELINE";
  startedAt: string;
  attempts: number;
  successes: number;
  failures: number;
  recentFailures: UploadFailureEvent[];
}

const DEFAULT_MAX_RECENT = 20;

function classifyStatus(statusCode?: number | null): "4xx" | "5xx" | null {
  if (typeof statusCode !== "number" || !Number.isFinite(statusCode)) {
    return null;
  }
  if (statusCode >= 400 && statusCode < 500) return "4xx";
  if (statusCode >= 500 && statusCode < 600) return "5xx";
  return null;
}

function normalizeStage(stage: string): UploadFailureStage {
  return (UPLOAD_FAILURE_STAGES as readonly string[]).includes(stage)
    ? (stage as UploadFailureStage)
    : "UNKNOWN";
}

export class UploadTelemetry {
  private readonly startedAt = new Date();
  private attempts = 0;
  private successes = 0;
  private failures = 0;
  private recentFailures: UploadFailureEvent[] = [];

  constructor(private readonly maxRecent: number = DEFAULT_MAX_RECENT) {}

  recordAttempt(): void {
    try {
      this.attempts += 1;
    } catch {
      // best-effort only
    }
  }

  recordSuccess(): void {
    try {
      this.successes += 1;
    } catch {
      // best-effort only
    }
  }

  recordFailure(stage: string, statusCode?: number | null): void {
    try {
      this.failures += 1;
      this.recentFailures.push({
        timestamp: new Date().toISOString(),
        stage: normalizeStage(stage),
        statusClass: classifyStatus(statusCode),
      });
      const overflow = this.recentFailures.length - this.maxRecent;
      if (overflow > 0) {
        this.recentFailures.splice(0, overflow);
      }
    } catch {
      // best-effort only
    }
  }

  snapshot(): UploadTelemetrySnapshot {
    return {
      scope: "PROCESS_LOCAL_PIPELINE",
      startedAt: this.startedAt.toISOString(),
      attempts: this.attempts,
      successes: this.successes,
      failures: this.failures,
      recentFailures: this.recentFailures.map((event) => ({ ...event })),
    };
  }
}

/** Application-wide process-local telemetry singleton. */
export const uploadTelemetry = new UploadTelemetry();
