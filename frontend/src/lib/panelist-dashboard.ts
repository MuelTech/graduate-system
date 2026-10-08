/**
 * UIUX-3A — Panelist dashboard read-model contract.
 *
 * Mirrors backend `GET /thesis/defense/panelist/dashboard` (PanelistDashboardView).
 * The backend owns eligibility/labels; this module only transports the DTO and
 * formats wall-clock date/time values without timezone shifts.
 */

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
