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
  | "PASSED"
  | "FAILED"
  | "APPEAL_PENDING"
  | "DISQUALIFIED"
  | "UNKNOWN";

export type ExamStateFilter = "ALL" | Exclude<ExamStateKey, "UNKNOWN">;

export function deriveExamState(status: string): ExamStateKey {
  switch (status) {
    case "PENDING":
    case "APPROVED":
      return "SCHEDULED";
    case "TAKEN":
      return "NEEDS_GRADING";
    case "PASSED":
      return "PASSED";
    case "FAILED":
      return "FAILED";
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
  PASSED: "Passed",
  FAILED: "Failed",
  APPEAL_PENDING: "Appeal Pending",
  DISQUALIFIED: "Disqualified",
  UNKNOWN: "Unknown",
};

/** Border-first, text-carrying badge classes. Color is never the only signal. */
export const EXAM_STATE_BADGE_CLASS: Record<ExamStateKey, string> = {
  SCHEDULED: "text-(--earist-secondary)",
  NEEDS_GRADING: "text-(--earist-warning)",
  PASSED: "text-(--earist-success)",
  FAILED: "text-destructive",
  APPEAL_PENDING: "text-(--earist-warning)",
  DISQUALIFIED: "text-(--earist-body-text)",
  UNKNOWN: "text-(--earist-body-text)",
};

export const EXAM_STATE_DESCRIPTION: Record<ExamStateKey, string> = {
  SCHEDULED: "The applicant is scheduled to take the entrance examination.",
  NEEDS_GRADING:
    "The examination has been submitted. The essay response requires Admin grading.",
  PASSED:
    "The entrance examination result is complete and recorded as Passed.",
  FAILED:
    "The entrance examination result is complete and recorded as Failed.",
  APPEAL_PENDING:
    "A missed-exam appeal is pending. Appeal actions are not available on this page yet.",
  DISQUALIFIED: "This entrance exam record is disqualified.",
  UNKNOWN:
    "The current exam state could not be determined from a supported authoritative status.",
};

export const EXAM_STATE_FILTERS: { value: ExamStateFilter; label: string }[] = [
  { value: "ALL", label: "All States" },
  { value: "SCHEDULED", label: "Scheduled" },
  { value: "NEEDS_GRADING", label: "Needs Essay Grading" },
  { value: "PASSED", label: "Passed" },
  { value: "FAILED", label: "Failed" },
  { value: "APPEAL_PENDING", label: "Appeal Pending" },
  { value: "DISQUALIFIED", label: "Disqualified" },
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
