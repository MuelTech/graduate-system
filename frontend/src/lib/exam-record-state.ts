/**
 * Exam-record presentation helpers shared by the Exam Records list and the
 * Exam Record detail page.
 *
 * Presentation-only projection of the authoritative `ExamAppStatus` enum.
 * Nothing here is persisted and no new domain state is introduced.
 */

export type ExamStateKey =
  | "SCHEDULED"
  | "NEEDS_GRADING"
  | "FINAL_RESULT_PENDING"
  | "PASSED"
  | "FAILED"
  | "APPEAL_PENDING"
  | "DISQUALIFIED"
  | "MISSED"
  | "RESCHEDULED"
  | "CANCELLED"
  | "PASSED_RECONSIDERED"
  | "UNKNOWN";

export type ExamStateFilter = "ALL" | Exclude<ExamStateKey, "UNKNOWN">;

export function deriveExamState(status: string, essayEvaluationCompleted = false, reconsidered = false): ExamStateKey {
  if (status === "FAILED" && reconsidered) return "PASSED_RECONSIDERED";
  switch (status) {
    case "PENDING":
    case "APPROVED":
      return "SCHEDULED";
    case "TAKEN":
      return essayEvaluationCompleted ? "FINAL_RESULT_PENDING" : "NEEDS_GRADING";
    case "PASSED":
      return "PASSED";
    case "FAILED":
      return "FAILED";
    case "MISSED": return "MISSED";
    case "RESCHEDULED": return "RESCHEDULED";
    case "CANCELLED": return "CANCELLED";
    case "APPEALED":
      return "APPEAL_PENDING";
    case "DISQUALIFIED":
      return "DISQUALIFIED";
    default:
      return "UNKNOWN";
  }
}

export const EXAM_STATE_LABEL: Record<ExamStateKey, string> = {
  SCHEDULED: "Scheduled",
  NEEDS_GRADING: "Needs Essay Grading",
  FINAL_RESULT_PENDING: "Essay Evaluated — Final Result Pending",
  PASSED: "Passed",
  FAILED: "Failed",
  APPEAL_PENDING: "Appeal Pending",
  DISQUALIFIED: "Disqualified",
  MISSED: "Missed", RESCHEDULED: "Rescheduled", CANCELLED: "Cancelled", PASSED_RECONSIDERED: "PASSED — RECONSIDERED",
  UNKNOWN: "Unknown",
};

/** Border-first, text-carrying badge classes. Color is never the only signal. */
export const EXAM_STATE_BADGE_CLASS: Record<ExamStateKey, string> = {
  SCHEDULED: "text-(--earist-secondary)",
  NEEDS_GRADING: "text-(--earist-warning)",
  FINAL_RESULT_PENDING: "text-(--earist-secondary)",
  PASSED: "text-(--earist-success)",
  FAILED: "text-destructive",
  APPEAL_PENDING: "text-(--earist-warning)",
  DISQUALIFIED: "text-(--earist-body-text)",
  MISSED: "text-(--earist-warning)", RESCHEDULED: "text-(--earist-body-text)", CANCELLED: "text-(--earist-body-text)", PASSED_RECONSIDERED: "text-(--earist-success)",
  UNKNOWN: "text-(--earist-body-text)",
};

export const EXAM_STATE_DESCRIPTION: Record<ExamStateKey, string> = {
  SCHEDULED: "The applicant is scheduled to take the entrance examination.",
  FINAL_RESULT_PENDING: "The essay evaluation is recorded. The final examination result is pending.",
  NEEDS_GRADING:
    "The examination has been submitted. The essay response requires Admin grading.",
  PASSED:
    "The entrance examination result is complete and recorded as Passed.",
  FAILED:
    "The entrance examination result is complete and recorded as Failed.",
  APPEAL_PENDING:
    "A missed-exam appeal is pending an Admin decision.",
  DISQUALIFIED: "This entrance exam record is disqualified.",
  MISSED: "The missed-exam appeal was rejected. No replacement appointment is authorized.",
  RESCHEDULED: "The original appointment is preserved. A separate replacement appointment is recorded.",
  CANCELLED: "This never-started appointment was cancelled and its seat released.",
  PASSED_RECONSIDERED: "The computed FAILED result is preserved. A separate institutional pass decision is recorded.",
  UNKNOWN:
    "The current exam state could not be determined from a supported authoritative status.",
};

export const EXAM_STATE_FILTERS: { value: ExamStateFilter; label: string }[] = [
  { value: "ALL", label: "All States" },
  { value: "SCHEDULED", label: "Scheduled" },
  { value: "NEEDS_GRADING", label: "Needs Essay Grading" },
  { value: "FINAL_RESULT_PENDING", label: "Final Result Pending" },
  { value: "PASSED", label: "Passed" },
  { value: "FAILED", label: "Failed" },
  { value: "APPEAL_PENDING", label: "Appeal Pending" },
  { value: "DISQUALIFIED", label: "Disqualified" },
  { value: "MISSED", label: "Missed" },
  { value: "RESCHEDULED", label: "Rescheduled" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "PASSED_RECONSIDERED", label: "Passed — Reconsidered" },
];

const MISSING = "—";

/** Parse a wall-clock ISO date without a UTC->local day shift. */
export function formatExamDate(iso: string | null | undefined): string {
  if (!iso) return MISSING;
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return MISSING;
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatExamTime(iso: string | null | undefined): string {
  if (!iso) return MISSING;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return MISSING;
  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}
