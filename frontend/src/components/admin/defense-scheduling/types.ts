import type {
  ActivePanelistCandidate,
  ApprovedApplicationDto,
  CommitteeAssignment,
  CommitteePolicyDto,
  DefensePanelRole,
} from "@/types";

export type CommitteeMember = CommitteeAssignment & {
  name: string;
  email: string;
  affiliation: string;
  isDerivedAdviser?: boolean;
};

export type ScheduleFormState = {
  defenseDate: string;
  defenseTime: string;
  /** Venue text or meeting link (backend `venueOrLink`). */
  venueOrLink: string;
};

export const ROLE_LABELS: Record<DefensePanelRole, string> = {
  CHAIRMAN: "Chairman",
  PANELIST: "Panelist",
  ADVISER: "Adviser",
  FACILITATOR: "Facilitator",
  RAPPORTEUR: "Rapporteur",
};

/**
 * Manually assignable roles in display order. The Proposal/Final Adviser is
 * derived automatically and is never listed here as a manual choice.
 */
export const MANUAL_ROLE_ORDER: DefensePanelRole[] = [
  "CHAIRMAN",
  "PANELIST",
  "FACILITATOR",
  "RAPPORTEUR",
];

export function defenseTypeFromStage(
  stage: "TITLE" | "PROPOSAL" | "FINAL",
): "TITLE_DEFENSE" | "PROPOSAL_DEFENSE" | "FINAL_DEFENSE" {
  if (stage === "TITLE") return "TITLE_DEFENSE";
  if (stage === "PROPOSAL") return "PROPOSAL_DEFENSE";
  return "FINAL_DEFENSE";
}

export function defenseTypeLabel(stage: "TITLE" | "PROPOSAL" | "FINAL"): string {
  if (stage === "TITLE") return "Title Defense";
  if (stage === "PROPOSAL") return "Proposal Defense";
  return "Final Defense";
}

/** Map an authoritative DefenseSchedule.defenseType to its journey stage. */
export function stageFromDefenseType(
  defenseType: string | null | undefined,
): "TITLE" | "PROPOSAL" | "FINAL" {
  const t = String(defenseType ?? "").toUpperCase();
  if (t === "PROPOSAL_DEFENSE") return "PROPOSAL";
  if (t === "FINAL_DEFENSE") return "FINAL";
  return "TITLE";
}

/** User-facing program type for the committee header. */
export function programTypeLabel(raw: string | null | undefined): string {
  const v = String(raw ?? "").toUpperCase();
  if (v === "MASTERS" || v === "MASTER" || v === "MS") return "Master's";
  if (v === "DOCTORAL" || v === "PHD" || v === "PH.D.") return "Doctoral";
  return "Program type not set";
}

export function panelistToMember(
  p: ActivePanelistCandidate,
  role: DefensePanelRole,
  isDerivedAdviser = false,
): CommitteeMember {
  return {
    userId: p.id,
    role,
    name: `${p.firstName} ${p.lastName}`,
    email: p.email,
    affiliation: p.panelist?.isExternal
      ? "External Panelist"
      : p.panelist?.officeAffiliation || "Internal Faculty",
    isDerivedAdviser,
  };
}

export interface PickerPerson {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  affiliation: string;
}

export function panelistToPerson(p: ActivePanelistCandidate): PickerPerson {
  return {
    id: p.id,
    firstName: p.firstName,
    lastName: p.lastName,
    email: p.email,
    affiliation: p.panelist?.isExternal
      ? "External Panelist"
      : p.panelist?.officeAffiliation || "Internal Faculty",
  };
}

export function personToMember(
  person: PickerPerson,
  role: DefensePanelRole,
): CommitteeMember {
  return {
    userId: person.id,
    role,
    name: `${person.firstName} ${person.lastName}`,
    email: person.email,
    affiliation: person.affiliation,
  };
}

export function memberToPerson(member: CommitteeMember): PickerPerson {
  const [firstName, ...rest] = member.name.split(" ");
  return {
    id: member.userId,
    firstName: firstName || member.name,
    lastName: rest.join(" "),
    email: member.email,
    affiliation: member.affiliation,
  };
}

export interface CommitteeReadiness {
  manualCount: number;
  totalCount: number;
  sessionTotal: number;
  chairman: number;
  panelists: number;
  panelistQuota: number;
  facilitator: number;
  rapporteur: number;
  adviserPresent: boolean;
  adviserMode: "NONE" | "AUTOMATIC";
  missing: string[];
  complete: boolean;
}

/**
 * UIUX advisory readiness projection. Backend `validateAssignments` remains the
 * authority; this only explains missing roles to the Admin. Requires the
 * resolved policy — callers must not compute readiness from a stale/absent one.
 */
export function computeCommitteeReadiness(
  policy: CommitteePolicyDto,
  members: CommitteeMember[],
  adviser: CommitteeMember | null,
): CommitteeReadiness {
  const countOf = (role: DefensePanelRole) =>
    members.filter((m) => m.role === role).length;
  const panelistQuota = policy.panelistCount;
  const sessionTotal = policy.sessionTotal;
  const adviserMode = policy.adviserMode;
  const manualSelectionCount = policy.manualSelectionCount;

  const chairman = countOf("CHAIRMAN");
  const panelists = countOf("PANELIST");
  const facilitator = countOf("FACILITATOR");
  const rapporteur = countOf("RAPPORTEUR");
  const adviserPresent = adviserMode === "AUTOMATIC" && !!adviser;

  const missing: string[] = [];
  if (chairman < 1) missing.push("1 Chairman still required");
  const panelistsMissing = Math.max(0, panelistQuota - panelists);
  if (panelistsMissing > 0) {
    missing.push(
      `${panelistsMissing} Panelist${panelistsMissing === 1 ? "" : "s"} still required`,
    );
  }
  if (rapporteur < 1) missing.push("1 Rapporteur still required");
  if (facilitator < 1) missing.push("1 Facilitator still required");
  if (adviserMode === "AUTOMATIC" && !adviser) {
    missing.push("Active thesis adviser is required for this stage");
  }

  const complete =
    missing.length === 0 && members.length === manualSelectionCount;

  return {
    manualCount: members.length,
    totalCount: members.length + (adviserPresent ? 1 : 0),
    sessionTotal,
    chairman,
    panelists,
    panelistQuota,
    facilitator,
    rapporteur,
    adviserPresent,
    adviserMode,
    missing,
    complete,
  };
}

export type { ApprovedApplicationDto, CommitteePolicyDto, DefensePanelRole };
