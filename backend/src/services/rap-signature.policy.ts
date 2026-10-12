import type { DefensePanelRole } from "../interfaces/defense-committee.interfaces";

/**
 * RAP / Committee Report required signatories — RAP-1 (2026-10-12).
 *
 * Canonical authority: DEFENSE_WORKFLOW_SOURCE_OF_TRUTH.md §15.3.
 *
 * RAP signature authority is stage-aware and is intentionally NOT identical to
 * numerical evaluator authority (DefenseCommitteePolicy evaluator roles remain
 * CHAIRMAN + PANELIST only).
 *
 *   TITLE_DEFENSE    = CHAIRMAN + PANELIST + RAPPORTEUR  (Title has no Adviser seat)
 *   PROPOSAL_DEFENSE = ADVISER  + CHAIRMAN + PANELIST + RAPPORTEUR
 *   FINAL_DEFENSE    = ADVISER  + CHAIRMAN + PANELIST + RAPPORTEUR
 *
 * FACILITATOR is not a required RAP signatory. DEAN is a separate approving
 * authority on the final output and is never a RapReportSignature slot;
 * automatic Dean signature insertion is not authorized yet.
 *
 * The Adviser/Rapporteur sign the RAP but gain no numerical-scoring,
 * Oral Examination Criteria, Summary-row, or formal-result authority.
 */
export type RapSignaturePolicyMode =
  | "EVALUATOR_SIGNATORIES"
  | "INTERIM_ALL_PARTICIPANTS"
  | "FORM_SPECIFIC";

export const RAP_SIGNATURE_POLICY_MODE: RapSignaturePolicyMode =
  "FORM_SPECIFIC";

/** Title Defense: no Adviser seat; Facilitator is not a required signer. */
const TITLE_RAP_SIGNATORY_ROLES: DefensePanelRole[] = [
  "CHAIRMAN",
  "PANELIST",
  "RAPPORTEUR",
];

/**
 * Proposal/Final Defense: the authoritative active Adviser is a required signer
 * alongside the evaluators and the Rapporteur; Facilitator is excluded.
 */
const PROPOSAL_FINAL_RAP_SIGNATORY_ROLES: DefensePanelRole[] = [
  "ADVISER",
  "CHAIRMAN",
  "PANELIST",
  "RAPPORTEUR",
];

/**
 * Centralized stage-aware RAP signatory role set.
 * Unknown/missing stage defaults to the Proposal/Final reference set (the most
 * complete required-signer set); the caller always passes the schedule's stage.
 */
export function getRapSignatoryRoles(defenseType?: string): DefensePanelRole[] {
  if (defenseType === "TITLE_DEFENSE") {
    return [...TITLE_RAP_SIGNATORY_ROLES];
  }
  return [...PROPOSAL_FINAL_RAP_SIGNATORY_ROLES];
}

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
 * Resolve required RAP signatories from the actual session assignments.
 * Filters authoritative participants by the canonical stage-aware RAP role set,
 * creates required=true slots, and defensively de-duplicates repeated users.
 * Never fabricates a person; never creates a Facilitator or Dean slot.
 */
export function resolveRapSignatureRequirements(
  participants: RapSignatureSlotInput[],
  defenseType?: string,
): RapSignatureRequirement[] {
  const allowed = new Set(getRapSignatoryRoles(defenseType).map(String));
  const seenUserIds = new Set<string>();
  const requirements: RapSignatureRequirement[] = [];

  for (const participant of participants) {
    if (!allowed.has(String(participant.role))) continue;
    if (!participant.userId || seenUserIds.has(participant.userId)) continue;
    seenUserIds.add(participant.userId);
    requirements.push({
      userId: participant.userId,
      roleAtDefense: String(participant.role),
      required: true,
    });
  }

  return requirements;
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
