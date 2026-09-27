import type { DefensePanelRole } from "../interfaces/defense-committee.interfaces";
import { DefenseCommitteePolicy } from "./defense-committee.policy";

/**
 * RAP signature requirements (CP7 confirmed project direction).
 *
 * Required signers are the actual evaluator assignments only
 * (DefenseCommitteePolicy evaluator roles: CHAIRMAN + PANELIST).
 *
 * Do NOT invent Facilitator / Rapporteur / Adviser / Dean RAP signatories.
 * Those form-specific sets remain OPEN_QUESTION and must not be silently required.
 */
export type RapSignaturePolicyMode =
  | "EVALUATOR_SIGNATORIES"
  | "INTERIM_ALL_PARTICIPANTS"
  | "FORM_SPECIFIC";

export const RAP_SIGNATURE_POLICY_MODE: RapSignaturePolicyMode =
  "EVALUATOR_SIGNATORIES";

/**
 * CP7-FIX1 Issue 9: centralized RAP signatory roles.
 * Title and Proposal/Final share the confirmed evaluator-role set.
 * DefenseCommitteePolicy remains the single evaluator-role authority.
 */
export function getRapSignatoryRoles(
  defenseType?: string,
): DefensePanelRole[] {
  const policy = new DefenseCommitteePolicy();
  return policy.getEvaluatorRoles(
    (defenseType as never) ?? ("PROPOSAL_DEFENSE" as never),
  );
}

/** Canonical evaluator roles that own RAP signature slots. */
export const RAP_REQUIRED_SIGNER_ROLES: DefensePanelRole[] = [
  "CHAIRMAN",
  "PANELIST",
];

export interface RapSignatureSlotInput {
  userId: string;
  role: DefensePanelRole | string;
}

export interface RapSignatureRequirement {
  userId: string;
  roleAtDefense: string;
  required: boolean;
}

/**
 * Resolve required RAP signatories from session assignments.
 * Proposal/Final and Title use getRapSignatoryRoles (centralized).
 * Non-evaluator participants never receive a required slot.
 */
export function resolveRapSignatureRequirements(
  participants: RapSignatureSlotInput[],
  defenseType?: string,
): RapSignatureRequirement[] {
  const allowed = new Set(
    getRapSignatoryRoles(defenseType).map(String),
  );
  return participants
    .filter((p) => allowed.has(String(p.role)))
    .map((p) => ({
      userId: p.userId,
      roleAtDefense: String(p.role),
      required: true,
    }));
}

export function isRapReadyToFinalize(slots: {
  required: boolean | null;
  isSigned: boolean | null;
}[]): boolean {
  const requiredSlots = slots.filter((s) => s.required !== false);
  return (
    requiredSlots.length > 0 && requiredSlots.every((s) => s.isSigned === true)
  );
}

export function rapStatusAfterSignatures(
  slots: { required: boolean | null; isSigned: boolean | null }[],
): "FOR_SIGNATURE" | "PARTIALLY_SIGNED" | "ALL_SIGNED" | "FINALIZED" {
  const requiredSlots = slots.filter((s) => s.required !== false);
  const signedRequired = requiredSlots.filter((s) => s.isSigned === true);
  if (requiredSlots.length === 0) return "FOR_SIGNATURE";
  if (signedRequired.length === 0) return "FOR_SIGNATURE";
  if (signedRequired.length < requiredSlots.length) return "PARTIALLY_SIGNED";
  return "FINALIZED";
}
