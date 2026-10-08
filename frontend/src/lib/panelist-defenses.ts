/**
 * UIUX-3B — My Defenses assignment-registry helpers (pure, presentation only).
 *
 * Derives labels, wall-clock formatting, filtering, ordering, and the one safely
 * gated contextual action from the existing authoritative panelist-assignment
 * read model. It does NOT create academic state, eligibility, or mutation
 * authority:
 *
 * - session status is the raw `DefenseSchedule.sessionStatus`;
 * - the evaluator action is offered only for Proposal/Final evaluator roles with
 *   a non-finalized own evaluation while the session is still editable;
 * - every other assignment uses a generic workspace/read-only action;
 * - Title Defense, Facilitator, Rapporteur, and Adviser never receive a numerical
 *   evaluation action.
 */
import type {
  PanelistAssignmentData,
  PanelistEvaluationStatus,
} from "@/types";

export const ALL = "ALL";

const NUMERICAL_DEFENSES = new Set(["PROPOSAL_DEFENSE", "FINAL_DEFENSE"]);
const EVALUATOR_ROLES = new Set(["CHAIRMAN", "PANELIST"]);
const EDITABLE_SESSION_STATUSES = new Set(["SCHEDULED", "IN_PROGRESS"]);

/* ------------------------------------------------------------------ labels */

export function defenseStageLabel(defenseType: string | undefined): string {
  switch (String(defenseType ?? "")) {
    case "TITLE_DEFENSE":
      return "Title";
    case "PROPOSAL_DEFENSE":
      return "Proposal";
    case "FINAL_DEFENSE":
      return "Final";
    default:
      return "Defense";
  }
}

export function sessionStatusLabel(status: string | undefined): string {
  switch (String(status ?? "")) {
    case "SCHEDULED":
      return "Scheduled";
    case "IN_PROGRESS":
      return "In progress";
    case "AWAITING_CONCLUSION":
      return "Awaiting formal conclusion";
    case "CONCLUDED":
      return "Concluded";
    case "CANCELLED":
      return "Cancelled";
    default:
      return String(status ?? "") || "Unknown";
  }
}

export function roleLabel(role: string | undefined): string {
  switch (String(role ?? "")) {
    case "CHAIRMAN":
      return "Chairman";
    case "PANELIST":
      return "Panelist";
    case "RAPPORTEUR":
      return "Rapporteur";
    case "FACILITATOR":
      return "Facilitator";
    case "ADVISER":
      return "Adviser";
    default:
      return String(role ?? "") || "Participant";
  }
}

export function evaluationStatusLabel(
  status: PanelistEvaluationStatus | undefined,
): string {
  switch (status) {
    case "NOT_STARTED":
      return "Not started";
    case "DRAFT":
      return "Draft saved";
    case "FINALIZED":
      return "Finalized";
    default:
      return "—";
  }
}

/* ------------------------------------------------------------------- dates */

/** ISO timestamp → stored wall-clock `YYYY-MM-DD`. */
export function isoToWallDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return match ? match[0] : null;
}

/** ISO timestamp → stored wall-clock `HH:mm[:ss]`. */
export function isoToWallTime(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const match = /T(\d{2}:\d{2}(?::\d{2})?)/.exec(iso);
  return match ? match[1] : null;
}

/** `YYYY-MM-DD` → readable date without UTC→local day shifting. */
export function formatWallDate(ymd: string | null | undefined): string {
  if (!ymd) return "—";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd);
  if (!match) return ymd;
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const monthIndex = Number(match[2]) - 1;
  return `${months[monthIndex] ?? match[2]} ${Number(match[3])}, ${match[1]}`;
}

/** `HH:mm[:ss]` → readable 12-hour time. */
export function formatWallTime(hms: string | null | undefined): string {
  if (!hms) return "—";
  const match = /^(\d{1,2}):(\d{2})/.exec(hms);
  if (!match) return hms;
  const hour = Number(match[1]);
  const ampm = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${match[2]} ${ampm}`;
}

/** Timezone-neutral epoch for ordering/upcoming comparison; null when invalid. */
export function wallDateTimeMs(
  dateYmd: string | null,
  timeHms: string | null,
): number | null {
  if (!dateYmd || !timeHms) return null;
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateYmd);
  const timeMatch = /^(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(timeHms);
  if (!dateMatch || !timeMatch) return null;
  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  const second = Number(timeMatch[3] ?? 0);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  if (hour > 23 || minute > 59 || second > 59) return null;
  return Date.UTC(year, month - 1, day, hour, minute, second);
}

/** Server-local "now" in the same wall-clock frame as wallDateTimeMs. */
export function nowWallMs(now: Date = new Date()): number {
  return Date.UTC(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    now.getHours(),
    now.getMinutes(),
    now.getSeconds(),
  );
}

/* -------------------------------------------------------------- assignment */

function assignmentMs(a: PanelistAssignmentData): number | null {
  return wallDateTimeMs(
    isoToWallDate(a.schedule?.defenseDate),
    isoToWallTime(a.schedule?.defenseTime),
  );
}

/** A `SCHEDULED` session whose wall-clock start is at/after "now". */
export function isUpcomingAssignment(
  a: PanelistAssignmentData,
  nowMs: number,
): boolean {
  if (String(a.schedule?.sessionStatus ?? "") !== "SCHEDULED") return false;
  const ms = assignmentMs(a);
  return ms !== null && ms >= nowMs;
}

/** Only Proposal/Final evaluator roles carry numerical evaluation status. */
export function isEvaluationRelevant(a: PanelistAssignmentData): boolean {
  return (
    EVALUATOR_ROLES.has(String(a.role)) &&
    NUMERICAL_DEFENSES.has(String(a.schedule?.defenseType))
  );
}

/** Evaluator action is offered only while the session is still editable. */
export function isEvaluationActionEligible(
  a: PanelistAssignmentData,
): boolean {
  if (!isEvaluationRelevant(a)) return false;
  if (!EDITABLE_SESSION_STATUSES.has(String(a.schedule?.sessionStatus))) {
    return false;
  }
  return a.evaluationStatus === "NOT_STARTED" || a.evaluationStatus === "DRAFT";
}

export type AssignmentActionKind = "workspace" | "none";

export interface AssignmentAction {
  label: string;
  kind: AssignmentActionKind;
}

/**
 * One honest primary action per assignment. Cancelled sessions expose no
 * workspace action; concluded sessions are read-only ("View Defense"); an
 * eligible evaluator gets "Continue Evaluation"; everything else opens the
 * canonical Defense Workspace generically.
 */
export function assignmentAction(a: PanelistAssignmentData): AssignmentAction {
  const status = String(a.schedule?.sessionStatus ?? "");
  if (status === "CANCELLED") return { label: "Cancelled", kind: "none" };
  if (isEvaluationActionEligible(a)) {
    return { label: "Continue Evaluation", kind: "workspace" };
  }
  if (status === "CONCLUDED") {
    return { label: "View Defense", kind: "workspace" };
  }
  return { label: "Open Defense", kind: "workspace" };
}

/** Role + (only when authoritative) personal evaluation status, kept separate. */
export function responsibilityText(a: PanelistAssignmentData): string {
  const role = roleLabel(a.role);
  if (!isEvaluationRelevant(a)) return role;
  return `${role} · Evaluation: ${evaluationStatusLabel(a.evaluationStatus)}`;
}

/* ------------------------------------------------------- ordering/filtering */

const SESSION_GROUP: Record<string, number> = {
  IN_PROGRESS: 0,
  AWAITING_CONCLUSION: 1,
};

function groupRank(a: PanelistAssignmentData, nowMs: number): number {
  const status = String(a.schedule?.sessionStatus ?? "");
  if (status in SESSION_GROUP) return SESSION_GROUP[status];
  if (status === "SCHEDULED") return isUpcomingAssignment(a, nowMs) ? 2 : 3;
  if (status === "CONCLUDED") return 4;
  if (status === "CANCELLED") return 5;
  return 6;
}

/**
 * Active first, then awaiting conclusion, then upcoming scheduled (soonest
 * first), past scheduled, then concluded (most recent first) and cancelled.
 * Deterministic fallback on schedule id.
 */
export function compareAssignments(
  a: PanelistAssignmentData,
  b: PanelistAssignmentData,
  nowMs: number,
): number {
  const rankA = groupRank(a, nowMs);
  const rankB = groupRank(b, nowMs);
  if (rankA !== rankB) return rankA - rankB;

  const msA = assignmentMs(a);
  const msB = assignmentMs(b);
  const descending = rankA >= 4;
  if (msA !== null && msB !== null && msA !== msB) {
    return descending ? msB - msA : msA - msB;
  }
  if (msA === null && msB !== null) return 1;
  if (msA !== null && msB === null) return -1;

  const idA = String(a.schedule?.id ?? a.id);
  const idB = String(b.schedule?.id ?? b.id);
  return idA < idB ? -1 : idA > idB ? 1 : 0;
}

export type SessionFilter = string; // ALL | UPCOMING | <raw sessionStatus>

export interface AssignmentFilters {
  search: string;
  stage: string; // ALL | TITLE_DEFENSE | PROPOSAL_DEFENSE | FINAL_DEFENSE
  session: SessionFilter;
}

export function filterAssignments(
  assignments: PanelistAssignmentData[],
  filters: AssignmentFilters,
  nowMs: number,
): PanelistAssignmentData[] {
  const term = filters.search.trim().toLowerCase();

  return assignments
    .filter((a) => {
      const schedule = a.schedule;
      if (!schedule) return false;

      if (filters.stage !== ALL) {
        if (String(schedule.defenseType) !== filters.stage) return false;
      }

      if (filters.session !== ALL) {
        if (filters.session === "UPCOMING") {
          if (!isUpcomingAssignment(a, nowMs)) return false;
        } else if (String(schedule.sessionStatus) !== filters.session) {
          return false;
        }
      }

      if (term) {
        const haystack = [
          schedule.thesis?.student?.user?.firstName,
          schedule.thesis?.student?.user?.lastName,
          schedule.thesis?.student?.studentNumber,
          schedule.thesis?.student?.program?.programName,
          defenseStageLabel(schedule.defenseType),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(term)) return false;
      }

      return true;
    })
    .sort((a, b) => compareAssignments(a, b, nowMs));
}
