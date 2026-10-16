import prisma from "../config/database";

/**
 * DL-9: Research Databank private archival registration.
 *
 * Read/resolve the authenticated Student's completed Final research context and
 * persist a private archive record with attached physical files and integrity metadata.
 */

export interface ArchiveRecord {
  id: string;
  thesisId: string;
  title: string;
  abstract: string | null;
  keywords: string | null;
  isPublic: boolean;
  publishedAt: Date | null;
  approvedById: string | null;
  createdAt: Date;
  fullPaperPath?: string | null;
  respondentDataPath?: string | null;
}

export interface CreateArchiveInput {
  thesisId: string;
  title: string;
  abstract: string | null;
  keywords: string | null;
  fullPaperPath?: string | null;
  respondentDataPath?: string | null;
  documents?: Array<{
    docType: "FINAL_MANUSCRIPT" | "INSTRUMENTS" | "RESPONDENT_DATA";
    defenseStage: "FINAL";
    filePath: string;
    storageKey?: string | null;
    storageProvider?: string | null;
    originalFilename?: string | null;
    verifiedMimeType?: string | null;
    sizeBytes?: number | null;
    checksum?: string | null;
    checksumAlgorithm?: string | null;
    uploadedById?: string | null;
  }>;
  certificationsPath?: string | null;
}

const ARCHIVE_SELECT = {
  id: true,
  thesisId: true,
  title: true,
  abstract: true,
  keywords: true,
  isPublic: true,
  publishedAt: true,
  approvedById: true,
  createdAt: true,
  fullPaperPath: true,
  respondentDataPath: true,
} as const;

export class DatabankArchiveRepository {
  async getStudentByUserId(userId: string) {
    return prisma.student.findUnique({
      where: { userId },
      select: { id: true },
    });
  }

  async getThesisIdsForStudent(studentId: string): Promise<string[]> {
    const rows = await prisma.thesisRecord.findMany({
      where: { studentId },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }

  /**
   * ALL formal Final Defense conclusions for one thesis (latest is never
   * authority). The service owns cardinality/authority interpretation.
   */
  async getFinalConclusionsForThesis(thesisId: string) {
    return prisma.defenseConclusion.findMany({
      where: {
        thesisId,
        schedule: { defenseType: "FINAL_DEFENSE" },
      },
      select: {
        outcome: true,
        scheduleId: true,
        concludedAt: true,
      },
    });
  }

  /** FINALIZED RAP bound to the EXACT same Final schedule. */
  async getFinalizedRapForSchedule(scheduleId: string) {
    return prisma.rapReport.findFirst({
      where: {
        scheduleId,
        defenseType: "FINAL_DEFENSE",
        status: "FINALIZED",
      },
      select: { finalizedAt: true },
    });
  }

  /**
   * All PASSED Title Defense authorities for one thesis. Each row carries its
   * selected Title relation so the service can verify exact ownership and
   * fail closed on conflicting authorities.
   */
  async getPassedTitleAuthoritiesForThesis(thesisId: string) {
    return prisma.defenseConclusion.findMany({
      where: {
        thesisId,
        outcome: "PASSED",
        selectedTitleId: { not: null },
        schedule: { defenseType: "TITLE_DEFENSE" },
      },
      select: {
        selectedTitleId: true,
        selectedTitle: {
          select: { id: true, thesisId: true, titleText: true },
        },
      },
    });
  }

  async getArchiveByThesisId(thesisId: string): Promise<ArchiveRecord | null> {
    return prisma.eLibrary.findUnique({
      where: { thesisId },
      select: ARCHIVE_SELECT,
    });
  }

  /**
   * Creates the private archive registration with attached physical files and
   * creates corresponding ThesisDocument rows inside a database transaction.
   */
  async createArchive(data: CreateArchiveInput): Promise<ArchiveRecord> {
    return prisma.$transaction(async (tx) => {
      // 1. Create the e_library archival row
      const elibrary = await tx.eLibrary.create({
        data: {
          thesisId: data.thesisId,
          title: data.title,
          abstract: data.abstract,
          keywords: data.keywords,
          fullPaperPath: data.fullPaperPath ?? null,
          respondentDataPath: data.respondentDataPath ?? null,
          isPublic: false,
          publishedAt: null,
          approvedById: null,
        },
        select: ARCHIVE_SELECT,
      });

      // 2. Persist archival ThesisDocuments (Manuscript, Instruments, Respondent Data)
      if (data.documents && data.documents.length > 0) {
        for (const doc of data.documents) {
          // Deactivate any prior active rows for this slot
          await tx.thesisDocument.updateMany({
            where: {
              thesisId: data.thesisId,
              defenseStage: doc.defenseStage,
              docType: doc.docType,
              isCurrent: true,
            },
            data: { isCurrent: false },
          });

          await tx.thesisDocument.create({
            data: {
              thesisId: data.thesisId,
              docType: doc.docType,
              defenseStage: doc.defenseStage,
              filePath: doc.filePath,
              storageKey: doc.storageKey ?? null,
              storageProvider: doc.storageProvider ?? null,
              originalFilename: doc.originalFilename ?? null,
              verifiedMimeType: doc.verifiedMimeType ?? null,
              sizeBytes: doc.sizeBytes ?? null,
              checksum: doc.checksum ?? null,
              checksumAlgorithm: doc.checksumAlgorithm ?? null,
              uploadedById: doc.uploadedById ?? null,
              isCurrent: true,
              uploadedAt: new Date(),
            },
          });
        }
      }

      // 3. Upsert Grammarian / Research Certification record if provided
      if (data.certificationsPath) {
        await tx.grammarianCertification.upsert({
          where: { thesisId: data.thesisId },
          update: { filePath: data.certificationsPath },
          create: {
            thesisId: data.thesisId,
            filePath: data.certificationsPath,
            status: "SUBMITTED",
          },
        });
      }

      return elibrary;
    });
  }
}
