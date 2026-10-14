/** CP3 Proposal Adviser review / certification frontend contract. */

export type ProposalReviewStatus =
  | "NONE"
  | "AWAITING_REVIEW"
  | "CHANGES_REQUESTED"
  | "ISSUED";

export interface ProposalAdviserReview {
  thesisId: string | null;
  student: { id: string; name: string; studentNumber: string | null } | null;
  officialTitle: string | null;
  activeAdviser: { userId: string; name: string } | null;
  reviewStatus: ProposalReviewStatus;
  reviewRemarks: string | null;
  manuscript: { documentId: string; uploadedAt: string | null } | null;
  certification: {
    issued: boolean;
    adviserName: string | null;
    signedAt: string | null;
    defenseStage: string;
  } | null;
  isAuthorizedAdviser: boolean;
}

export interface AdviserReviewQueueItem {
  thesisId: string;
  student: { id: string; name: string; studentNumber: string | null };
  officialTitle: string | null;
  reviewStatus: ProposalReviewStatus;
  reviewRemarks: string | null;
  manuscriptDocumentId: string | null;
  manuscriptUploadedAt: string | null;
}
