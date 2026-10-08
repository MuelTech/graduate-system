/**
 * UIUX-3A — Panelist dashboard read-model rules (pure, no I/O).
 *
 * Projects EXISTING authoritative defense / adviser-request / adviser-review /
 * RAP records into one task-oriented panelist dashboard. This module creates no
 * new academic state, no mutation authority, and no new policy:
 *
 * - evaluator eligibility reuses DefenseCommitteePolicy via isEvaluatorRole;
 * - Chairman conclusion / Rapporteur finalization / Title start eligibility mirror
 *   the confirmed workspace + conclusion + finalization rules;
 * - adviser request actionability mirrors the GS-020 canonical terminals;
 * - adviser manuscript review actionability mirrors the review rules;
 * - RAP signing applies only to the authenticated user's own unsigned required slot.
 *
 * Ordering is deterministic: tier (priority) → authoritative wall-clock date →
 * stable id. Missing/invalid schedules never become upcoming events.
 */
import { isEvaluatorRole } from "./oral-evaluation.rules";

export const TITLE_DEFENSE = "TITLE_DEFENSE";
export const PROPOSAL_DEFENSE = "PROPOSAL_DEFENSE";
export const FINAL_DEFENSE = "FINAL_DEFENSE";

const NON_UPCOMING_SESSION_STATUSES = new Set(["CANCELLED", "CONCLUDED"]);

const MAX_SORT = Number.MAX_SAFE_INTEGER;

/* ------------------------------------------------------------------ labels */

export function stageLabel(defenseType: string): string {
  switch (defenseType) {
    case TITLE_DEFENSE:
      return "Title";
    case PROPOSAL_DEFENSE:
      return "Proposal";
    case FINAL_DEFENSE:
      return "Final";
    default:
      return "Defense";
  }
}

export function defenseTypeLabel(defenseType: string): string {
  switch (defenseType) {
    case TITLE_DEFENSE:
      return "Title Defense";
    case PROPOSAL_DEFENSE:
      return "Proposal Defense";
    case FINAL_DEFENSE:
      return "Final Defense";
    default:
      return String(defenseType ?? "").replace(/_/g, " ") || "Defense";
  }
}

export function roleLabel(role: string | null | undefined): string {
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
  status: string | null | undefined,
): string {
  switch (String(status ?? "")) {
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

export function sessionStatusLabel(status: string | null | undefined): string {
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
      return String(status ?? "") || "—";
  }
}

/* ------------------------------------------------------------------- dates */

/**
 * Parse a stored wall-clock date (`YYYY-MM-DD`) + time (`HH:mm[:ss]`) into a
 * timezone-neutral epoch used only for ordering/upcoming comparison. Both
 * components are required: a missing/invalid one returns null so the session is
 * never silently treated as a valid event.
 */
export function parseWallClockMs(
  date: string | null | undefined,
  time: string | null | undefined,
): number | null {
  if (!date || !time) return null;
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(date));
  const timeMatch = /^(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(String(time));
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

/** Server-local "now" expressed in the same wall-clock frame as parseWallClockMs. */
export function nowWallClockMs(now: Date): number {
  return Date.UTC(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    now.getHours(),
    now.getMinutes(),
    now.getSeconds(),
  );
}

function wallDateMs(date: string | null | undefined): number {
  const ms = parseWallClockMs(date, "00:00:00");
  return ms ?? MAX_SORT;
}

/* ------------------------------------------------------------------- input */

export interface DashboardAssignmentInput {
  assignmentId: string;
  role: string;
  evaluationStatus: "NOT_STARTED" | "DRAFT" | "FINALIZED" | "NONE";
  scheduleId: string;
  defenseType: string;
  sessionStatus: string;
  /** Wall-clock `YYYY-MM-DD`; null when not scheduled. */
  defenseDate: string | null;
  /** Wall-clock `HH:mm:ss`; null when not scheduled. */
  defenseTime: string | null;
  venueOrLink: string | null;
  conclusionPresent: boolean;
  rapporteurNotesFinalized: boolean;
  oralSummaryReady: boolean;
  studentName: string;
  studentNumber: string | null;
  programName: string | null;
}

export interface DashboardRapSlotInput {
  id: string;
  rapId: string;
  roleAtDefense: string | null;
  defenseType: string;
  generatedDate: string | null;
  studentName: string | null;
  studentNumber: string | null;
}

export interface DashboardSignedRapSlotInput {
  id: string;
  defenseType: string;
  studentName: string | null;
  studentNumber: string | null;
  signedDate: string | null;
}

export interface DashboardAdviserRequestInput {
  id: string;
  studentName: string;
  studentNumber: string | null;
  officialTitle: string | null;
  requestDate: string | null;
  status: string;
  adviserStatus: string;
  deanStatus: string;
}

export interface DashboardReviewTaskInput {
  thesisId: string;
  studentName: string;
  studentNumber: string | null;
  officialTitle: string | null;
  stage: "PROPOSAL" | "FINAL";
  reviewStatus: string;
  manuscriptUploadedAt: string | null;
}

export interface PanelistDashboardInput {
  now: Date;
  assignments: DashboardAssignmentInput[];
  pendingRapSlots: DashboardRapSlotInput[];
  signedRapSlots: DashboardSignedRapSlotInput[];
  adviserRequests: DashboardAdviserRequestInput[];
  proposalReviewTasks: DashboardReviewTaskInput[];
  finalReviewTasks: DashboardReviewTaskInput[];
}

/* ------------------------------------------------------------------ output */

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

export interface PanelistDashboardView {
  kpis: { upcomingDefenses: number; pendingTasks: number };
  needsAttention: PanelistAttentionTask[];
  activeDefenses: ActiveDefenseItem[];
  upcomingDefenses: UpcomingDefenseItem[];
  waitingOnOthers: WaitingItem[];
}

/* --------------------------------------------------------------- builders */

type RankedTask = PanelistAttentionTask & { _sortMs: number };
type RankedWaiting = WaitingItem & { _sortMs: number };

function workspaceHref(scheduleId: string): string {
  return `/panelist/defense-workspace/${scheduleId}`;
}

function isSessionActive(status: string): boolean {
  return status === "IN_PROGRESS" || status === "AWAITING_CONCLUSION";
}

function chairmanBlockedReason(a: DashboardAssignmentInput): string {
  if (a.sessionStatus !== "AWAITING_CONCLUSION") {
    return "Waiting for evaluator evaluations to complete";
  }
  if (!a.oralSummaryReady && !a.rapporteurNotesFinalized) {
    return "Waiting for finalized evaluator evaluations and Rapporteur minutes";
  }
  if (!a.oralSummaryReady) {
    return "Waiting for the Oral Examination Summary to be generated";
  }
  if (!a.rapporteurNotesFinalized) {
    return "Waiting for Rapporteur minutes to be finalized";
  }
  return "Waiting for conclusion prerequisites";
}

function tasksForAssignment(
  a: DashboardAssignmentInput,
  nowMs: number,
): RankedTask[] {
  const tasks: RankedTask[] = [];
  const isTitle = a.defenseType === TITLE_DEFENSE;
  const isNumerical =
    a.defenseType === PROPOSAL_DEFENSE || a.defenseType === FINAL_DEFENSE;
  const sessionOpen = !NON_UPCOMING_SESSION_STATUSES.has(a.sessionStatus);
  const sessionActive = isSessionActive(a.sessionStatus);
  const sessionMs = parseWallClockMs(a.defenseDate, a.defenseTime);
  const sortMs = sessionMs ?? MAX_SORT;

  // 1. Proposal/Final numerical evaluation requiring completion.
  if (
    isNumerical &&
    isEvaluatorRole(a.role) &&
    sessionOpen &&
    (a.sessionStatus === "SCHEDULED" || a.sessionStatus === "IN_PROGRESS") &&
    (a.evaluationStatus === "NOT_STARTED" || a.evaluationStatus === "DRAFT")
  ) {
    tasks.push({
      id: `evaluation:${a.scheduleId}`,
      category: "EVALUATION",
      title: `Complete ${defenseTypeLabel(a.defenseType)} evaluation`,
      studentName: a.studentName,
      scheduleId: a.scheduleId,
      stage: stageLabel(a.defenseType),
      responsibility: roleLabel(a.role),
      statusText: evaluationStatusLabel(a.evaluationStatus),
      date: a.defenseDate,
      actionLabel: "Continue Evaluation",
      href: workspaceHref(a.scheduleId),
      priority: a.sessionStatus === "IN_PROGRESS" ? 1 : 2,
      _sortMs: sortMs,
    });
  }

  // 2. Chairman formal conclusion once all authoritative prerequisites hold.
  const canConclude =
    a.role === "CHAIRMAN" &&
    !a.conclusionPresent &&
    sessionOpen &&
    (isTitle
      ? a.sessionStatus === "IN_PROGRESS" ||
        a.sessionStatus === "AWAITING_CONCLUSION"
      : a.sessionStatus === "AWAITING_CONCLUSION" &&
        a.rapporteurNotesFinalized &&
        a.oralSummaryReady);
  if (canConclude) {
    tasks.push({
      id: `conclusion:${a.scheduleId}`,
      category: "CHAIRMAN_CONCLUSION",
      title: `Record ${defenseTypeLabel(a.defenseType)} conclusion`,
      studentName: a.studentName,
      scheduleId: a.scheduleId,
      stage: stageLabel(a.defenseType),
      responsibility: "Chairman",
      statusText: "Awaiting your formal result",
      date: a.defenseDate,
      actionLabel: "Record Conclusion",
      href: workspaceHref(a.scheduleId),
      priority: 1,
      _sortMs: sortMs,
    });
  }

  // 3. Rapporteur defense minutes finalization (only once the session permits it).
  const rapporteurEligible =
    a.role === "RAPPORTEUR" &&
    !a.rapporteurNotesFinalized &&
    (a.sessionStatus === "IN_PROGRESS" ||
      a.sessionStatus === "AWAITING_CONCLUSION" ||
      a.sessionStatus === "CONCLUDED");
  if (rapporteurEligible) {
    tasks.push({
      id: `rapporteur:${a.scheduleId}`,
      category: "RAPPORTEUR_FINALIZE",
      title: `Finalize ${defenseTypeLabel(a.defenseType)} minutes`,
      studentName: a.studentName,
      scheduleId: a.scheduleId,
      stage: stageLabel(a.defenseType),
      responsibility: "Rapporteur",
      statusText: "Notes not yet finalized",
      date: a.defenseDate,
      actionLabel: "Open Minutes",
      href: workspaceHref(a.scheduleId),
      priority: sessionActive ? 1 : 2,
      _sortMs: sortMs,
    });
  }

  // 4. Eligible Title Defense start — only once the scheduled time has arrived.
  if (
    isTitle &&
    a.role === "CHAIRMAN" &&
    !a.conclusionPresent &&
    a.sessionStatus === "SCHEDULED" &&
    sessionMs !== null &&
    sessionMs <= nowMs
  ) {
    tasks.push({
      id: `title-start:${a.scheduleId}`,
      category: "TITLE_START",
      title: "Start Title Defense",
      studentName: a.studentName,
      scheduleId: a.scheduleId,
      stage: stageLabel(a.defenseType),
      responsibility: "Chairman",
      statusText: "Scheduled",
      date: a.defenseDate,
      actionLabel: "Start Defense",
      href: workspaceHref(a.scheduleId),
      priority: 2,
      _sortMs: sortMs,
    });
  }

  return tasks;
}

function sortRanked<T extends { priority: 1 | 2 | 3; _sortMs: number; id: string }>(
  tasks: T[],
): T[] {
  return [...tasks].sort((x, y) => {
    if (x.priority !== y.priority) return x.priority - y.priority;
    if (x._sortMs !== y._sortMs) return x._sortMs - y._sortMs;
    return x.id < y.id ? -1 : x.id > y.id ? 1 : 0;
  });
}

function sortRankedWaiting(tasks: RankedWaiting[]): RankedWaiting[] {
  return [...tasks].sort((x, y) => {
    if (x._sortMs !== y._sortMs) return x._sortMs - y._sortMs;
    return x.id < y.id ? -1 : x.id > y.id ? 1 : 0;
  });
}

function deriveUpcoming(
  assignments: DashboardAssignmentInput[],
  nowMs: number,
): UpcomingDefenseItem[] {
  return assignments
    .filter(
      (a) =>
        a.sessionStatus === "SCHEDULED" &&
        parseWallClockMs(a.defenseDate, a.defenseTime) !== null,
    )
    .map((a) => ({
      a,
      ms: parseWallClockMs(a.defenseDate, a.defenseTime) as number,
    }))
    .filter(({ ms }) => ms >= nowMs)
    .sort((x, y) => x.ms - y.ms || (x.a.scheduleId < y.a.scheduleId ? -1 : 1))
    .map(({ a }) => ({
      scheduleId: a.scheduleId,
      studentName: a.studentName,
      studentNumber: a.studentNumber,
      programName: a.programName,
      defenseType: a.defenseType,
      stageLabel: stageLabel(a.defenseType),
      defenseDate: a.defenseDate as string,
      defenseTime: a.defenseTime as string,
      venueOrLink: a.venueOrLink,
      roleLabel: roleLabel(a.role),
      sessionStatusLabel: sessionStatusLabel(a.sessionStatus),
      href: workspaceHref(a.scheduleId),
    }));
}

function deriveActive(
  assignments: DashboardAssignmentInput[],
): ActiveDefenseItem[] {
  return assignments
    .filter((a) => a.sessionStatus === "IN_PROGRESS")
    .sort((x, y) => {
      const xm = parseWallClockMs(x.defenseDate, x.defenseTime) ?? MAX_SORT;
      const ym = parseWallClockMs(y.defenseDate, y.defenseTime) ?? MAX_SORT;
      if (xm !== ym) return xm - ym;
      return x.scheduleId < y.scheduleId ? -1 : x.scheduleId > y.scheduleId ? 1 : 0;
    })
    .map((a) => ({
      scheduleId: a.scheduleId,
      studentName: a.studentName,
      studentNumber: a.studentNumber,
      programName: a.programName,
      defenseType: a.defenseType,
      stageLabel: stageLabel(a.defenseType),
      sessionStatusLabel: sessionStatusLabel(a.sessionStatus),
      roleLabel: roleLabel(a.role),
      href: workspaceHref(a.scheduleId),
    }));
}

export function buildPanelistDashboard(
  input: PanelistDashboardInput,
): PanelistDashboardView {
  const nowMs = nowWallClockMs(input.now);
  const rankedTasks: RankedTask[] = [];

  for (const a of input.assignments) {
    rankedTasks.push(...tasksForAssignment(a, nowMs));
  }

  for (const s of input.pendingRapSlots) {
    rankedTasks.push({
      id: `rap:${s.id}`,
      category: "RAP_SIGNATURE",
      title: `Sign ${defenseTypeLabel(s.defenseType)} RAP`,
      studentName: s.studentName,
      scheduleId: null,
      stage: stageLabel(s.defenseType),
      responsibility: roleLabel(s.roleAtDefense),
      statusText: "Awaiting your signature",
      date: s.generatedDate,
      actionLabel: "Review & Sign",
      href: "/panelist/signatures",
      priority: 2,
      _sortMs: wallDateMs(s.generatedDate),
    });
  }

  for (const r of input.adviserRequests) {
    const actionable =
      r.status === "PENDING" &&
      r.adviserStatus === "PENDING" &&
      r.deanStatus === "PENDING";
    if (!actionable) continue;
    rankedTasks.push({
      id: `adviser-request:${r.id}`,
      category: "ADVISER_REQUEST",
      title: "Respond to Adviser Request",
      studentName: r.studentName,
      scheduleId: null,
      stage: null,
      responsibility: "Requested Adviser",
      statusText: "Awaiting your response",
      date: r.requestDate,
      actionLabel: "Review Request",
      href: "/panelist/adviser-requests",
      priority: 2,
      _sortMs: wallDateMs(r.requestDate),
    });
  }

  const reviewInputs: DashboardReviewTaskInput[] = [
    ...input.proposalReviewTasks,
    ...input.finalReviewTasks,
  ];
  for (const t of reviewInputs) {
    if (t.reviewStatus !== "AWAITING_REVIEW") continue;
    rankedTasks.push({
      id: `review:${t.stage}:${t.thesisId}`,
      category: "ADVISER_MANUSCRIPT_REVIEW",
      title: `Review ${t.stage === "FINAL" ? "Final" : "Proposal"} manuscript`,
      studentName: t.studentName,
      scheduleId: null,
      stage: t.stage === "FINAL" ? "Final" : "Proposal",
      responsibility: "Active Adviser",
      statusText: "Awaiting your review",
      date: t.manuscriptUploadedAt,
      actionLabel: "Review Manuscript",
      href: "/panelist/adviser-reviews",
      priority: 2,
      _sortMs: wallDateMs(t.manuscriptUploadedAt),
    });
  }

  const needsAttention = sortRanked(rankedTasks).map(
    ({ _sortMs, ...task }) => task,
  );

  /* -------------------------------------------------- waiting on others */
  const rankedWaiting: RankedWaiting[] = [];

  for (const r of input.adviserRequests) {
    if (
      r.status === "PENDING" &&
      r.adviserStatus === "CONFORMED" &&
      r.deanStatus === "PENDING"
    ) {
      rankedWaiting.push({
        id: `adviser-dean:${r.id}`,
        studentName: r.studentName,
        studentNumber: r.studentNumber,
        recordLabel: "Adviser Request",
        requirement: "Dean approval of the adviser request",
        responsibleRole: "Dean, Graduate School",
        statusText: "Awaiting Dean decision",
        date: r.requestDate,
        href: "/panelist/adviser-requests",
        _sortMs: wallDateMs(r.requestDate),
      });
    }
  }

  for (const t of reviewInputs) {
    if (t.reviewStatus !== "CHANGES_REQUESTED") continue;
    rankedWaiting.push({
      id: `manuscript-revision:${t.stage}:${t.thesisId}`,
      studentName: t.studentName,
      studentNumber: t.studentNumber,
      recordLabel: `${t.stage === "FINAL" ? "Final" : "Proposal"} manuscript`,
      requirement: "Student manuscript revision",
      responsibleRole: "Student",
      statusText: "Changes requested",
      date: t.manuscriptUploadedAt,
      href: "/panelist/adviser-reviews",
      _sortMs: wallDateMs(t.manuscriptUploadedAt),
    });
  }

  for (const s of input.signedRapSlots) {
    rankedWaiting.push({
      id: `rap-awaiting-signatures:${s.id}`,
      studentName: s.studentName,
      studentNumber: s.studentNumber,
      recordLabel: `${defenseTypeLabel(s.defenseType)} RAP`,
      requirement: "Remaining required RAP signatures",
      responsibleRole: "Other required signatories",
      statusText: "Waiting for other signatures",
      date: s.signedDate,
      href: "/panelist/signatures",
      _sortMs: wallDateMs(s.signedDate),
    });
  }

  for (const a of input.assignments) {
    if (a.role !== "CHAIRMAN" || a.conclusionPresent) continue;
    if (!isSessionActive(a.sessionStatus)) continue;
    // Title Chairmen can always record a result while active.
    if (a.defenseType === TITLE_DEFENSE) continue;
    // The Chairman's own unfinished evaluation is their actionable task, not a
    // dependency on another actor — never duplicate it here.
    if (a.evaluationStatus === "NOT_STARTED" || a.evaluationStatus === "DRAFT") {
      continue;
    }
    const canConclude =
      a.sessionStatus === "AWAITING_CONCLUSION" &&
      a.rapporteurNotesFinalized &&
      a.oralSummaryReady;
    if (canConclude) continue;
    rankedWaiting.push({
      id: `chairman-prereq:${a.scheduleId}`,
      studentName: a.studentName,
      studentNumber: a.studentNumber,
      recordLabel: defenseTypeLabel(a.defenseType),
      requirement: chairmanBlockedReason(a),
      responsibleRole: "Evaluators / Rapporteur",
      statusText: "Awaiting conclusion prerequisites",
      date: a.defenseDate,
      href: workspaceHref(a.scheduleId),
      _sortMs: parseWallClockMs(a.defenseDate, a.defenseTime) ?? MAX_SORT,
    });
  }

  const waitingOnOthers = sortRankedWaiting(rankedWaiting).map(
    ({ _sortMs, ...item }) => item,
  );

  return {
    kpis: {
      upcomingDefenses: deriveUpcoming(input.assignments, nowMs).length,
      pendingTasks: needsAttention.length,
    },
    needsAttention,
    activeDefenses: deriveActive(input.assignments),
    upcomingDefenses: deriveUpcoming(input.assignments, nowMs),
    waitingOnOthers,
  };
}
