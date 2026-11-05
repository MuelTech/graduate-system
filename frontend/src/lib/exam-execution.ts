export interface ExamFinalizationReceipt {
  receiptId: string;
  applicationId: string;
  finalizedAt: string;
  finalizationReason: "APPLICANT_SUBMITTED" | "TIME_EXPIRED";
  actualStartedAt: string;
  deadlineAt: string;
  contentRevisionId: string;
  answeredCount: number;
  unansweredCount: number;
  questionCount: number;
}

export interface ExamExecution {
  applicationId: string;
  applicationStatus: string;
  state:
    | "READY"
    | "BLOCKED"
    | "ACTIVE"
    | "EXPIRED"
    | "TERMINAL"
    | "LEGACY_UNBOUND";
  reason: string | null;
  canStart: boolean;
  canAuthorize?: boolean;
  serverNow: string;
  actualStartedAt: string | null;
  deadlineAt: string | null;
  remainingSeconds: number;
  durationMinutes: number | null;
  contentRevisionId: string | null;
  finalization?: ExamFinalizationReceipt | null;
  authorization: null | {
    authorizedAt: string;
    authorizedBy: null | { id: string; firstName: string; lastName: string };
  };
  appointment: { examDate: string; examTime: string; programName: string };
}

export interface ExecutionClock {
  execution: ExamExecution;
  receivedAt: number;
}
/** Monotonic elapsed time: changing the device's wall clock cannot extend time. */
export function executionSeconds(
  clock: ExecutionClock,
  monotonicNow: number,
): number {
  if (clock.execution.state !== "ACTIVE" || !clock.execution.deadlineAt)
    return 0;
  const budget =
    Date.parse(clock.execution.deadlineAt) -
    Date.parse(clock.execution.serverNow);
  if (!Number.isFinite(budget)) return 0;
  return Math.max(
    0,
    Math.ceil((budget - Math.max(0, monotonicNow - clock.receivedAt)) / 1000),
  );
}

export function executionPath(applicationId: string, action: string) {
  return `/exam-engine/applications/${encodeURIComponent(applicationId)}/${action}`;
}

export function examinationTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
