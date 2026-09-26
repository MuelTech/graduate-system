/**
 * Shared Student Thesis Journey query identity + canonical route map (WP7).
 *
 * Later packages (WP8–WP12) should invalidate with:
 *   queryClient.invalidateQueries({ queryKey: studentThesisJourneyQueryKey })
 */
import type {
  DefenseSessionSummary,
  DefenseSubstatus,
  JourneyStepKey,
  JourneyStepView,
  StudentThesisJourney,
} from "@/types/student-thesis-journey";

export const studentThesisJourneyQueryKey = [
  "student",
  "thesis",
  "journey",
] as const;

export const JOURNEY_STEP_ROUTES: Record<JourneyStepKey, string> = {
  TITLE_DEFENSE: "/student/thesis/title-defense",
  ADVISER_REQUEST: "/student/thesis/adviser-request",
  PROPOSAL_DEFENSE: "/student/thesis/proposal-defense",
  STRIKE: "/student/thesis/strike",
  FINAL_DEFENSE: "/student/thesis/final-defense",
};

export const JOURNEY_STEP_ORDER: JourneyStepKey[] = [
  "TITLE_DEFENSE",
  "ADVISER_REQUEST",
  "PROPOSAL_DEFENSE",
  "STRIKE",
  "FINAL_DEFENSE",
];

/** User-facing labels — never render raw enum keys. */
export const JOURNEY_STEP_LABELS: Record<JourneyStepKey, string> = {
  TITLE_DEFENSE: "Title Defense",
  ADVISER_REQUEST: "Adviser Request",
  PROPOSAL_DEFENSE: "Proposal Defense",
  STRIKE: "STRIKE / Plagiarism",
  FINAL_DEFENSE: "Final Defense",
};

export function journeyLabelFor(
  key: JourneyStepKey,
  backendLabel?: string | null,
): string {
  return backendLabel?.trim() || JOURNEY_STEP_LABELS[key];
}

export function journeyRouteFor(key: JourneyStepKey): string {
  return JOURNEY_STEP_ROUTES[key];
}

export function journeyStepFor(
  journey: StudentThesisJourney | undefined,
  key: JourneyStepKey,
): JourneyStepView | undefined {
  return journey?.steps.find((s) => s.key === key);
}

/** User-facing heading for a defense administrative/session substatus. */
export function defenseStatusHeading(
  status: DefenseSubstatus | null | undefined,
  fallback = "Application status",
): string {
  switch (status) {
    case "NOT_SUBMITTED":
      return "Ready to submit";
    case "APPLICATION_UNDER_REVIEW":
      return "Application submitted";
    case "APPROVED_WAITING_SCHEDULE":
      return "Application approved";
    case "SCHEDULED":
      return "Defense scheduled";
    case "DEFENSE_IN_PROGRESS":
      return "Defense in progress";
    case "AWAITING_CONCLUSION":
      return "Awaiting official result";
    case "FINALIZING_RECORDS":
      return "Finalizing defense records";
    case "COMPLETED":
      return "Defense completed";
    case "FAILED":
      return "Defense result: Failed";
    case "REVISION_REQUIRED":
      return "Revision required";
    case "REJECTED":
      return "Application returned";
    case "CANCELLED_SESSION":
      return "Defense session cancelled";
    default:
      return fallback;
  }
}

/** Secondary status line under the heading. */
export function defenseStatusDescription(
  status: DefenseSubstatus | null | undefined,
  kind: "Title" | "Proposal" | "Final",
  fallback?: string | null,
): string {
  switch (status) {
    case "APPLICATION_UNDER_REVIEW":
      return `Your ${kind} Defense application has been submitted and is under Admin review.`;
    case "APPROVED_WAITING_SCHEDULE":
      return `Your ${kind} Defense application is approved. Waiting for the defense schedule.`;
    case "SCHEDULED":
      return `Your ${kind} Defense is scheduled. See the schedule details below.`;
    case "DEFENSE_IN_PROGRESS":
      return `Your ${kind} Defense session is currently in progress.`;
    case "AWAITING_CONCLUSION":
      return `The ${kind} Defense session has finished deliberation. The official result is not yet available.`;
    case "FINALIZING_RECORDS":
      return `Formal result: Passed. Required RAP/signatures are still being finalized before the next step unlocks.`;
    case "COMPLETED":
      return `${kind} Defense is complete.`;
    case "FAILED":
      return `The formal ${kind} Defense result has been recorded as Failed. Contact / await instructions from the Graduate School regarding the next required action.`;
    case "REVISION_REQUIRED":
      return `Revision required. Follow the Graduate School / panel instructions for required revisions.`;
    case "REJECTED":
      return `Your ${kind} Defense application was returned. Review the feedback and resubmit.`;
    case "CANCELLED_SESSION":
      return `Your ${kind} Defense session was cancelled. Await rescheduling or further instructions.`;
    default:
      return fallback || `Await ${kind} Defense updates.`;
  }
}

/** User-friendly session status label (never raw enum keys). */
export function sessionStatusLabel(sessionStatus: string | null | undefined): string {
  switch (sessionStatus) {
    case "UNSCHEDULED":
      return "Not scheduled";
    case "SCHEDULED":
      return "Scheduled";
    case "IN_PROGRESS":
      return "In progress";
    case "AWAITING_CONCLUSION":
      return "Awaiting conclusion";
    case "CONCLUDED":
      return "Concluded";
    case "CANCELLED":
      return "Cancelled";
    default:
      return sessionStatus ? "Updated" : "—";
  }
}

/**
 * Format wall-clock defense date without browser timezone conversion.
 * Accepts `YYYY-MM-DD` or ISO; uses UTC/calendar components only.
 */
export function formatDefenseDate(value: string | null | undefined): string {
  if (!value) return "—";
  const ymd = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value).trim());
  if (ymd) {
    return new Date(Date.UTC(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]))).toLocaleDateString(
      "en-US",
      { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" },
    );
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Format wall-clock defense time without browser timezone conversion.
 * Accepts `HH:mm[:ss]` or ISO instant carrying wall-clock in UTC components.
 */
export function formatDefenseTime(value: string | null | undefined): string {
  if (!value) return "—";
  const hms = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(String(value).trim());
  if (hms) {
    const h = Number(hms[1]);
    const min = hms[2];
    if (h > 23) return "—";
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${min} ${ampm}`;
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "UTC",
  });
}

const ACTIVE_DEFENSE_STATUSES: ReadonlySet<string> = new Set([
  "APPLICATION_UNDER_REVIEW",
  "APPROVED_WAITING_SCHEDULE",
  "SCHEDULED",
  "DEFENSE_IN_PROGRESS",
  "AWAITING_CONCLUSION",
  "FINALIZING_RECORDS",
]);

const TERMINAL_DEFENSE_STATUSES: ReadonlySet<string> = new Set([
  "FAILED",
  "REVISION_REQUIRED",
  "COMPLETED",
  "REJECTED",
  "CANCELLED_SESSION",
]);

/**
 * Poll only while an external action is expected to change Student-visible status.
 * Terminal FAILED / REVISION_REQUIRED / COMPLETED / REJECTED / CANCELLED do not poll
 * just because the coarse Journey state is WAITING.
 */
export function shouldPollJourney(journey: StudentThesisJourney | undefined): boolean {
  if (!journey) return true;
  return journey.steps.some((s) => {
    const st = s.defenseStatus;
    if (st && TERMINAL_DEFENSE_STATUSES.has(st)) return false;
    if (st && ACTIVE_DEFENSE_STATUSES.has(st)) return true;
    // Non-defense WAITING (e.g. adviser request) may still need polling.
    return s.state === "WAITING";
  });
}

export type { DefenseSessionSummary, DefenseSubstatus };

/** Completed journey destination (Final remains viewable). */
export const JOURNEY_COMPLETED_ROUTE = "/student/thesis/final-defense";
