import prisma from "../config/database";

/**
 * DL-9: Research Databank private archival registration.
 *
 * Read/resolve the authenticated Student's completed Final research context and
 * persist a private archive record. No storage paths are read or written here;
 * the archival manuscript policy is unresolved, so archive rows are created
 * with null legacy path fields.
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
   * Creates the private archive registration. Legacy path fields are explicitly
   * null; publication fields remain unset. `is_public` is false by schema
   * default and explicitly here (defense in depth).
   */
  async createArchive(data: {
    thesisId: string;
    title: string;
    abstract: string | null;
    keywords: string | null;
  }): Promise<ArchiveRecord> {
    return prisma.eLibrary.create({
      data: {
        thesisId: data.thesisId,
        title: data.title,
        abstract: data.abstract,
        keywords: data.keywords,
        fullPaperPath: null,
        respondentDataPath: null,
        isPublic: false,
        publishedAt: null,
        approvedById: null,
      },
      select: ARCHIVE_SELECT,
    });
  }
}
