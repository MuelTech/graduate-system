/**
 * UIUX-3A / UIUX-3E — Panelist dashboard read-model contract and dynamic
 * account-scoped projection helpers.
 *
 * Mirrors backend `GET /thesis/defense/panelist/dashboard` (PanelistDashboardView).
 * The backend owns eligibility/labels; this module only transports the DTO,
 * formats wall-clock date/time values without timezone shifts, and projects
 * dashboard sections from the authenticated account's FacultyWork relevance.
 */

import type { FacultyWork } from "./faculty-access";

export type PanelistAttentionCategory =
  | "EVALUATION"
  | "CHAIRMAN_CONCLUSION"
  | "RAPPORTEUR_FINALIZE"
  | "TITLE_START"
  | "RAP_SIGNATURE"
  | "ADVISER_REQUEST"
  | "ADVISER_MANUSCRIPT_REVIEW";

export interface PanelistAttentionTask {
  id: string;
  category: PanelistAttentionCategory;
  title: string;
  studentName: string | null;
  scheduleId: string | null;
  stage: string | null;
  responsibility: string;
  statusText: string;
  date: string | null;
  actionLabel: string;
  href: string;
  priority: 1 | 2 | 3;
}

export interface ActiveDefenseItem {
  scheduleId: string;
  studentName: string;
  studentNumber: string | null;
  programName: string | null;
  defenseType: string;
  stageLabel: string;
  sessionStatusLabel: string;
  roleLabel: string;
  href: string;
}

export interface UpcomingDefenseItem {
  scheduleId: string;
  studentName: string;
  studentNumber: string | null;
  programName: string | null;
  defenseType: string;
  stageLabel: string;
  defenseDate: string;
  defenseTime: string;
  venueOrLink: string | null;
  roleLabel: string;
  sessionStatusLabel: string;
  href: string;
}

export interface WaitingItem {
  id: string;
  studentName: string | null;
  studentNumber: string | null;
  recordLabel: string;
  requirement: string;
  responsibleRole: string;
  statusText: string;
  date: string | null;
  href: string | null;
}

export interface PanelistDashboard {
  kpis: { upcomingDefenses: number; pendingTasks: number };
  needsAttention: PanelistAttentionTask[];
  activeDefenses: ActiveDefenseItem[];
  upcomingDefenses: UpcomingDefenseItem[];
  waitingOnOthers: WaitingItem[];
}

export interface PanelistNotification {
  id: string;
  title: string;
  message: string;
  type?: string;
  isRead?: boolean;
  createdAt: string;
}

export const panelistDashboardQueryKey = ["panelist", "dashboard"] as const;

/** `YYYY-MM-DD` → readable date without UTC→local day shifting. */
export function formatWallDate(ymd: string | null | undefined): string {
  if (!ymd) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd);
  if (!m) return ymd;
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
  return `${months[Number(m[2]) - 1]} ${Number(m[3])}, ${m[1]}`;
}

/** `HH:mm[:ss]` → readable 12-hour time. */
export function formatWallTime(hms: string | null | undefined): string {
  if (!hms) return "—";
  const m = /^(\d{1,2}):(\d{2})/.exec(hms);
  if (!m) return hms;
  const h = Number(m[1]);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m[2]} ${ampm}`;
}

export const MAX_VISIBLE_TASKS = 5;
export const MAX_VISIBLE_NOTIFICATIONS = 5;
export const MAX_VISIBLE_WAITING = 3;
export const MAX_VISIBLE_OTHER_UPCOMING = 3;

export function isAdviserTask(
  task: Pick<PanelistAttentionTask, "category">,
): boolean {
  return (
    task.category === "ADVISER_REQUEST" ||
    task.category === "ADVISER_MANUSCRIPT_REVIEW"
  );
}

export function isAdviserWaitingItem(
  item: Pick<WaitingItem, "id" | "href">,
): boolean {
  if (
    item.id.startsWith("adviser-dean:") ||
    item.id.startsWith("manuscript-revision:")
  ) {
    return true;
  }
  if (
    item.id.startsWith("rap-awaiting-signatures:") ||
    item.id.startsWith("chairman-prereq:")
  ) {
    return false;
  }
  if (!item.href) return false;
  const pathname = item.href.split(/[?#]/, 1)[0];
  return /^\/panelist\/(?:advisees|adviser-requests|adviser-reviews)(?:\/|$)/.test(
    pathname,
  );
}

export interface FacultyDashboardProjection {
  hasDetailedWork: boolean;
  showUpcomingDefensesKpi: boolean;
  showPendingTasksKpi: boolean;
  showNeedsAttention: boolean;
  showUpcomingDefensesSection: boolean;
  attention: PanelistAttentionTask[];
  waiting: WaitingItem[];
  activeDefenses: ActiveDefenseItem[];
  upcomingDefenses: UpcomingDefenseItem[];
  upcomingDefensesCount: number | null;
  pendingTasksCount: number | null;
}

/**
 * Pure presentation projection from the authenticated account's FacultyWork
 * relevance and `GET /thesis/defense/panelist/dashboard` read model.
 * Never fabricates tasks or derives authorization from counts.
 */
export function projectFacultyDashboard(
  work: FacultyWork,
  data?: PanelistDashboard | null,
): FacultyDashboardProjection {
  const hasDetailedWork = Boolean(
    work.myAdvisees.relevant || work.myDefenses.relevant,
  );
  const attention = (data?.needsAttention ?? []).filter((task) =>
    isAdviserTask(task) ? work.myAdvisees.relevant : work.myDefenses.relevant,
  );
  const waiting = (data?.waitingOnOthers ?? []).filter((item) =>
    isAdviserWaitingItem(item)
      ? work.myAdvisees.relevant
      : work.myDefenses.relevant,
  );
  const activeDefenses = work.myDefenses.relevant
    ? (data?.activeDefenses ?? [])
    : [];
  const upcomingDefenses = work.myDefenses.relevant
    ? (data?.upcomingDefenses ?? [])
    : [];
  return {
    hasDetailedWork,
    showUpcomingDefensesKpi: work.myDefenses.relevant,
    showPendingTasksKpi: hasDetailedWork,
    showNeedsAttention: hasDetailedWork,
    showUpcomingDefensesSection: work.myDefenses.relevant,
    attention,
    waiting,
    activeDefenses,
    upcomingDefenses,
    upcomingDefensesCount: work.myDefenses.relevant
      ? data
        ? data.kpis.upcomingDefenses
        : null
      : null,
    pendingTasksCount: hasDetailedWork ? (data ? attention.length : null) : null,
  };
}
