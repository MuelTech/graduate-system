/**
 * DL-6: Defense supporting-evidence stage/type matrix.
 *
 * Scope (thesisId, defenseStage, docType) defines an evidence slot. Certified
 * Proposal/Final manuscripts are NOT part of this matrix; their authority is
 * AdviserCertification.reviewedDocumentId (see proposal-adviser-review rules).
 */
export type DefenseEvidenceStage = "TITLE" | "PROPOSAL" | "FINAL";
export type DefenseEvidenceDocType = "TITLE_PROPOSAL" | "COR" | "RECEIPT";

export const STAGE_EVIDENCE_SLOTS: Record<
  DefenseEvidenceStage,
  DefenseEvidenceDocType[]
> = {
  TITLE: ["TITLE_PROPOSAL", "COR", "RECEIPT"],
  PROPOSAL: ["COR", "RECEIPT"],
  FINAL: ["COR", "RECEIPT"],
};

export function isAllowedEvidenceSlot(
  stage: DefenseEvidenceStage,
  docType: string,
): docType is DefenseEvidenceDocType {
  return STAGE_EVIDENCE_SLOTS[stage]?.includes(docType as DefenseEvidenceDocType) ?? false;
}

export function requiredEvidenceTypes(
  stage: DefenseEvidenceStage,
): DefenseEvidenceDocType[] {
  return STAGE_EVIDENCE_SLOTS[stage] ?? [];
}

/** Required evidence types missing from the current effective evidence set. */
export function missingRequiredEvidence(
  stage: DefenseEvidenceStage,
  currentDocTypes: string[],
): DefenseEvidenceDocType[] {
  const present = new Set(currentDocTypes);
  return requiredEvidenceTypes(stage).filter((type) => !present.has(type));
}
