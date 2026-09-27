import type { DefensePanelRole } from "../interfaces/defense-committee.interfaces";

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
 * Proposal/Final and Title use the same evaluator-role set (CHAIRMAN + PANELIST).
 * Non-evaluator participants never receive a required slot.
 */
export function resolveRapSignatureRequirements(
  participants: RapSignatureSlotInput[],
  _defenseType?: string,
): RapSignatureRequirement[] {
  return participants
    .filter((p) =>
      (RAP_REQUIRED_SIGNER_ROLES as string[]).includes(String(p.role)),
    )
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
