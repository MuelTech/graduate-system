/**
 * CP3 — Proposal Adviser review / certification pure rules.
 * Stage scope is strictly PROPOSAL_DEFENSE.
 */

export const PROPOSAL_REVIEW_STAGE = "PROPOSAL_DEFENSE" as const;

export type ProposalReviewStatus =
  | "NONE"
  | "AWAITING_REVIEW"
  | "CHANGES_REQUESTED"
  | "ISSUED";

export type ProposalReviewTransition =
  | "SUBMIT_FOR_REVIEW"
  | "REQUEST_CHANGES"
  | "CERTIFY";

export interface ProposalReviewRowLike {
  status: string;
  defenseStage: string;
  reviewedDocumentId?: string | null;
  signatureData?: string | null;
  signedAt?: Date | string | null;
}

export function mapCertStatusToReviewStatus(
  status: string | null | undefined,
): ProposalReviewStatus {
  switch (status) {
    case "AWAITING_REVIEW":
    case "PENDING":
      // Legacy PENDING rows without workflow fields are treated as awaiting review.
      return "AWAITING_REVIEW";
    case "CHANGES_REQUESTED":
      return "CHANGES_REQUESTED";
    case "ISSUED":
      return "ISSUED";
    default:
      return "NONE";
  }
}

export function isProposalStageCert(row: {
  defenseStage: string;
} | null | undefined): boolean {
  return row?.defenseStage === PROPOSAL_REVIEW_STAGE;
}

/** Only ISSUED Proposal certifications satisfy ADVISER_CERT. */
export function isProposalAdviserCertIssued(
  row: ProposalReviewRowLike | null | undefined,
): boolean {
  return (
    !!row &&
    isProposalStageCert(row) &&
    row.status === "ISSUED"
  );
}

export interface CertifiedManuscriptDocLike {
  id: string;
  thesisId: string;
  docType: string;
  defenseStage: string | null;
}

/**
 * CP3-FIX1: an ISSUED Proposal cert is only valid when bound to a
 * Proposal manuscript on the same thesis (reviewedDocumentId).
 * Legacy ISSUED rows without reviewedDocumentId are NOT accepted for
 * new application/eligibility (fail closed).
 */
export function isValidCertifiedProposalManuscript(
  cert: { status: string; defenseStage: string; reviewedDocumentId?: string | null } | null | undefined,
  doc: CertifiedManuscriptDocLike | null | undefined,
  thesisId: string,
): boolean {
  if (!cert || cert.status !== "ISSUED" || cert.defenseStage !== "PROPOSAL_DEFENSE") {
    return false;
  }
  if (!cert.reviewedDocumentId || !doc) return false;
  if (doc.id !== cert.reviewedDocumentId) return false;
  if (doc.thesisId !== thesisId) return false;
  if (doc.docType !== "PROPOSAL_CHAPTERS") return false;
  if (doc.defenseStage !== "PROPOSAL") return false;
  return true;
}

/**
 * CP3-FIX2: resolve the single authoritative Proposal manuscript document.
 * Returns null when no valid ISSUED binding exists (fail closed — never
 * substitute "latest" Proposal revisions).
 */
export function selectCertifiedProposalManuscript<
  T extends CertifiedManuscriptDocLike,
>(
  docs: T[],
  cert: { status: string; defenseStage: string; reviewedDocumentId?: string | null } | null | undefined,
  thesisId: string,
): T | null {
  if (!cert?.reviewedDocumentId) return null;
  const doc = docs.find((d) => d.id === cert.reviewedDocumentId) ?? null;
  return isValidCertifiedProposalManuscript(cert, doc, thesisId) ? doc : null;
}

/**
 * Authoritative current-application Proposal documents:
 * certified manuscript + non-manuscript stage evidence (COR/RECEIPT/etc).
 * Historical PROPOSAL_CHAPTERS revisions are excluded from the current list.
 */
export function resolveCurrentProposalApplicationDocuments<
  T extends CertifiedManuscriptDocLike & { docType: string },
>(
  docs: T[],
  cert: { status: string; defenseStage: string; reviewedDocumentId?: string | null } | null | undefined,
  thesisId: string,
): T[] {
  const certified = selectCertifiedProposalManuscript(docs, cert, thesisId);
  const others = docs.filter((d) => d.docType !== "PROPOSAL_CHAPTERS");
  return certified ? [certified, ...others] : others;
}

export type ReviewActionResult =
  | { allowed: true }
  | { allowed: false; reason: string; statusCode: number };

export interface ActiveAdviserGateInput {
  isAuthenticated: boolean;
  isActiveAdviserForStudent: boolean;
}

export function evaluateActiveAdviserGate(
  input: ActiveAdviserGateInput,
): ReviewActionResult {
  if (!input.isAuthenticated) {
    return { allowed: false, reason: "Authentication required.", statusCode: 401 };
  }
  if (!input.isActiveAdviserForStudent) {
    return {
      allowed: false,
      reason: "Only the current active adviser may review this Proposal manuscript.",
      statusCode: 403,
    };
  }
  return { allowed: true };
}

export interface SubmitManuscriptGateInput {
  hasActiveAdviser: boolean;
  titleStageComplete: boolean;
  hasManuscriptFile: boolean;
}

export function evaluateSubmitManuscriptGate(
  input: SubmitManuscriptGateInput,
): ReviewActionResult {
  if (!input.hasActiveAdviser) {
    return {
      allowed: false,
      reason: "An active Thesis Adviser is required before submitting the Proposal manuscript for review.",
      statusCode: 400,
    };
  }
  if (!input.titleStageComplete) {
    return {
      allowed: false,
      reason: "Title Defense must be complete before Proposal manuscript review.",
      statusCode: 400,
    };
  }
  if (!input.hasManuscriptFile) {
    return {
      allowed: false,
      reason: "Proposal manuscript (Chapters 1-3) is required.",
      statusCode: 400,
    };
  }
  return { allowed: true };
}

export interface RequestChangesGateInput {
  isActiveAdviser: boolean;
  reviewStatus: ProposalReviewStatus;
  hasRemarks: boolean;
  /** Bound reviewedDocumentId must exist for an active review cycle. */
  hasReviewedDocument: boolean;
  /** CP3-FIX4: client must supply expectedReviewedDocumentId. */
  hasExpectedReviewedDocument: boolean;
}

export function evaluateRequestChangesGate(
  input: RequestChangesGateInput,
): ReviewActionResult {
  const auth = evaluateActiveAdviserGate({
    isAuthenticated: true,
    isActiveAdviserForStudent: input.isActiveAdviser,
  });
  if (!auth.allowed) return auth;
  if (input.reviewStatus === "ISSUED") {
    return {
      allowed: false,
      reason: "Issued Proposal Adviser Certification cannot be changed.",
      statusCode: 409,
    };
  }
  // CP3-FIX3: only from AWAITING_REVIEW (not NONE / CHANGES_REQUESTED / ISSUED).
  if (input.reviewStatus !== "AWAITING_REVIEW") {
    return {
      allowed: false,
      reason: "No Proposal manuscript is currently awaiting Adviser review.",
      statusCode: 409,
    };
  }
  if (!input.hasExpectedReviewedDocument) {
    return {
      allowed: false,
      reason: "Reviewed manuscript identifier is required.",
      statusCode: 400,
    };
  }
  if (!input.hasReviewedDocument) {
    return {
      allowed: false,
      reason: "Proposal review state changed. Refresh the task and try again.",
      statusCode: 409,
    };
  }
  if (!input.hasRemarks) {
    return {
      allowed: false,
      reason: "Remarks are required when requesting changes.",
      statusCode: 400,
    };
  }
  return { allowed: true };
}

export interface CertifyGateInput {
  isActiveAdviser: boolean;
  reviewStatus: ProposalReviewStatus;
  hasManuscript: boolean;
  hasSignature: boolean;
  alreadyIssued: boolean;
  /** Bound reviewedDocumentId must exist; certify never invents a document. */
  hasReviewedDocument: boolean;
  /** CP3-FIX4: client must supply expectedReviewedDocumentId. */
  hasExpectedReviewedDocument: boolean;
}

export function evaluateCertifyGate(
  input: CertifyGateInput,
): ReviewActionResult {
  const auth = evaluateActiveAdviserGate({
    isAuthenticated: true,
    isActiveAdviserForStudent: input.isActiveAdviser,
  });
  if (!auth.allowed) return auth;
  if (input.alreadyIssued || input.reviewStatus === "ISSUED") {
    return {
      allowed: false,
      reason: "Proposal Adviser Certification is already issued.",
      statusCode: 409,
    };
  }
  if (!input.hasManuscript) {
    return {
      allowed: false,
      reason: "A current Proposal manuscript is required before certification.",
      statusCode: 400,
    };
  }
  if (!input.hasExpectedReviewedDocument) {
    return {
      allowed: false,
      reason: "Reviewed manuscript identifier is required.",
      statusCode: 400,
    };
  }
  if (!input.hasReviewedDocument) {
    return {
      allowed: false,
      reason: "Proposal review state changed. Refresh the task and try again.",
      statusCode: 409,
    };
  }
  // CP3-FIX3: certify only from AWAITING_REVIEW (Student must resubmit after CHANGES_REQUESTED).
  if (input.reviewStatus !== "AWAITING_REVIEW") {
    return {
      allowed: false,
      reason:
        input.reviewStatus === "CHANGES_REQUESTED"
          ? "Changes were requested on this manuscript. Wait for the Student to resubmit before certifying."
          : "No Proposal manuscript is available for certification.",
      statusCode: 409,
    };
  }
  if (!input.hasSignature) {
    return {
      allowed: false,
      reason: "Adviser e-signature is required to issue the certification.",
      statusCode: 400,
    };
  }
  return { allowed: true };
}

/** Allowed Proposal manuscript extensions (consistent with Proposal upload). */
export const PROPOSAL_MANUSCRIPT_MIME_ALLOWLIST = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

export function isAllowedProposalManuscriptMime(mime: string | null | undefined): boolean {
  return (PROPOSAL_MANUSCRIPT_MIME_ALLOWLIST as readonly string[]).includes(
    String(mime ?? ""),
  );
}
