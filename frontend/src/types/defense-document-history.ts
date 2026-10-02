/**
 * DL-8: Admin workflow-aware Defense document-history DTO.
 * Safe metadata only — never storage paths/keys/checksums/e-signatures.
 */

export type DefenseHistoryStage = "TITLE" | "PROPOSAL" | "FINAL";

export type ReviewStatusLabel =
  | "NONE"
  | "AWAITING_REVIEW"
  | "CHANGES_REQUESTED"
  | "ISSUED";

export interface DefenseDocumentSummary {
  id: string;
  docType: string;
  defenseStage: string | null;
  originalFilename: string | null;
  verifiedMimeType: string | null;
  sizeBytes: number | null;
  uploadedAt: string;
  isCurrent: boolean;
  supersedesDocumentId: string | null;
}

export interface DefenseSupportingEvidenceSlot {
  docType: string;
  current: DefenseDocumentSummary | null;
  history: DefenseDocumentSummary[];
  integrityState: "OK" | "MISSING" | "AMBIGUOUS";
}

export interface DefenseManuscriptVersion extends DefenseDocumentSummary {
  isVersionHead: boolean;
  isReviewedByAdviser: boolean;
  isCertified: boolean;
}

export interface DefenseManuscriptReview {
  applicable: boolean;
  certificationStatus: ReviewStatusLabel;
  adviser: { id: string; name: string } | null;
  reviewRemarks: string | null;
  signedAt: string | null;
  reviewedDocumentId: string | null;
  bindingValid: boolean;
  certifiedDocumentId: string | null;
  versions: DefenseManuscriptVersion[];
  warning: string | null;
}

export interface DefenseReviewTimelineEvent {
  type: string;
  timestamp: string;
  actor: { id: string; name: string } | null;
  reason: string | null;
  description: string | null;
  replacementSummary: {
    previousRejectionReason: string | null;
    replacements: Array<{
      docType: string;
      supersededDocumentId: string | null;
      createdDocumentId: string;
    }>;
  } | null;
}

export interface DefenseDocumentHistory {
  thesisId: string;
  stage: DefenseHistoryStage;
  application: { status: string; rejectionReason: string | null };
  supportingEvidence: DefenseSupportingEvidenceSlot[];
  manuscriptReview: DefenseManuscriptReview | null;
  reviewTimeline: DefenseReviewTimelineEvent[];
  officialRecord: { scheduleId: string; available: boolean } | null;
}
