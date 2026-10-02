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

export interface EvidenceSlotIssue {
  docType: DefenseEvidenceDocType;
  kind: "MISSING" | "AMBIGUOUS";
  count: number;
}

/**
 * DL-6: every required stage slot must have EXACTLY ONE current row.
 * 0 → MISSING, 1 → valid, >1 → AMBIGUOUS. Non-required document types are
 * ignored and never determine supporting-evidence authority.
 */
export function validateCurrentEvidenceCounts(
  stage: DefenseEvidenceStage,
  counts: Record<string, number>,
): EvidenceSlotIssue[] {
  const issues: EvidenceSlotIssue[] = [];
  for (const docType of requiredEvidenceTypes(stage)) {
    const count = counts[docType] ?? 0;
    if (count === 0) {
      issues.push({ docType, kind: "MISSING", count });
    } else if (count > 1) {
      issues.push({ docType, kind: "AMBIGUOUS", count });
    }
  }
  return issues;
}
