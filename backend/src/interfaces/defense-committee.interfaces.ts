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

/**
 * Confirmed session composition (source of truth §12):
 * - Master's session total 7 (GS-006 / client)
 * - Doctoral session total 8 (GS-007 / client)
 * - Facilitator = 1, Rapporteur = 1 on both forms
 *
 * Exact scorer/adviser/chairman counting inside the academic seats is OPEN_QUESTION —
 * do NOT hard-code "5 Master's scoring evaluators".
 */
export interface DefenseCommitteePolicyConfig {
  allowedRoles: DefensePanelRole[];
  requiredRoles: DefensePanelRole[];
  /** Confirmed total participants per defense session. */
  sessionTotal: number;
  /** Academic seats = sessionTotal − officials (Fac + Rap). Filled by CHAIRMAN/PANELIST/optional ADVISER. */
  academicSeatCount: number;
  facilitatorRequired: true;
  rapporteurRequired: true;
  maximumRoleCount: Partial<Record<DefensePanelRole, number | null>>;
  /** Facilitator/Rapporteur are not scorers; Adviser scoring remains OPEN_QUESTION. */
  evaluatorRoles: DefensePanelRole[];
  /** Marker that exact scorer counts are still client-pending. */
  scorerCountPolicy: "UNRESOLVED_DO_NOT_HARDCODE";
}

export interface CommitteeValidationResult {
  valid: boolean;
  errors: string[];
}

export interface ActiveAdviserContext {
  /** userId of the student's active AdviserAssignment, if any */
  adviserUserId: string | null;
}

export function mapProgramType(raw: string | null | undefined): ProgramTypeKey {
  const v = String(raw || "").toUpperCase();
  if (v === "MASTERS" || v === "MASTER" || v === "MS") return "MASTERS";
  if (v === "DOCTORAL" || v === "PHD" || v === "PH.D.") return "DOCTORAL";
  return "UNKNOWN";
}
