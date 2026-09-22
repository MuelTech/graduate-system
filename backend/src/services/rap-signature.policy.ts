import type { DefensePanelRole } from "../interfaces/defense-committee.interfaces";

/**
 * RAP signature requirements (source of truth §15.3).
 *
 * UNRESOLVED (OPEN_QUESTION): form-specific signatories for GS-011 / RAP /
 * GS-022. Do not invent Chairman/Members/Adviser/Dean sets until the client
 * confirms.
 *
 * Interim default: every assigned defense participant gets a signature slot and
 * every slot is `required` (blocks finalization). Swap `resolveRapSignatureRequirements`
 * when form policy lands — conclusion flow stays unchanged.
 */
export type RapSignaturePolicyMode =
  | "INTERIM_ALL_PARTICIPANTS"
  | "FORM_SPECIFIC";

export const RAP_SIGNATURE_POLICY_MODE: RapSignaturePolicyMode =
  "INTERIM_ALL_PARTICIPANTS";

export interface RapSignatureSlotInput {
  userId: string;
  role: DefensePanelRole | string;
}

export interface RapSignatureRequirement {
  userId: string;
  roleAtDefense: string;
  required: boolean;
}

export function resolveRapSignatureRequirements(
  participants: RapSignatureSlotInput[],
  _defenseType?: string,
): RapSignatureRequirement[] {
  // Interim: assignment does not prove form signatory (§15.3), but we have no
  // confirmed form set yet — so all assigned participants are required signers.
  return participants.map((p) => ({
    userId: p.userId,
    roleAtDefense: p.role,
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
  if (signedRequired.length === 0) return "FOR_SIGNATURE";
  if (signedRequired.length < requiredSlots.length) return "PARTIALLY_SIGNED";
  return "FINALIZED";
}
