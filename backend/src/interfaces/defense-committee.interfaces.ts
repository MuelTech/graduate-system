import type { DefenseTypeName } from "./defense-eligibility.interfaces";

export type DefensePanelRole =
  | "CHAIRMAN"
  | "PANELIST"
  | "ADVISER"
  | "FACILITATOR"
  | "RAPPORTEUR";

export type ProgramTypeKey = "MASTERS" | "DOCTORAL" | "UNKNOWN";

export interface CommitteeAssignmentInput {
  userId: string;
  role: DefensePanelRole;
}

export interface DefenseCommitteePolicyConfig {
  allowedRoles: DefensePanelRole[];
  requiredRoles: DefensePanelRole[];
  /** null = unconfirmed / unrestricted until client policy lands */
  minimumPanelists: number | null;
  maximumPanelists: number | null;
  maximumRoleCount: Partial<Record<DefensePanelRole, number | null>>;
  evaluatorRoles: DefensePanelRole[];
  rapporteurRequired: boolean;
  facilitatorRequired: boolean;
}

export interface CommitteeValidationResult {
  valid: boolean;
  errors: string[];
}

export interface ActiveAdviserContext {
  /** userId of the student's active AdviserAssignment, if any */
  adviserUserId: string | null;
}
