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
  meetingLink: string;
};

export const ROLE_LABELS: Record<DefensePanelRole, string> = {
  CHAIRMAN: "Chairman",
  PANELIST: "Panelist",
  ADVISER: "Adviser",
  FACILITATOR: "Facilitator",
  RAPPORTEUR: "Rapporteur",
};

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

export type { ApprovedApplicationDto, CommitteePolicyDto, DefensePanelRole };
