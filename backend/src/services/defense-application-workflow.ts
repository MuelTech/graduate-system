import type { DefenseStage } from "../interfaces/defense-eligibility.interfaces";
import {
  STAGE_DEFENSE_TYPE,
  type ScheduleForPick,
} from "./defense-application-session";

/**
 * Admin Defense Applications workflow buckets.
 * Application review state != defense session state != academic outcome.
 */
export type ApplicationWorkflowBucket =
  | "NEEDS_REVIEW"
  | "READY"
  | "ACTIVE"
  | "HISTORY";

export const ACTIVE_SESSION_STATUSES = [
  "SCHEDULED",
  "RESCHEDULED",
  "IN_PROGRESS",
  "AWAITING_CONCLUSION",
] as const;

export function isActiveSessionStatus(status?: string | null): boolean {
  const v = String(status ?? "").toUpperCase();
  return (ACTIVE_SESSION_STATUSES as readonly string[]).includes(v);
}

export function isConcludedSessionStatus(status?: string | null): boolean {
  return String(status ?? "").toUpperCase() === "CONCLUDED";
}

function sortLatestFirst<T extends ScheduleForPick>(schedules: T[]): T[] {
  return [...schedules].sort((a, b) => {
    const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return tb - ta;
  });
}

/**
 * Live (non-concluded, non-cancelled) schedule for the CURRENT stage only.
 * Prior-stage concluded sessions must never look like a current-stage booking.
 */
export function pickActiveCurrentStageSchedule<T extends ScheduleForPick>(
  stage: DefenseStage | null | undefined,
  schedules: T[] | null | undefined,
): T | null {
  if (!stage || !schedules?.length) return null;
  const wanted = STAGE_DEFENSE_TYPE[stage];
  const matches = schedules.filter(
    (s) =>
      s.defenseType === wanted &&
      s.sessionStatus !== "CANCELLED" &&
      isActiveSessionStatus(s.sessionStatus),
  );
  if (!matches.length) return null;
  return sortLatestFirst(matches)[0];
}

export function hasActiveCurrentStageSchedule(
  stage: DefenseStage | null | undefined,
  schedules: ScheduleForPick[] | null | undefined,
): boolean {
  return pickActiveCurrentStageSchedule(stage, schedules) !== null;
}

/**
 * True only when the CURRENT stage's defense session is concluded.
 * Prior-stage conclusions (Title while on Proposal, etc.) must NOT lock review.
 */
export function hasCurrentStageConclusion(
  stage: DefenseStage | null | undefined,
  schedules: ScheduleForPick[] | null | undefined,
): boolean {
  if (!stage || !schedules?.length) return false;
  const wanted = STAGE_DEFENSE_TYPE[stage];
  return schedules.some(
    (s) =>
      s.defenseType === wanted &&
      s.sessionStatus !== "CANCELLED" &&
      isConcludedSessionStatus(s.sessionStatus),
  );
}

/**
 * Any non-cancelled schedule for this defense type (current stage or re-defense).
 * Used to reject a second scheduling attempt — rescheduling is out of scope.
 */
export function findBlockingScheduleForScheduling<T extends ScheduleForPick>(
  defenseType: string,
  schedules: T[] | null | undefined,
): T | null {
  const wanted = String(defenseType || "").toUpperCase();
  const matches = (schedules ?? []).filter(
    (s) =>
      String(s.defenseType).toUpperCase() === wanted &&
      s.sessionStatus !== "CANCELLED",
  );
  if (!matches.length) return null;
  return sortLatestFirst(matches)[0];
}

export function canCreateDefenseSchedule(input: {
  defenseType: string;
  schedules: ScheduleForPick[] | null | undefined;
}): { allowed: boolean; reason?: string } {
  const blocking = findBlockingScheduleForScheduling(
    input.defenseType,
    input.schedules,
  );
  if (blocking) {
    const label = String(input.defenseType)
      .toLowerCase()
      .replace(/_/g, " ");
    return {
      allowed: false,
      reason: `A non-cancelled ${label} schedule already exists for this research project. Rescheduling is not available yet.`,
    };
  }
  return { allowed: true };
}

/**
 * Derive the admin workflow bucket from domain state — never from
 * ThesisRecord.status alone. Prior-stage concluded schedules are ignored
 * when evaluating the CURRENT stage.
 */
export function deriveApplicationWorkflowBucket(input: {
  applicationStatus: string;
  stage: DefenseStage | null | undefined;
  schedules: ScheduleForPick[] | null | undefined;
}): ApplicationWorkflowBucket {
  const status = String(input.applicationStatus || "").toUpperCase();
  const stage = input.stage;
  const schedules = input.schedules ?? [];

  // A live current-stage session is always Scheduled / Active.
  if (hasActiveCurrentStageSchedule(stage, schedules)) {
    return "ACTIVE";
  }

  if (status === "REJECTED") {
    return "HISTORY";
  }

  // Concluded current-stage session (or legacy outcome statuses) → History.
  if (stage) {
    const wanted = STAGE_DEFENSE_TYPE[stage];
    const concluded = schedules.some(
      (s) =>
        s.defenseType === wanted &&
        s.sessionStatus !== "CANCELLED" &&
        isConcludedSessionStatus(s.sessionStatus),
    );
    if (concluded) return "HISTORY";
  }
  if (status === "PASSED" || status === "FAILED" || status === "REVISION") {
    return "HISTORY";
  }

  if (status === "PENDING") {
    return "NEEDS_REVIEW";
  }

  // APPROVED (or legacy SCHEDULED with no live current-stage session).
  // Prior-stage CONCLUDED schedules do NOT block Ready for Scheduling.
  return "READY";
}

/** Assign Panel & Schedule is only valid for Ready. */
export function canShowAssignSchedule(
  bucket: ApplicationWorkflowBucket,
): boolean {
  return bucket === "READY";
}

/** Session/committee panel for the current stage. */
export function canShowCurrentSessionPanel(
  bucket: ApplicationWorkflowBucket,
  hasSchedule: boolean,
): boolean {
  if (!hasSchedule) return false;
  return bucket === "ACTIVE" || bucket === "HISTORY";
}

/**
 * Concluded defenses remain History after ThesisRecord.stage advances.
 * History must be sourced from DefenseConclusion / concluded schedules
 * (any defenseType), never only from mutable ThesisRecord.status.
 */
export function isHistoricalDefenseRecord(input: {
  sessionStatus?: string | null;
  hasConclusion?: boolean;
}): boolean {
  return (
    Boolean(input.hasConclusion) || isConcludedSessionStatus(input.sessionStatus)
  );
}

/**
 * Canonical display status for cards/filters — derived from workflow bucket,
 * not the overloaded ThesisRecord.status alone.
 */
export function resolveDisplayStatus(input: {
  workflowBucket: ApplicationWorkflowBucket;
  applicationStatus?: string | null;
  outcome?: string | null;
}): string {
  const appStatus = String(input.applicationStatus || "").toUpperCase();
  const outcome = String(input.outcome || "").toUpperCase();

  switch (input.workflowBucket) {
    case "NEEDS_REVIEW":
      return "PENDING";
    case "READY":
      return "APPROVED";
    case "ACTIVE":
      return "SCHEDULED";
    case "HISTORY":
      if (appStatus === "REJECTED") return "REJECTED";
      if (outcome === "REVISION_REQUIRED" || appStatus === "REVISION") {
        return "REVISION";
      }
      if (outcome === "FAILED" || appStatus === "FAILED") return "FAILED";
      if (outcome === "PASSED" || appStatus === "PASSED") return "PASSED";
      return appStatus || "REJECTED";
    default:
      return appStatus || "PENDING";
  }
}

/** Optional status refine (AND with bucket). Empty/ALL means no refine. */
export function matchesStatusRefine(
  displayStatus: string,
  statusRefine?: string | null,
): boolean {
  const s = String(statusRefine || "").toUpperCase();
  if (!s || s === "ALL") return true;
  return displayStatus.toUpperCase() === s;
}

type DocForScope = {
  id?: string;
  defenseStage?: string | null;
  docType?: string;
};

/**
 * Stage-scoped requirement evidence. Prior-stage uploads must not inflate
 * the current application's requirement list/count.
 */
export function filterDocumentsForStage(
  docs: DocForScope[] | null | undefined,
  stage: DefenseStage | string | null | undefined,
): DocForScope[] {
  const wanted = String(stage || "").toUpperCase();
  return (docs ?? []).filter(
    (d) => String(d.defenseStage || "").toUpperCase() === wanted,
  );
}
