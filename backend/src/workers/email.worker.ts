import { EmailRepository } from "../repositories/email.repository";
import {
  EmailService,
  getEmailDeliveryMode,
  registerEmailWorkerWakeHandler,
} from "../services/email.service";

export interface EmailWorkerHandle {
  stop: () => void;
  triggerNow: () => Promise<number>;
  isRunning: () => boolean;
}

const DEFAULT_POLL_INTERVAL_MS = 5_000;
const DEFAULT_BATCH_SIZE = 5;
const DEFAULT_CONCURRENCY = 2;
const STALE_LOCK_MINUTES = 5;

const emailRepository = new EmailRepository();
let activeWorkerRunning = false;

export function isEmailWorkerRunning(): boolean {
  return activeWorkerRunning;
}

/**
 * Drains one batch of due QUEUED emails from MySQL with bounded concurrency.
 * Exported directly so automated unit/integration tests can invoke a single
 * deterministic drain cycle without timers.
 */
export async function processDueEmailQueueBatch(
  batchSize = DEFAULT_BATCH_SIZE,
  concurrency = DEFAULT_CONCURRENCY,
): Promise<number> {
  const mode = getEmailDeliveryMode();
  if (mode === "disabled") {
    return 0;
  }

  const claimed = await emailRepository.claimNextDueLogs(batchSize);
  if (claimed.length === 0) {
    return 0;
  }

  let cursor = 0;
  const workerCount = Math.min(concurrency, claimed.length);

  const runSlot = async () => {
    while (cursor < claimed.length) {
      const idx = cursor++;
      const row = claimed[idx];
      try {
        if (mode === "dry_run") {
          await emailRepository.markSent(row.id);
        } else {
          await EmailService.sendRawSmtp({
            to: row.recipient,
            subject: row.subject,
            html: row.htmlBody || "",
            text: row.textBody,
          });
          await emailRepository.markSent(row.id);
        }
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : "Unknown SMTP delivery error";
        await emailRepository.scheduleRetryOrFail(
          row.id,
          row.attemptCount,
          row.maxAttempts,
          message,
        );
      }
    }
  };

  await Promise.all(Array.from({ length: workerCount }, () => runSlot()));
  return claimed.length;
}

/**
 * Starts the Pure MySQL Persistent Email Queue Worker.
 * - Recovers any stale PROCESSING rows left behind by a crash/restart.
 * - Wakes immediately when EmailService enqueues new rows.
 * - Sweeps every 5 seconds to pick up scheduled exponential retries.
 */
export function startEmailWorker(
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
): EmailWorkerHandle {
  let stopped = false;
  let draining = false;
  let drainRequestedAgain = false;

  const drainLoop = async (): Promise<number> => {
    if (stopped) return 0;
    if (draining) {
      drainRequestedAgain = true;
      return 0;
    }

    draining = true;
    let totalProcessed = 0;
    try {
      do {
        drainRequestedAgain = false;
        const processed = await processDueEmailQueueBatch();
        totalProcessed += processed;
        if (processed >= DEFAULT_BATCH_SIZE && !stopped) {
          drainRequestedAgain = true;
        }
      } while (drainRequestedAgain && !stopped);
    } catch (error: unknown) {
      console.error(
        "[EmailWorker] Queue drain error:",
        error instanceof Error ? error.message : error,
      );
    } finally {
      draining = false;
    }
    return totalProcessed;
  };

  activeWorkerRunning = true;
  registerEmailWorkerWakeHandler(() => {
    void drainLoop();
  });

  // Startup crash recovery, then initial drain
  void emailRepository
    .recoverStaleProcessingLogs(STALE_LOCK_MINUTES)
    .then((recovered) => {
      if (recovered > 0) {
        console.log(
          `[EmailWorker] Recovered ${recovered} interrupted email job(s) back to QUEUED.`,
        );
      }
      return drainLoop();
    })
    .catch((err: unknown) => {
      console.error(
        "[EmailWorker] Startup recovery error:",
        err instanceof Error ? err.message : err,
      );
    });

  const interval = setInterval(() => {
    void drainLoop();
  }, pollIntervalMs);

  // Also periodically recover stale locks every 5 minutes
  const recoveryInterval = setInterval(() => {
    if (!stopped) {
      void emailRepository
        .recoverStaleProcessingLogs(STALE_LOCK_MINUTES)
        .catch(() => {});
    }
  }, STALE_LOCK_MINUTES * 60_000);

  if (typeof interval.unref === "function") interval.unref();
  if (typeof recoveryInterval.unref === "function") recoveryInterval.unref();

  console.log(
    `[EmailWorker] MySQL Persistent Email Queue started (mode=${getEmailDeliveryMode()}).`,
  );

  return {
    stop() {
      stopped = true;
      activeWorkerRunning = false;
      registerEmailWorkerWakeHandler(null);
      clearInterval(interval);
      clearInterval(recoveryInterval);
    },
    triggerNow: drainLoop,
    isRunning: () => !stopped,
  };
}
