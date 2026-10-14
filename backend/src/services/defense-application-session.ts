import type { DefenseStage } from "../interfaces/defense-eligibility.interfaces";

/** Current stage maps to the defense session type for that stage. */
export const STAGE_DEFENSE_TYPE: Record<
  DefenseStage,
  "TITLE_DEFENSE" | "PROPOSAL_DEFENSE" | "FINAL_DEFENSE"
> = {
  TITLE: "TITLE_DEFENSE",
  PROPOSAL: "PROPOSAL_DEFENSE",
  FINAL: "FINAL_DEFENSE",
};

export type ScheduleForPick = {
  id: string;
  defenseType: string;
  sessionStatus?: string | null;
  createdAt?: Date | string | null;
};

/**
 * Pick the defense schedule for the thesis record's CURRENT stage.
 * Never blindly use defenseSchedules[0] — one research lifecycle can hold
 * Title, Proposal, Final, rescheduled, or re-defense sessions.
 */
export function pickCurrentDefenseSchedule<T extends ScheduleForPick>(
  stage: DefenseStage | null | undefined,
  schedules: T[] | null | undefined,
): T | null {
  if (!stage || !schedules?.length) return null;
  const wanted = STAGE_DEFENSE_TYPE[stage];
  const matches = schedules.filter(
    (s) => s.defenseType === wanted && s.sessionStatus !== "CANCELLED",
  );
  if (!matches.length) return null;
  return [...matches].sort((a, b) => {
    const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return tb - ta;
  })[0];
}

export type PanelSeatForSummary = {
  role: string;
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email?: string | null;
  } | null;
};

export type CommitteeSummary = {
  chairman: string[];
  panelists: string[];
  facilitator: string[];
  rapporteur: string[];
  adviser: string[];
};

function fullName(u: PanelSeatForSummary["user"]): string {
  if (!u) return "Unassigned";
  return `${u.firstName} ${u.lastName}`.trim();
}

/**
 * Compact committee summary by functional role.
 * Adviser appears only when explicitly assigned as a defense seat
 * (AdviserAssignment relationship alone does not create a seat).
 */
export function summarizeCommittee(
  seats: PanelSeatForSummary[] | null | undefined,
): CommitteeSummary {
  const summary: CommitteeSummary = {
    chairman: [],
    panelists: [],
    facilitator: [],
    rapporteur: [],
    adviser: [],
  };
  for (const seat of seats ?? []) {
    const name = fullName(seat.user);
    switch (seat.role) {
      case "CHAIRMAN":
        summary.chairman.push(name);
        break;
      case "PANELIST":
        summary.panelists.push(name);
        break;
      case "FACILITATOR":
        summary.facilitator.push(name);
        break;
      case "RAPPORTEUR":
        summary.rapporteur.push(name);
        break;
      case "ADVISER":
        summary.adviser.push(name);
        break;
      default:
        break;
    }
  }
  return summary;
}

/** Compact one-line list with "+N more" for cards. */
export function formatNameList(
  names: string[],
  maxVisible = 3,
): string {
  if (!names.length) return "—";
  if (names.length <= maxVisible) return names.join(", ");
  const shown = names.slice(0, maxVisible).join(", ");
  return `${shown} +${names.length - maxVisible} more`;
}
