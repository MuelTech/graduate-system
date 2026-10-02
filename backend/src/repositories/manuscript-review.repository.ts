import prisma from "../config/database";
import type { DefenseType, ThesisDocType, ThesisStage } from "@prisma/client";
import { AppError } from "../utils/AppError";
import type { ManagedUploadInput } from "../storage/managed-upload";
import {
  FINAL_MANUSCRIPT_DOC_STAGE,
  FINAL_MANUSCRIPT_DOC_TYPE,
  FINAL_REVIEW_STAGE,
  PROPOSAL_MANUSCRIPT_DOC_STAGE,
  PROPOSAL_MANUSCRIPT_DOC_TYPE,
  PROPOSAL_REVIEW_STAGE,
} from "../services/proposal-adviser-review.rules";

/**
 * DL-7: shared, append-only persistence for Proposal/Final Adviser-review
 * manuscript submissions.
 *
 * This helper owns storage/version mechanics only. Proposal/Final business
 * prerequisites (active adviser, Title/Proposal completion, STRIKE, ISSUED
 * write-once) are still decided by the owning service; the helper re-checks
 * the ISSUED invariant inside the same transaction that commits the row.
 *
 * Authority invariant: the certified document is always
 * `AdviserCertification.reviewedDocumentId`. `isCurrent` is only the version
 * head of the manuscript chain and is never sufficient for certification.
 */

export interface ManuscriptStageBinding {
  certStage: DefenseType;
  docType: ThesisDocType;
  docStage: ThesisStage;
  /** Domain-specific 409 message when the stage is already certified. */
  issuedMessage: string;
}

export const PROPOSAL_MANUSCRIPT_BINDING: ManuscriptStageBinding = {
  certStage: PROPOSAL_REVIEW_STAGE,
  docType: PROPOSAL_MANUSCRIPT_DOC_TYPE,
  docStage: PROPOSAL_MANUSCRIPT_DOC_STAGE,
  issuedMessage:
    "Proposal Adviser Certification is already issued. Contact the Graduate School if a new review is required.",
};

export const FINAL_MANUSCRIPT_BINDING: ManuscriptStageBinding = {
  certStage: FINAL_REVIEW_STAGE,
  docType: FINAL_MANUSCRIPT_DOC_TYPE,
  docStage: FINAL_MANUSCRIPT_DOC_STAGE,
  issuedMessage:
    "Final Adviser Certification is already issued. Contact the Graduate School if a new review is required.",
};

export interface SubmitManuscriptVersionResult {
  documentId: string;
}

/**
 * Creates a new manuscript version and rebinds the stage AdviserCertification to
 * it in one transaction:
 *
 * 1. lock the thesis row (serialize competing student uploads);
 * 2. fail closed if an ISSUED certification already exists;
 * 3. demote the existing current head(s) for this slot (append-only history);
 * 4. insert the new managed row as the sole current head, superseding the exact
 *    previously bound review document when one is known;
 * 5. atomically rebind the certification to the new document
 *    (`AWAITING_REVIEW`), clearing any previous e-signature, or create it.
 */
export async function submitManuscriptVersion(params: {
  thesisId: string;
  adviserId: string;
  upload: ManagedUploadInput;
  binding: ManuscriptStageBinding;
}): Promise<SubmitManuscriptVersionResult> {
  const { thesisId, adviserId, upload, binding } = params;

  return prisma.$transaction(async (tx) => {
    // Serialize competing manuscript submissions for this thesis.
    await tx.$queryRaw`SELECT thesis_id FROM thesis_records WHERE thesis_id = ${thesisId} FOR UPDATE`;

    const issued = await tx.adviserCertification.findFirst({
      where: {
        thesisId,
        defenseStage: binding.certStage,
        status: "ISSUED",
      },
      select: { id: true },
    });
    if (issued) {
      throw new AppError(binding.issuedMessage, 409);
    }

    const existing = await tx.adviserCertification.findFirst({
      where: { thesisId, defenseStage: binding.certStage },
      orderBy: { updatedAt: "desc" },
    });
    // Exact prior workflow manuscript. Legacy unbound history is never guessed.
    const previousBoundDocumentId = existing?.reviewedDocumentId ?? null;

    // One current version head per slot: demote existing current rows. This is
    // not a nomination of a prior authority; it only keeps the chain coherent.
    await tx.thesisDocument.updateMany({
      where: {
        thesisId,
        defenseStage: binding.docStage,
        docType: binding.docType,
        isCurrent: true,
      },
      data: { isCurrent: false },
    });

    const document = await tx.thesisDocument.create({
      data: {
        thesisId,
        docType: binding.docType,
        defenseStage: binding.docStage,
        filePath: upload.filePath,
        storageKey: upload.storageKey,
        storageProvider: upload.storageProvider,
        originalFilename: upload.originalFilename,
        verifiedMimeType: upload.verifiedMimeType,
        sizeBytes: upload.sizeBytes,
        checksum: upload.checksum,
        checksumAlgorithm: upload.checksumAlgorithm,
        uploadedById: upload.uploadedById,
        isCurrent: true,
        supersedesDocumentId: previousBoundDocumentId,
        uploadedAt: new Date(),
      },
      select: { id: true },
    });

    if (existing) {
      const updated = await tx.adviserCertification.updateMany({
        where: {
          id: existing.id,
          defenseStage: binding.certStage,
          status: { not: "ISSUED" },
        },
        data: {
          status: "AWAITING_REVIEW",
          // Preserve the Adviser's change requests across a Student resubmit.
          reviewRemarks:
            existing.status === "CHANGES_REQUESTED"
              ? existing.reviewRemarks
              : null,
          reviewedDocumentId: document.id,
          adviserId,
          signatureData: null,
          signedAt: null,
          certifiedAt: null,
        },
      });
      if (updated.count === 0) {
        throw new AppError(binding.issuedMessage, 409);
      }
    } else {
      await tx.adviserCertification.create({
        data: {
          thesisId,
          adviserId,
          defenseStage: binding.certStage,
          status: "AWAITING_REVIEW",
          reviewedDocumentId: document.id,
        },
      });
    }

    return { documentId: document.id };
  });
}
