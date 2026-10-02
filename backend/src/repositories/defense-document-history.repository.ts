import prisma from "../config/database";
import { DEFENSE_REVIEW_ACTION_LIST } from "../services/defense-review-events";

/**
 * DL-8: read-only workflow-aware Admin document-history repository.
 *
 * Deliberately exposes no storage internals (no filePath/storageKey/checksum);
 * the service maps these rows into safe DTOs and resolves authority.
 */
export class DefenseApplicationDocumentHistoryRepository {
  /** Requested-stage documents only (prior-stage history is stage-scoped). */
  async getStageDocuments(thesisId: string, stage: "TITLE" | "PROPOSAL" | "FINAL") {
    return prisma.thesisDocument.findMany({
      where: { thesisId, defenseStage: stage },
      orderBy: [{ docType: "asc" }, { uploadedAt: "desc" }],
      select: {
        id: true,
        docType: true,
        defenseStage: true,
        originalFilename: true,
        verifiedMimeType: true,
        sizeBytes: true,
        uploadedAt: true,
        isCurrent: true,
        supersedesDocumentId: true,
      },
    });
  }

  async getThesis(thesisId: string) {
    return prisma.thesisRecord.findUnique({
      where: { id: thesisId },
      select: {
        id: true,
        stage: true,
        status: true,
        rejectionReason: true,
        studentId: true,
      },
    });
  }

  async getAdviserCertifications(
    thesisId: string,
    certStage: "PROPOSAL_DEFENSE" | "FINAL_DEFENSE",
  ) {
    return prisma.adviserCertification.findMany({
      where: { thesisId, defenseStage: certStage },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        status: true,
        defenseStage: true,
        reviewedDocumentId: true,
        reviewRemarks: true,
        signedAt: true,
        adviser: { select: { id: true, firstName: true, lastName: true } },
        reviewedDocument: {
          select: {
            id: true,
            thesisId: true,
            docType: true,
            defenseStage: true,
          },
        },
      },
    });
  }

  async getReviewAuditEvents(thesisId: string) {
    return prisma.auditLog.findMany({
      where: {
        targetTable: "thesis_records",
        targetId: thesisId,
        actionType: { in: [...DEFENSE_REVIEW_ACTION_LIST] },
      },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        actionType: true,
        oldValue: true,
        newValue: true,
        description: true,
        createdAt: true,
        actor: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async getStageScheduleId(
    thesisId: string,
    defenseType: "TITLE_DEFENSE" | "PROPOSAL_DEFENSE" | "FINAL_DEFENSE",
  ) {
    return prisma.defenseSchedule.findFirst({
      where: { thesisId, defenseType },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
  }
}
